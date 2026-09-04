import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";
import { Rank, RANK_DEFAULTS, IsdLevel, DashboardRole } from "@/lib/permissions";
import { upsertOfficerAccount, getOfficerProfile } from "@/lib/officerAccount";
import { createEmployee, updateEmployee, appendAudit, loadReference } from "@/lib/adminData";
import { clearanceForRole } from "@/lib/rbac";
import type { ClearanceLevel } from "@/lib/clearance";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Create an officer directly, without them applying first.
 *
 * For officers enrolled by the department rather than through the public
 * registration form. Writes the same records the approval path writes — an
 * Employee row, an OfficerAccount bound to it, Firebase claims, and one audit
 * entry — so a directly-created officer is indistinguishable from an approved
 * one and can be named on a case straight away.
 *
 * SECURITY — the password this route used to set
 *
 * It created the Firebase user with:
 *
 *     password: "Orca@" + badgeNumber.replace(/[^a-zA-Z0-9]/g, "") + "9"
 *
 * That is derived entirely from the badge number, which is printed on documents
 * and shown throughout the app. Anyone who knew an officer's badge number knew
 * their password, for every account this route ever created, and neither the
 * officer nor the administrator was told to change it.
 *
 * It now sets a random 32-byte password that is never returned, never logged
 * and never reconstructible, and hands back a Firebase password-reset link so
 * the officer chooses their own credential. The system does not handle, display or
 * transmit passwords; the link goes to the administrator to pass on.
 */
