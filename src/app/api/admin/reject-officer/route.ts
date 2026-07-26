import { NextRequest, NextResponse } from "next/server";
import { adminDb, checkAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce RBAC Session Check
    const activeAdmin = await checkAdminAuth(req, "Administration");
    if (!activeAdmin) {
      return NextResponse.json({ success: false, error: "ACCESS DENIED: Insufficient administrative privileges." }, { status: 403 });
    }

    const payload = await req.json();
    const { 
      applicationId, 
      email, 
      name,
      reason,
      adminName
    } = payload;

    if (!applicationId || !email || !name) {
      return NextResponse.json({ success: false, error: "Missing required application metrics." }, { status: 400 });
    }

    // 2. Mark Application as Rejected
    await adminDb.collection("officer_applications").doc(applicationId).set({
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      remarks: reason || "Rejected after administrative security review check."
    }, { merge: true });

    // 3. Log Action in Audit Logs
    await adminDb.collection("audit_logs").add({
      timestamp: new Date().toISOString(),
      officer: activeAdmin.name || adminName || "Command Administrator",
      action: `Rejected officer application for ${name} (${email}). Reason: ${reason || "Unspecified"}`,
      module: "Officer Applications",
      ipAddress: req.headers.get("x-forwarded-for") || "10.0.12.94",
      status: "Success"
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully registered application rejection for ${name}.` 
    });

  } catch (error: any) {
    console.error("[Admin Officer Rejection Error]:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Failed to register application rejection." 
    }, { status: 500 });
  }
}
