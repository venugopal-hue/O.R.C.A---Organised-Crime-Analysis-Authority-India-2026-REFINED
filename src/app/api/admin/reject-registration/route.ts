import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth, checkAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce RBAC Session Check (caller must be an administrator)
    const activeAdmin = await checkAdminAuth(req, "Administration");
    if (!activeAdmin) {
      return NextResponse.json(
        { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
        { status: 403 }
      );
    }

    const payload = await req.json();
    const {
      uid,
      name,
      email,
      reason,
      adminName
    } = payload;

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: uid is required." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toISOString();

    // 2. Disable user account in Firebase Auth via Admin SDK
    try {
      await adminAuth.updateUser(uid, { disabled: true });
    } catch (authErr: any) {
      console.warn("[Reject Registration] Warning disabling auth user:", authErr.message);
    }

    // 3. Update status in /pendingRegistrations/{uid}
    await adminDb.collection("pendingRegistrations").doc(uid).set({
      status: "rejected",
      rejectedAt: nowStr,
      rejectedBy: activeAdmin.name || adminName || "Command Administrator",
      reason: reason || "Did not pass administrative review check."
    }, { merge: true });

    // 4. Audit Log entry
    await adminDb.collection("audit_logs").add({
      timestamp: nowStr,
      officer: activeAdmin.name || adminName || "Command Administrator",
      action: `Rejected registration for ${name || uid} (${email || ""}). Reason: ${reason || "Unspecified"}`,
      module: "Access and Verification",
      ipAddress: req.headers.get("x-forwarded-for") || "10.0.12.94",
      status: "Success"
    });

    return NextResponse.json({
      success: true,
      message: `Registration rejected for ${name || uid}. User account has been disabled.`
    });

  } catch (error: any) {
    console.error("[Admin Registration Rejection Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reject registration." },
      { status: 500 }
    );
  }
}
