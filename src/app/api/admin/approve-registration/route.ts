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
      rank,
      posting,
      dashboardRole,
      isdLevel,
      photoUrl,
      adminName
    } = payload;

    if (!uid || !dashboardRole || !isdLevel) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: uid, dashboardRole, and isdLevel are required." },
        { status: 400 }
      );
    }

    const nowStr = new Date().toISOString();

    // Prevent privilege escalation: Only an executive admin can grant 'admin_full' or 'admin_scrb'
    const requestedExecutive = dashboardRole === "admin_full" || dashboardRole === "admin_scrb";
    const isCallerExecutive = activeAdmin.role === "admin_full" || activeAdmin.role === "admin_scrb" || activeAdmin.dashboardRole === "admin_full" || activeAdmin.dashboardRole === "admin_scrb" || activeAdmin.role === "ADMIN" || activeAdmin.role === "Super Administrator";
    
    if (requestedExecutive && !isCallerExecutive) {
      return NextResponse.json(
        { success: false, error: "ACCESS DENIED: Only Executive Command Administrators can grant 'admin_full' or 'admin_scrb' roles." },
        { status: 403 }
      );
    }

    // 2. Set Firebase Custom Claims on the Auth user
    try {
      await adminAuth.setCustomUserClaims(uid, {
        dashboardRole,
        isdLevel
      });
      // Ensure user account is enabled
      await adminAuth.updateUser(uid, { disabled: false });
    } catch (authErr: any) {
      console.error("[Approve Registration] Auth SDK update error:", authErr);
      throw new Error(`Failed to update Firebase Auth claims for uid ${uid}: ${authErr.message}`);
    }

    // 3. Create / update the approved /users/{uid} document
    const userDocData = {
      uid,
      name: name || "Officer",
      email: email || "",
      rank: rank || "Inspector",
      role: dashboardRole,
      dashboardRole,
      isdLevel,
      clearanceLevel: isdLevel,
      posting: posting || "Field",
      station: posting || "Central Command Headquarters",
      policeStation: posting || "Central Command Headquarters",
      district: "Bengaluru Urban",
      mobile: "",
      phone: "",
      photoUrl: photoUrl || "",
      active: true,
      approvedAt: nowStr,
      approvedBy: activeAdmin.name || adminName || "Command Administrator",
      lastLogin: nowStr
    };

    await adminDb.collection("users").doc(uid).set(userDocData, { merge: true });
    // Keep legacy officers collection synced
    await adminDb.collection("officers").doc(uid).set(userDocData, { merge: true });

    // 4. Update status in /pendingRegistrations/{uid}
    await adminDb.collection("pendingRegistrations").doc(uid).set({
      status: "approved",
      approvedAt: nowStr,
      approvedBy: activeAdmin.name || adminName || "Command Administrator",
      assignedRole: dashboardRole,
      isdLevel
    }, { merge: true });

    // 5. Audit Log entry
    await adminDb.collection("audit_logs").add({
      timestamp: nowStr,
      officer: activeAdmin.name || adminName || "Command Administrator",
      action: `Approved registration for ${name} (${email}). Assigned role: ${dashboardRole}, ISD Level: ${isdLevel}`,
      module: "Access and Verification",
      ipAddress: req.headers.get("x-forwarded-for") || "10.0.12.94",
      status: "Success"
    });

    return NextResponse.json({
      success: true,
      message: `Registration approved for ${name}. Role set to ${dashboardRole} (${isdLevel}).`
    });

  } catch (error: any) {
    console.error("[Admin Registration Approval Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve registration." },
      { status: 500 }
    );
  }
}
