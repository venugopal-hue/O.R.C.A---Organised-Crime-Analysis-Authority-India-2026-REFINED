import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  return handleProvision();
}

export async function POST(req: NextRequest) {
  return handleProvision();
}

async function handleProvision() {
  try {
    const uid = "8SdjZAbaVjNfssNuqHV627r52f32";
    const email = "developer@orca.gov";
    const name = "System Developer";
    const rank = "Developer";
    const role = "admin_full";
    const isdLevel = "ISD-LEVEL-I";

    const devData = {
      uid,
      email,
      name,
      rank,
      role,
      dashboardRole: role,
      isdLevel,
      clearanceLevel: isdLevel,
      approvalStatus: "APPROVED",
      status: "ACTIVE",
      active: true,
      badgeNumber: "DEV-001",
      posting: "Internal Security Division HQ",
      district: "Bengaluru Command",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Write to /officers collection
    await adminDb.collection("officers").doc(uid).set(devData, { merge: true });

    // 2. Write to /users collection
    await adminDb.collection("users").doc(uid).set(devData, { merge: true });

    // 3. Set Custom Claims via Firebase Auth (if user exists in Auth)
    try {
      await adminAuth.setCustomUserClaims(uid, {
        dashboardRole: role,
        isdLevel: isdLevel,
        admin: true
      });
    } catch (authErr: any) {
      console.warn("Auth custom claims set notice:", authErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Provisioned developer account ${email} (${uid}) successfully!`,
      data: devData
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
