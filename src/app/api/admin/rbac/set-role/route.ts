import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, checkAdminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { IsdLevel, DashboardRole } from "@/lib/permissions";

/**
 * POST /api/admin/rbac/set-role
 * Callable endpoint: setOfficerRole(targetUid, isdLevel, dashboardRole)
 * Caller must have admin_full, admin_scrb, admin_l2, or ISD-LEVEL-I clearance.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller has admin rights
    const caller = await checkAdminAuth(req, "RoleAssignment");
    if (!caller) {
      return NextResponse.json(
        { success: false, error: "PERMISSION_DENIED: Caller must have administrative clearance." },
        { status: 403 }
      );
    }

    // 2. Validate request body
    const body = await req.json();
    const { targetUid, isdLevel, dashboardRole } = body as {
      targetUid: string;
      isdLevel: IsdLevel;
      dashboardRole: DashboardRole;
    };

    if (!targetUid || !isdLevel || !dashboardRole) {
      return NextResponse.json(
        { success: false, error: "INVALID_ARGUMENT: targetUid, isdLevel, and dashboardRole are required." },
        { status: 400 }
      );
    }

    // 3. Prevent privilege escalation:
    //    Only executive admins (admin_full / admin_scrb / ISD-LEVEL-I) can grant top roles
    const isExecutiveCaller =
      caller.dashboardRole === "admin_full" ||
      caller.dashboardRole === "admin_scrb" ||
      caller.isdLevel === "ISD-LEVEL-I";

    const isGrantingExecutiveRole =
      dashboardRole === "admin_full" ||
      dashboardRole === "admin_scrb" ||
      isdLevel === "ISD-LEVEL-I";

    if (isGrantingExecutiveRole && !isExecutiveCaller) {
      return NextResponse.json(
        { success: false, error: "PERMISSION_DENIED: Only Executive Command Administrators can grant top-level roles." },
        { status: 403 }
      );
    }

    // 4. Fetch old state from Auth claims & Firestore for audit log
    let oldIsdLevel: string | null = null;
    let oldRole: string | null = null;

    try {
      const targetUser = await adminAuth.getUser(targetUid);
      oldIsdLevel = (targetUser.customClaims?.isdLevel as string) || null;
      oldRole = (targetUser.customClaims?.dashboardRole as string) || null;
    } catch (e) {
      // User may be Firestore-only in test setup — not critical
    }

    const userDocRef = adminDb.collection("users").doc(targetUid);
    const oldDocSnap = await userDocRef.get();
    if (oldDocSnap.exists) {
      const oldData = oldDocSnap.data();
      if (!oldIsdLevel) oldIsdLevel = oldData?.isdLevel || null;
      if (!oldRole) oldRole = oldData?.dashboardRole || null;
    }

    // 5. Set Firebase Auth custom claims
    try {
      await adminAuth.setCustomUserClaims(targetUid, {
        isdLevel,
        dashboardRole,
      });
    } catch (e: any) {
      console.warn("[setOfficerRole] Could not set custom claim (user may be Firestore-only):", e.message);
    }

    // 6. Mirror fields onto /users/{uid} and /officers/{uid}
    const nowIso = new Date().toISOString();

    await userDocRef.set(
      {
        uid: targetUid,
        isdLevel,
        dashboardRole,
        clearanceLevel: isdLevel,
        role: dashboardRole,
        updatedBy: caller.uid,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await adminDb.collection("officers").doc(targetUid).set(
      {
        isdLevel,
        clearanceLevel: isdLevel,
        dashboardRole,
        role: dashboardRole,
        updatedBy: caller.uid,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 7. Write immutable audit entry to roleChangeLog
    const auditEntry = {
      targetUid,
      changedBy: caller.uid,
      changedByEmail: caller.email,
      oldRole: oldRole || "NONE",
      newRole: dashboardRole,
      oldIsdLevel: oldIsdLevel || "NONE",
      newIsdLevel: isdLevel,
      timestamp: FieldValue.serverTimestamp(),
      isoTimestamp: nowIso,
    };

    const logRef = await adminDb.collection("roleChangeLog").add(auditEntry);

    return NextResponse.json({
      success: true,
      message: `Successfully updated officer ${targetUid} → ${isdLevel} / ${dashboardRole}`,
      logId: logRef.id,
    });
  } catch (error: any) {
    console.error("[setOfficerRole Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
