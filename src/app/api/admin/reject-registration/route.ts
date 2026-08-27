import { NextRequest, NextResponse } from "next/server";
import { adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";
import { upsertApplication, appendAudit, listApplications, catalystNow } from "@/lib/adminData";
import { upsertOfficerAccount, getOfficerProfile } from "@/lib/officerAccount";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Reject an officer's registration.
 *
 * No `Employee` row is created — a rejected applicant is not personnel, and
 * creating one "just in case" would put a non-officer into the roster that
 * Case Registration and Evidence Management pick their officers from.
 *
 * If an account already exists (a previously approved officer being revoked),
 * it is deactivated rather than deleted. Deleting it would orphan every case
 * and custody row that names them, and the chain of custody is meant to be
 * permanent — an officer leaving must not make past evidence unattributable.
 */
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

  const { uid, reason, adminName } = payload || {};
  if (!uid) {
    return NextResponse.json({ success: false, error: "uid is required." }, { status: 400 });
  }

  // A rejection with no stated reason is not reviewable later, and the officer
  // has to be told something. The old route silently substituted a boilerplate
  // sentence, so every rejection on record read identically.
  const statedReason = String(reason || "").trim();
  if (!statedReason) {
    return NextResponse.json(
      { success: false, error: "A reason is required to reject a registration." },
      { status: 400 }
    );
  }

  const who = activeAdmin.name || adminName || "Command Administrator";
  const now = catalystNow();

  try {
    const applications = await listApplications();
    const application = applications.find((a) => a.firebaseUid === uid);
    if (!application) {
      return NextResponse.json(
        { success: false, error: "No registration on record for that officer." },
        { status: 404 }
      );
    }

    try {
      await adminAuth.updateUser(uid, { disabled: true });
    } catch (authErr: any) {
      // Not fatal: the records below still need to reflect the decision, and a
      // disabled-but-unrecorded rejection is the worse of the two failures.
      console.warn("[reject-registration] Could not disable auth user:", authErr.message);
    }

    const existing = await getOfficerProfile(uid);
    if (existing) {
      await upsertOfficerAccount(uid, { active: false, accountStatus: "rejected" });
    }

    await upsertApplication({
      firebaseUid: uid,
      status: "rejected",
      reviewedBy: who,
      reviewedAt: now,
      remarks: statedReason,
    });

    await appendAudit({
      firebaseUid: uid,
      changeType: "REGISTRATION_REJECTED",
      oldValue: `status=${application.status}`,
      newValue: "status=rejected",
      changedBy: who,
      reason: statedReason,
    });

    return NextResponse.json({
      success: true,
      message: `Registration rejected for ${application.fullName || application.email}.`,
    });
  } catch (error: any) {
    console.error("[Admin Registration Rejection Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to reject registration." },
      { status: 500 }
    );
  }
}
