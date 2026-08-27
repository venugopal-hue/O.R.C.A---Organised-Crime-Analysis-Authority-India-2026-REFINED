import { NextRequest, NextResponse } from "next/server";
import { adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";
import {
  listOfficerProfiles,
  upsertOfficerAccount,
  getOfficerProfile,
} from "@/lib/officerAccount";
import { updateEmployee, createEmployee, appendAudit } from "@/lib/adminData";
import { clearanceForRole } from "@/lib/rbac";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Administrative edits to an approved officer.
 *
 * PATCH — posting, clearance, role, and active/suspended state.
 *
 * The edit spans two tables by design, and the split follows the ER diagram:
 * name and posting are personnel facts and live on `Employee`; role, clearance
 * and account state are access facts and live on `OfficerAccount`. The previous
 * screen wrote both into a single Firestore document, which is how one officer
 * could end up with a district on their profile and a different one on their
 * personnel record.
 *
 * SUSPENSION IS NOT DELETION. Setting `active: false` disables the Firebase
 * account and marks the record suspended. It never removes the Employee row —
 * cases and custody entries name that row, and the chain of custody has to stay
 * attributable after an officer leaves.
 */

export async function PATCH(req: NextRequest) {
  const admin = await checkAdminAuth(req, "Officer Directory");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(admin, "config");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const uid = String(body.uid || "").trim();
  if (!uid) {
    return NextResponse.json({ success: false, error: "uid is required." }, { status: 400 });
  }

  /**
   * Clearance is NOT editable on its own — it follows the role.
   *
   * Changing it independently is exactly how the same role came to be held at
   * two different levels. To change an officer's clearance, change their role
   * to the variant that carries it (command_admin_l1 vs command_admin_l2).
   */
  if (body.dashboardRole !== undefined && !clearanceForRole(String(body.dashboardRole))) {
    return NextResponse.json(
      { success: false, error: `Unknown role "${body.dashboardRole}".` },
      { status: 400 }
    );
  }
  /**
   * A clearance sent WITHOUT a role is refused outright.
   *
   * The mismatch check below only fired when both arrived together, so the edit
   * drawer — which posts `clearanceLevel` on its own — slipped past it and wrote
   * whatever the reviewer picked. That is how two of the seven live accounts
   * ended up on a clearance their role does not carry (investigation_l1 holding
   * ISD-LEVEL-III, where the role carries ISD-LEVEL-IV).
   *
   * Silently ignoring the field would be worse: the drawer would report success
   * while nothing changed. So it is an explicit 400 that says what to do instead.
   */
  if (body.clearanceLevel !== undefined && body.dashboardRole === undefined) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Clearance follows the role and cannot be set on its own. Change the officer's role to the variant that carries the clearance you want.",
      },
      { status: 400 }
    );
  }
  if (
    body.clearanceLevel !== undefined &&
    body.dashboardRole !== undefined &&
    String(body.clearanceLevel) !== clearanceForRole(String(body.dashboardRole))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: `Role ${body.dashboardRole} carries ${clearanceForRole(String(body.dashboardRole))}. Change the role to change the clearance.`,
      },
      { status: 400 }
    );
  }

  // An administrator suspending their own account would lock the console behind
  // a door only they could open. Blocked outright rather than warned about.
  if (body.active === false && uid === admin.uid) {
    return NextResponse.json(
      { success: false, error: "You cannot suspend your own account." },
      { status: 400 }
    );
  }

  try {
    const before = await getOfficerProfile(uid);
    if (!before) {
      return NextResponse.json(
        { success: false, error: "No officer account on record for that UID." },
        { status: 404 }
      );
    }

    const num = (v: any) => {
      if (v === null || v === "" || v === undefined) return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    // 1. Personnel record. Posting and name only — see the KGID note below.
    const employeePatch: Record<string, any> = {};
    if (body.name !== undefined) employeePatch.firstName = String(body.name).trim();
    /**
     * KGID is deliberately NOT editable here.
     *
     * It is auto-serial (user decision, 2026-08-24) and is issued once, at
     * approval or enrolment. Letting an administrator retype it would allow two
     * officers to hold the same number, and would silently break the printed
     * record of every case and custody entry that already cites the old one.
     * A `kgid` in the body is ignored rather than rejected, so an older client
     * that still sends it does not fail.
     */
    if (body.rankId !== undefined) employeePatch.rankId = num(body.rankId);
    if (body.designationId !== undefined) employeePatch.designationId = num(body.designationId);
    if (body.districtId !== undefined) employeePatch.districtId = num(body.districtId);
    if (body.unitId !== undefined) employeePatch.unitId = num(body.unitId);

    let employeeId = before.employeeId;
    if (Object.keys(employeePatch).length) {
      if (employeeId) {
        await updateEmployee(employeeId, employeePatch);
      } else {
        // An account approved before this route existed may have no personnel
        // record at all. Repair it here rather than refusing the edit.
        const created = await createEmployee({
          firstName: employeePatch.firstName || before.name || "Officer",
          // Blank so the next KSP serial is allocated - this branch repairs an
          // account that has no personnel record at all, so it needs a real id.
          kgid: "",
          rankId: employeePatch.rankId ?? null,
          designationId: employeePatch.designationId ?? null,
          districtId: employeePatch.districtId ?? null,
          unitId: employeePatch.unitId ?? null,
        });
        employeeId = created.employeeId;
      }
    }

    // 2. Account record.
    const accountPatch: Record<string, any> = {};
    if (employeeId !== before.employeeId) accountPatch.employeeId = employeeId;
    if (body.email !== undefined) accountPatch.email = String(body.email).trim();
    if (body.mobile !== undefined) accountPatch.mobile = String(body.mobile).trim();
    if (body.dashboardRole !== undefined) accountPatch.dashboardRole = String(body.dashboardRole);
    // Derived, never taken as given.
    if (body.dashboardRole !== undefined) {
      accountPatch.clearanceLevel = clearanceForRole(String(body.dashboardRole));
    }
    if (body.active !== undefined) {
      accountPatch.active = Boolean(body.active);
      accountPatch.accountStatus = body.active ? "active" : "suspended";
    }
    if (Object.keys(accountPatch).length) {
      await upsertOfficerAccount(uid, accountPatch);
    }

    // 3. Firebase — claims follow the account, and a suspended officer must not
    //    still be able to sign in.
    if (body.dashboardRole !== undefined) {
      await adminAuth.setCustomUserClaims(uid, {
        dashboardRole: body.dashboardRole,
        isdLevel: clearanceForRole(String(body.dashboardRole)),
      });
    }
    if (body.active !== undefined) {
      await adminAuth.updateUser(uid, { disabled: !body.active });
    }

    const who = admin.name || admin.email || "Command Administrator";
    await appendAudit({
      firebaseUid: uid,
      changeType: body.active !== undefined ? "ACCOUNT_STATUS" : "OFFICER_PROFILE",
      oldValue: `name=${before.name}; rank=${before.rank}; district=${before.district}; unit=${before.station}; role=${before.dashboardRole}; clearance=${before.clearanceLevel}; active=${before.active}`,
      newValue: Object.entries({ ...employeePatch, ...accountPatch })
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
      changedBy: who,
      reason: String(body.reason || "Officer record updated from the admin console."),
    });

    const after = (await listOfficerProfiles()).find((o) => o.firebaseUid === uid) || null;
    return NextResponse.json({ success: true, officer: after, message: "Officer record updated." });
  } catch (err: any) {
    console.error("[Admin Officer Patch Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not update the officer record." },
      { status: 500 }
    );
  }
}
