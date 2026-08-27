import { NextRequest, NextResponse } from "next/server";
import { adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";
import { getOfficerProfile, upsertOfficerAccount } from "@/lib/officerAccount";
import { appendAudit } from "@/lib/adminData";
import { IsdLevel, DashboardRole } from "@/lib/permissions";
import { clearanceForRole } from "@/lib/rbac";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Set an officer's role and clearance.
 *
 * Writes OfficerAccount in Catalyst and the matching Firebase custom claims,
 * then appends one OfficerAuditLog row. It previously wrote `users`,
 * `officers` and `roleChangeLog` in Firestore — three documents the rest of the
 * platform had stopped reading.
 *
 * Privilege escalation is still blocked the same way, and one rule is added:
 * an administrator cannot change their OWN role or clearance here. Self-service
 * promotion is exactly the hole this check exists to close, and the old version
 * allowed it as long as the caller already had admin rights.
 */

/**
 * Roles permitted to GRANT top-level access.
 *
 * `admin_scrb` was in this set and has been removed. SCRB is now a role an
 * applicant can request on the sign-up form, so leaving it able to promote
 * accounts to full command would mean one approved application was enough to
 * mint an administrator. The bureau's work needs sight of statewide records,
 * never the power to hand out access.
 */
const EXECUTIVE_ROLES = new Set(["admin_full"]);

export async function POST(req: NextRequest) {
  const caller = await checkAdminAuth(req, "RoleAssignment");
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

  const { targetUid, isdLevel, dashboardRole } = body as {
    targetUid: string;
    isdLevel: IsdLevel;
    dashboardRole: DashboardRole;
  };

  if (!targetUid || !dashboardRole) {
    return NextResponse.json(
      { success: false, error: "targetUid and dashboardRole are required." },
      { status: 400 }
    );
  }

  // Clearance follows the role — see approve-registration for why.
  const resolvedClearance = clearanceForRole(String(dashboardRole));
  if (!resolvedClearance) {
    return NextResponse.json(
      { success: false, error: `Unknown role "${dashboardRole}".` },
      { status: 400 }
    );
  }
  if (isdLevel && String(isdLevel) !== resolvedClearance) {
    return NextResponse.json(
      {
        success: false,
        error: `Role ${dashboardRole} carries ${resolvedClearance}, not "${isdLevel}". Clearance follows the role.`,
      },
      { status: 400 }
    );
  }

  if (targetUid === caller.uid) {
    return NextResponse.json(
      {
        success: false,
        error: "You cannot change your own role or clearance. Ask another administrator.",
      },
      { status: 403 }
    );
  }

  const isExecutiveCaller =
    EXECUTIVE_ROLES.has(caller.dashboardRole) || caller.isdLevel === "ISD-LEVEL-I";
  const grantsExecutive =
    EXECUTIVE_ROLES.has(String(dashboardRole)) || resolvedClearance === "ISD-LEVEL-I";

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
    const before = await getOfficerProfile(targetUid);
    if (!before) {
      return NextResponse.json(
        {
          success: false,
          error: "No officer account on record for that UID. Approve their registration first.",
        },
        { status: 404 }
      );
    }

    await upsertOfficerAccount(targetUid, {
      dashboardRole: String(dashboardRole),
      clearanceLevel: resolvedClearance,
    });

    await adminAuth.setCustomUserClaims(targetUid, { dashboardRole, isdLevel: resolvedClearance });

    await appendAudit({
      firebaseUid: targetUid,
      changeType: "ROLE_CHANGE",
      oldValue: `role=${before.dashboardRole}; clearance=${before.clearanceLevel}`,
      newValue: `role=${dashboardRole}; clearance=${resolvedClearance}`,
      changedBy: caller.name || caller.email || "Command Administrator",
      reason: String(body.reason || "Role assigned from the RBAC console."),
    });

    return NextResponse.json({
      success: true,
      message: `${before.name || targetUid} set to ${dashboardRole} (${resolvedClearance}).`,
      // The officer's existing session still carries the OLD claims until their
      // ID token refreshes. Said here rather than left as a surprise.
      note: "The change takes effect for that officer on their next sign-in or token refresh.",
    });
  } catch (err: any) {
    console.error("[RBAC set-role Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not set the role." },
      { status: 500 }
    );
  }
}