export async function POST(req: NextRequest) {
  const caller = await checkAdminAuth(req, "CreateProfile");
  if (!caller) {
    return NextResponse.json(
      { success: false, error: "PERMISSION_DENIED: Caller must have administrative clearance." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(caller, "config");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    uid,
    badgeNumber,
    email,
    name,
    station,
    rank,
    active = true,
    overrideIsdLevel,
    overrideDashboardRole,
    districtId,
    unitId,
    rankId,
    designationId,
  } = body as Record<string, any>;

  if (!badgeNumber || !email || !name || !rank) {
    return NextResponse.json(
      { success: false, error: "badgeNumber, email, name and rank are required." },
      { status: 400 }
    );
  }

  const defaults = RANK_DEFAULTS[rank as Rank] || {
    isdLevel: "ISD-LEVEL-IV" as IsdLevel,
    dashboardRole: "field_officer_l4" as DashboardRole,
  };
  const dashboardRole: DashboardRole = overrideDashboardRole || defaults.dashboardRole;
  // Clearance follows the role. `overrideIsdLevel` is honoured only when it
  // agrees; a disagreement is an error rather than a silent overwrite.
  const roleClearance = clearanceForRole(dashboardRole);
  if (!roleClearance) {
    return NextResponse.json(
      { success: false, error: `Unknown role "${dashboardRole}".` },
      { status: 400 }
    );
  }
  if (overrideIsdLevel && String(overrideIsdLevel) !== roleClearance) {
    return NextResponse.json(
      {
        success: false,
        error: `Role ${dashboardRole} carries ${roleClearance}, not "${overrideIsdLevel}". Clearance follows the role.`,
      },
      { status: 400 }
    );
  }
  /**
   * Typed as ClearanceLevel, not IsdLevel: with the ORCA and CRB tracks a role's
   * clearance is no longer always an ISD level, and the old cast quietly
   * asserted otherwise. The value written is unchanged.
   */
  const isdLevel: ClearanceLevel = roleClearance;

  /**
   * `admin_scrb` was on BOTH sides of this check and has been removed from both.
   *
   * As a caller: SCRB can be applied for on the sign-up form now, so it must not
   * be able to create profiles at top-level access.
   *
   * As a grant: SCRB is no longer a top-level role at all. It sits on the CRB
   * track at CRB-LEVEL-I with operational writes, so gating it behind executive
   * approval would block the ordinary approval path it is meant to travel.
   */
  const isExecutiveCaller =
    caller.dashboardRole === "admin_full" || caller.isdLevel === "ISD-LEVEL-I";
  const grantsExecutive = dashboardRole === "admin_full" || isdLevel === "ISD-LEVEL-I";
  if (grantsExecutive && !isExecutiveCaller) {
    return NextResponse.json(
      {
        success: false,
        error: "PERMISSION_DENIED: Only Executive Command Administrators can grant top-level roles.",
      },
      { status: 403 }
    );
  }

  try {
    const emailToUse = String(email).trim().toLowerCase();
    let targetUid: string | undefined = uid;
    let authUser: any = null;
    let createdAuthUser = false;

    if (targetUid) {
      authUser = await adminAuth.getUser(targetUid).catch(() => null);
    }
    if (!authUser) {
      authUser = await adminAuth.getUserByEmail(emailToUse).catch(() => null);
      if (authUser) targetUid = authUser.uid;
    }
    if (!authUser) {
      authUser = await adminAuth.createUser({
        email: emailToUse,
        // Random, never returned, never logged. The officer sets their own via
        // the reset link below; nobody — including this server — retains it.
        password: crypto.randomBytes(32).toString("base64url"),
        displayName: String(name),
        emailVerified: false,
      });
      targetUid = authUser.uid;
      createdAuthUser = true;
    }

    if (!targetUid) throw new Error("Could not resolve a UID for the officer.");

    // Resolve posting. Ids are preferred; a station NAME is matched against the
    // Unit table rather than stored as free text, because Employee holds UnitID.
    const ref = await loadReference();
    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const resolvedUnitId =
      num(unitId) ??
      (station ? ref.units.find((u) => u.name.toLowerCase() === String(station).trim().toLowerCase())?.id ?? null : null);
    const resolvedRankId =
      num(rankId) ?? ref.ranks.find((r) => r.name.toLowerCase() === String(rank).toLowerCase())?.id ?? null;

    const existing = await getOfficerProfile(targetUid);
    let employeeId = existing?.employeeId ?? null;
    let kgid = existing?.kgid || "";

    const posting = {
      rankId: resolvedRankId,
      designationId: num(designationId),
      districtId: num(districtId),
      unitId: resolvedUnitId,
    };

    if (employeeId) {
      // Posting only. The KGID this officer already holds is not reissued —
      // renumbering a serving officer would orphan every case and custody row
      // that cites the old number in its printed record.
      await updateEmployee(employeeId, { firstName: String(name), ...posting });
    } else {
      const created = await createEmployee({
        firstName: String(name),
        /**
         * Blank so the next KSP serial is allocated.
         *
         * `badgeNumber` is what the administrator typed, and it used to be
         * stored as the KGID directly. Under the auto-serial rule that is no
         * longer allowed: a typed number can collide with an issued one, and
         * two officers sharing a KGID makes the personnel roster ambiguous
         * exactly where it must not be. The typed value still identifies the
         * sign-in account; it is not the officer's id.
         */
        kgid: "",
        ...posting,
      });
      employeeId = created.employeeId;
      kgid = created.kgid;
    }

    await upsertOfficerAccount(targetUid, {
      employeeId,
      email: emailToUse,
      dashboardRole,
      // roleClearance, not isdLevel — same value, but the name says it was
      // derived from the role rather than taken from the request.
      clearanceLevel: roleClearance,
      active: Boolean(active),
      accountStatus: active ? "active" : "suspended",
    });

    await adminAuth.setCustomUserClaims(targetUid, { isdLevel, dashboardRole });
    await adminAuth.updateUser(targetUid, { disabled: !active });

    await appendAudit({
      firebaseUid: targetUid,
      changeType: "ROLE_CHANGE",
      oldValue: existing
        ? `role=${existing.dashboardRole}; clearance=${existing.clearanceLevel}`
        : "role=; clearance=",
      newValue: `role=${dashboardRole}; clearance=${isdLevel}; employeeId=${employeeId}; kgid=${kgid}`,
      changedBy: caller.name || caller.email || "Command Administrator",
      reason: String(body.reason || "Officer enrolled directly from the RBAC console."),
    });

    // Only for a genuinely new account — an existing officer does not need
    // their password reset because somebody edited their posting.
    let passwordSetupLink: string | null = null;
    if (createdAuthUser) {
      passwordSetupLink = await adminAuth
        .generatePasswordResetLink(emailToUse)
        .catch(() => null);
    }

    return NextResponse.json({
      success: true,
      uid: targetUid,
      employeeId,
      kgid,
      passwordSetupLink,
      message:
        `${name} (${rank}) enrolled as ${dashboardRole} / ${isdLevel}. KGID ${kgid} issued.` +
        (createdAuthUser
          ? passwordSetupLink
            ? " Send them the password setup link to choose their own credential."
            : " A sign-in account was created but the password setup link could not be generated — ask them to use Forgot Password."
          : ""),
    });
  } catch (error: any) {
    console.error("[createOfficerProfile Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not create the officer profile." },
      { status: 500 }
    );
  }
}
