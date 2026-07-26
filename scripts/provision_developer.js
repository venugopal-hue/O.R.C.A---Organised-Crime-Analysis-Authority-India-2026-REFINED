const admin = require("firebase-admin");
const { cert } = require("firebase-admin/app");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (serviceAccountJson) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({
    credential: cert(serviceAccount),
    projectId: "orca-india2026"
  });
} else {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "orca-india2026"
  });
}

const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const db = getFirestore();
const auth = getAuth();

async function provisionDeveloper() {
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

  console.log("Setting Firestore /officers/8SdjZAbaVjNfssNuqHV627r52f32...");
  await db.collection("officers").doc(uid).set(devData, { merge: true });

  console.log("Setting Firestore /users/8SdjZAbaVjNfssNuqHV627r52f32...");
  await db.collection("users").doc(uid).set(devData, { merge: true });

  try {
    console.log("Setting Auth Custom Claims for UID 8SdjZAbaVjNfssNuqHV627r52f32...");
    await auth.setCustomUserClaims(uid, {
      dashboardRole: role,
      isdLevel: isdLevel,
      admin: true
    });
    console.log("Custom claims successfully set!");
  } catch (err) {
    console.log("Auth custom claim notice:", err.message);
  }

  console.log("SUCCESS! Developer account provisioned completely!");
  process.exit(0);
}

provisionDeveloper().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
