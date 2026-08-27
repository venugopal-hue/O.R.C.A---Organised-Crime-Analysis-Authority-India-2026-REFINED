import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { upsertApplication, appendAudit, listApplications } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Administrative edits to an officer's application.
 *
 * PATCH — update the reviewable fields: posting details, requested access,
 * reviewer remarks, and the review status short of approval or rejection.
 *
 * Approval and rejection are deliberately NOT here. Those two have side effects
 * far beyond the application row — a personnel record, a KGID, an account, a
 * Firebase claim — and they live in their own routes with their own ordering
 * guarantees. Letting a general-purpose PATCH set `status: "approved"` would
 * mark somebody approved without giving them any of that.
 */

/** Statuses this route may set. Approval and rejection are excluded by design. */
const REVIEW_STATUSES = new Set(["pending", "under_review", "awaiting"]);

export async function PATCH(req: NextRequest) {
  const admin = await checkAdminAuth(req, "Administration");
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

  if (body.status !== undefined && !REVIEW_STATUSES.has(String(body.status))) {
    return NextResponse.json(
      {
        success: false,
        error:
          `"${body.status}" cannot be set here. Approval and rejection go through ` +
          "/api/admin/approve-registration and /api/admin/reject-registration.",
      },
      { status: 400 }
    );
  }

  try {
    const before = (await listApplications()).find((a) => a.firebaseUid === uid);
    if (!before) {
      return NextResponse.json(
        { success: false, error: "No application on record for that officer." },
        { status: 404 }
      );
    }
    if (before.status === "approved") {
      return NextResponse.json(
        { success: false, error: "This application has already been approved and cannot be edited." },
        { status: 409 }
      );
    }

    const num = (v: any) => {
      if (v === null || v === "" || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const patch: Record<string, any> = { firebaseUid: uid };
    if (body.fullName !== undefined) patch.fullName = String(body.fullName).trim();
    if (body.mobile !== undefined) patch.mobile = String(body.mobile).trim();
    // KGID is NOT editable during review. It is auto-serial: the provisional
    // APP- id is issued when the application is filed, and replaced by the
    // permanent KSP- id at approval. A `kgid` in the body is ignored rather
    // than rejected, so an older client that still sends it does not fail.
    if (body.rankId !== undefined) patch.rankId = num(body.rankId);
    if (body.designationId !== undefined) patch.designationId = num(body.designationId);
    if (body.districtId !== undefined) patch.districtId = num(body.districtId);
    if (body.unitId !== undefined) patch.unitId = num(body.unitId);
    if (body.postingType !== undefined) patch.postingType = String(body.postingType).trim();
    if (body.requestedAccess !== undefined) patch.requestedAccess = String(body.requestedAccess).trim();
    if (body.remarks !== undefined) patch.remarks = String(body.remarks);
    if (body.status !== undefined) patch.status = String(body.status);

    await upsertApplication(patch as any);

    const who = admin.name || admin.email || "Command Administrator";
    await appendAudit({
      firebaseUid: uid,
      changeType: body.status ? "APPLICATION_STATUS" : "APPLICATION_EDIT",
      oldValue: `status=${before.status}; rank=${before.rankId}; district=${before.districtId}; unit=${before.unitId}`,
      newValue: Object.entries(patch)
        .filter(([k]) => k !== "firebaseUid")
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
      changedBy: who,
      reason: String(body.reason || "Application updated during administrative review."),
    });

    const after = (await listApplications()).find((a) => a.firebaseUid === uid) || null;
    return NextResponse.json({ success: true, application: after, message: "Application updated." });
  } catch (err: any) {
    console.error("[Admin Application Patch Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not update the application." },
      { status: 500 }
    );
  }
}
