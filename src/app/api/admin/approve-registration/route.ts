import { NextRequest, NextResponse } from "next/server";
import { adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";
import { upsertOfficerAccount, getOfficerProfile } from "@/lib/officerAccount";
import {
  createEmployee,
  updateEmployee,
  upsertApplication,
  appendAudit,
  listApplications,
  catalystNow,
} from "@/lib/adminData";
import { clearanceForRole } from "@/lib/rbac";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Approve an officer's registration.
 *
 * WHAT CHANGED, AND WHY IT MATTERED
 *
 * This route used to write only Firestore: custom claims, a `/users/{uid}`
 * document, a mirrored `/officers/{uid}` document, and a status flag. It never
 * created the officer's `Employee` row.
 *
 * `Employee` is the ER diagram's personnel table, and `EmployeeID` is what the
 * rest of the platform actually uses to name a person: the investigating
 * officer on a case, the officer who collected an exhibit, the custodian
 * holding it. So an approved officer could sign in, and then could not be
 * selected anywhere. Their account existed and their identity did not — which
 * only became visible once Case Registration and Evidence Management shipped
 * and their officer pickers came up short.
 *
 * The order below is deliberate. Catalyst has no transactions, so the sequence
 * is chosen so that a failure part-way through leaves something recoverable
 * rather than something contradictory:
 *
 *   1. Employee row      — the identity. Nothing references it yet, so a
 *                          failure here leaves an orphan row and no account.
 *   2. OfficerAccount    — binds Firebase UID to that EmployeeID.
 *   3. Firebase claims   — the last irreversible step, done only once the
 *                          officer has somewhere to land.
 *   4. Application       — marked approved.
 *   5. Audit             — append-only record of who approved what.
 *
 * If step 3 fails the officer cannot sign in but their records are intact and
 * the approval can simply be retried; the upserts in 1-2 are idempotent per UID.
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
  const activeAdmin = await checkAdminAuth(req, "Administration");
  if (!activeAdmin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(activeAdmin, "config");
  if (denied) return denied;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    uid,
    dashboardRole,
    isdLevel,
    // Posting details. These are FK ids now, not free text — the ER diagram
    // holds posting on Employee, and a string station name cannot be joined.
    rankId,
    designationId,
    districtId,
    unitId,
    adminName,
  } = payload || {};

  if (!uid || !dashboardRole) {
    return NextResponse.json(
      { success: false, error: "uid and dashboardRole are required." },
      { status: 400 }
    );
  }

  /**
   * The clearance comes FROM the role — it is not accepted alongside it.
   *
   * Each role name states its level (command_admin_l1 is ISD-LEVEL-I), and
   * RBAC_CONFIG holds that pairing. Taking `isdLevel` from the caller is what
   * allowed the same role to be held at different clearances, and what let six
   * spellings of four levels into seven officer records.
   *
   * A supplied `isdLevel` is REJECTED when it disagrees rather than ignored, so
   * an out-of-date console learns it is wrong instead of quietly having its
   * value dropped.
   */
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

  const callerRole = activeAdmin.dashboardRole || activeAdmin.role || "";
  if (EXECUTIVE_ROLES.has(dashboardRole) && !EXECUTIVE_ROLES.has(callerRole)) {
    return NextResponse.json(
      {
        success: false,
        error: "ACCESS DENIED: Only Executive Command Administrators can grant admin_full.",
      },
      { status: 403 }
    );
  }

  const who = activeAdmin.name || adminName || "Command Administrator";
  const now = catalystNow();

  try {
    // The application is the source of the applicant's own details. Taking the
    // name from the request body would let the approving screen quietly change
    // who was approved relative to who applied.
    const applications = await listApplications();
    const application = applications.find((a) => a.firebaseUid === uid);

    if (!application) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No registration on record for that officer. An application must exist before it can be approved.",
        },
        { status: 404 }
      );
    }
    if (application.status === "approved") {
      return NextResponse.json(
        { success: false, error: `${application.fullName} has already been approved.` },
        { status: 409 }
      );
    }

    const fullName = application.fullName || application.email || "Officer";

    // 1 + 2. Identity, then account. An officer approved twice must not get a
    // second Employee row, so an existing binding is reused.
    const existing = await getOfficerProfile(uid);
    let employeeId = existing?.employeeId ?? null;
    let allocatedKgid = existing?.kgid || "";

    const posting = {
      rankId: rankId ?? application.rankId ?? null,
      designationId: designationId ?? application.designationId ?? null,
      districtId: districtId ?? application.districtId ?? null,
      unitId: unitId ?? application.unitId ?? null,
    };

    if (employeeId) {
      await updateEmployee(employeeId, { firstName: fullName, ...posting });
    } else {
      const created = await createEmployee({
        firstName: fullName,
        /**
         * Left blank ON PURPOSE so createEmployee allocates the next KSP
         * serial itself.
         *
         * `application.kgid` is the PROVISIONAL `APP-…` id and must not be
         * carried over — it would put an applicant number on a personnel
         * record, where it would then appear on cases and exhibits. There is
         * deliberately no `kgid` parameter on this route either: allowing a
         * caller to choose the number would defeat the serial.
         */
        kgid: "",
        ...posting,
      });
      employeeId = created.employeeId;
      allocatedKgid = created.kgid;
    }

    await upsertOfficerAccount(uid, {
      employeeId,
      email: application.email,
      mobile: application.mobile,
      dashboardRole,
      clearanceLevel: resolvedClearance,
      active: true,
      accountStatus: "active",
      photoUrl: application.photoUrl,
    });

    // 3. Firebase claims — the officer can now sign in and land somewhere real.
    try {
      await adminAuth.setCustomUserClaims(uid, { dashboardRole, isdLevel: resolvedClearance });
      await adminAuth.updateUser(uid, { disabled: false });
    } catch (authErr: any) {
      throw new Error(
        `Records were written, but Firebase Auth rejected the claim update for ${uid}: ${authErr.message}. ` +
          "Re-run the approval to retry — the records above are idempotent."
      );
    }

    // 4. Application status.
    await upsertApplication({
      firebaseUid: uid,
      status: "approved",
      reviewedBy: who,
      reviewedAt: now,
      kgid: allocatedKgid,
    });

    // 5. Audit.
    await appendAudit({
      firebaseUid: uid,
      changeType: "REGISTRATION_APPROVED",
      // Records the id CHANGE, not just the new value — the provisional id is
      // what the applicant was referred to during review, and an audit trail
      // that only shows the final number cannot connect the two.
      oldValue: `status=${application.status}; kgid=${application.kgid || "(none)"}`,
      newValue: `status=approved; role=${dashboardRole}; clearance=${resolvedClearance}; employeeId=${employeeId}; kgid=${allocatedKgid}`,
      changedBy: who,
      reason: String(payload.reason || "Registration approved from the admin console."),
    });

    return NextResponse.json({
      success: true,
      employeeId,
      kgid: allocatedKgid,
      previousKgid: application.kgid || "",
      message:
        `${fullName} approved as ${dashboardRole} (${resolvedClearance}). ` +
        (application.kgid
          ? `KGID ${application.kgid} replaced by ${allocatedKgid}.`
          : `KGID ${allocatedKgid} issued.`),
    });
  } catch (error: any) {
    console.error("[Admin Registration Approval Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to approve registration." },
      { status: 500 }
    );
  }
}
