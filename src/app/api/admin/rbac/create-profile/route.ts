import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, checkAdminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { Rank, RANK_DEFAULTS, IsdLevel, DashboardRole, OfficerUserDoc } from "@/lib/permissions";

/**
 * POST /api/admin/rbac/create-profile
 * Callable endpoint: createOfficerProfile(rank, ...)
 * On profile creation, looks up RANK_DEFAULTS for given rank and applies it.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await checkAdminAuth(req, "CreateProfile");
    if (!caller) {
      return NextResponse.json(
        { success: false, error: "PERMISSION_DENIED: Caller must have administrative clearance." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      uid,
      badgeNumber,
      email,
      name,
      rank,
      station,
      active = true,
      overrideIsdLevel,
      overrideDashboardRole,
    } = body as {
      uid?: string;
      badgeNumber: string;
      email: string;
      name: string;
      rank: Rank;
      station: string;
      active?: boolean;
      overrideIsdLevel?: IsdLevel;
      overrideDashboardRole?: DashboardRole;
    };

    if (!badgeNumber || !email || !name || !rank) {
      return NextResponse.json(
        { success: false, error: "INVALID_ARGUMENT: badgeNumber, email, name, and rank are required." },
        { status: 400 }
      );
    }

    // 1. Look up RANK_DEFAULTS for initial isdLevel & dashboardRole (unless explicitly overridden)
    const defaults = RANK_DEFAULTS[rank] || {
      isdLevel: "ISD-LEVEL-IV",
      dashboardRole: "investigation",
    };

    const isdLevel: IsdLevel = overrideIsdLevel || defaults.isdLevel;
    const dashboardRole: DashboardRole = overrideDashboardRole || defaults.dashboardRole;

    // 2. Provision or retrieve Firebase Auth user
    const emailToUse = email.trim().toLowerCase();
    let targetUid = uid;
    let authUser;

    if (targetUid) {
      try {
        authUser = await adminAuth.getUser(targetUid);
      } catch (e) {
        // If UID wasn't found, try by email
      }
    }

    if (!authUser) {
      try {
        authUser = await adminAuth.getUserByEmail(emailToUse);
        targetUid = authUser.uid;
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          authUser = await adminAuth.createUser({
            email: emailToUse,
            password: "Orca@" + badgeNumber.replace(/[^a-zA-Z0-9]/g, "") + "9",
            displayName: name,
            emailVerified: true,
          });
          targetUid = authUser.uid;
        } else {
          throw err;
        }
      }
    }

    if (!targetUid) {
      throw new Error("Failed to resolve target UID for officer profile.");
    }

    // 3. Set custom user claims strictly containing only { isdLevel, dashboardRole }
    await adminAuth.setCustomUserClaims(targetUid, {
      isdLevel,
      dashboardRole,
    });

    // 4. Create / update users/{uid} Firestore doc
    const nowIso = new Date().toISOString();
    const userDoc: OfficerUserDoc = {
      uid: targetUid,
      name,
      email: emailToUse,
      rank,
      isdLevel,
      dashboardRole,
      station: station || "KSP HQ",
      badgeNumber,
      active,
      updatedBy: caller.uid,
      updatedAt: nowIso,
    };

    await adminDb.collection("users").doc(targetUid).set(userDoc, { merge: true });

    // Also mirror to legacy officers collection
    await adminDb.collection("officers").doc(targetUid).set(
      {
        uid: targetUid,
        name,
        email: emailToUse,
        rank,
        clearanceLevel: isdLevel,
        role: dashboardRole,
        station: station || "KSP HQ",
        badgeId: badgeNumber,
        active,
        updatedBy: caller.uid,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 5. Audit entry to roleChangeLog
    await adminDb.collection("roleChangeLog").add({
      targetUid,
      changedBy: caller.uid,
      oldRole: "NEW_USER",
      newRole: dashboardRole,
      oldIsdLevel: "NEW_USER",
      newIsdLevel: isdLevel,
      timestamp: FieldValue.serverTimestamp(),
      isoTimestamp: nowIso,
      rank,
      name,
      badgeNumber,
    });

    return NextResponse.json({
      success: true,
      message: `Profile created for ${name} (${rank}) with ${isdLevel} / ${dashboardRole}`,
      profile: userDoc,
    });
  } catch (error: any) {
    console.error("[createOfficerProfile Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
