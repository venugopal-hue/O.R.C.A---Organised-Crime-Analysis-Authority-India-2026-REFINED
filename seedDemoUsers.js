/**
 * Seed Demo Users Script for O.R.C.A Five-Role RBAC
 * Creates or updates 5 demo user accounts with distinct DashboardRole and IsdLevel custom claims.
 *
 * Usage:
 *   1. Download your Firebase Service Account JSON key from Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key.
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS in your shell:
 *        PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
 *   3. Run: node seedDemoUsers.js
 */

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

const path = require("path");

// Initialize Firebase Admin SDK
let app;
if (getApps().length === 0) {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, "./firebase-key.json");
  if (saPath && fs.existsSync(saPath)) {
    app = initializeApp({
      credential: cert(saPath),
      projectId: "orca-india2026"
    });
  } else {
    app = initializeApp({
      projectId: "orca-india2026"
    });
  }
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const db = getFirestore(app);

/**
 * ISD LEVEL -> dashboardRole MAPPING (5 distinct roles):
 *
 * ISD-LEVEL-4        -> admin_full          -> Full platform access, Admin Dashboard
 * ISD-LEVEL-3-SCRB   -> admin_scrb          -> Admin Controls: AI & Intelligence + Audit Infrastructure only
 * ISD-LEVEL-3-VERIF  -> admin_verification  -> Admin Controls: Access and Verification only
 * ISD-LEVEL-2        -> investigation_l2    -> Investigation Dashboard: Command Centre + Verification Services + User Panel
 * ISD-LEVEL-1        -> investigation_l1    -> Investigation Dashboard: Command Centre + User Panel only (NO Verification Services)
 */
const DEMO_USERS = [
  {
    email: "admin2@orca.gov",
    password: "Password123!",
    displayName: "DGP R. K. Shastry, IPS",
    rank: "DGP",
    posting: "Headquarters",
    isdLevel: "ISD-LEVEL-4",
    dashboardRole: "admin_full",
    district: "State Headquarters — Bengaluru"
  },
  {
    email: "scrbadmin@orca.gov",
    password: "Password123!",
    displayName: "SCRB Admin Kiran Kumar",
    rank: "SCRB Admin",
    posting: "Headquarters",
    isdLevel: "ISD-LEVEL-3",
    dashboardRole: "admin_scrb",
    district: "SCRB IT Cell"
  },
  {
    email: "admin1@orca.gov",
    password: "Password123!",
    displayName: "Inspector Ananya Rao",
    rank: "Inspector",
    posting: "Headquarters",
    isdLevel: "ISD-LEVEL-3",
    dashboardRole: "admin_verification",
    district: "Bengaluru Urban"
  },
  {
    email: "investigator2@orca.gov",
    password: "Password123!",
    displayName: "DSP Vikram Patil, IPS",
    rank: "DSP",
    posting: "Field Posting",
    isdLevel: "ISD-LEVEL-2",
    dashboardRole: "investigation_l2",
    district: "Mysuru District"
  },
  {
    email: "investigator1@orca.gov",
    password: "Password123!",
    displayName: "SI Manoj Gowda",
    rank: "SI",
    posting: "Field Posting",
    isdLevel: "ISD-LEVEL-1",
    dashboardRole: "investigation_l1",
    district: "Mangaluru District"
  }
];

async function seedDemoUsers() {
  console.log("==================================================");
  console.log("🌊 O.R.C.A RBAC DEMO ACCOUNT SEEDER (5-Role Model)");
  console.log("==================================================\n");

  for (const u of DEMO_USERS) {
    let uid;
    try {
      const existingUser = await auth.getUserByEmail(u.email);
      uid = existingUser.uid;
      await auth.updateUser(uid, { password: u.password });
      console.log(`[FOUND & UPDATED PASSWORD] Existing user ${u.email} (uid: ${uid})`);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        const newUser = await auth.createUser({
          email: u.email,
          password: u.password,
          displayName: u.displayName
        });
        uid = newUser.uid;
        console.log(`[CREATED] New user ${u.email} (uid: ${uid})`);
      } else {
        throw err;
      }
    }

    // 1. Set Custom Claims (< 1000 bytes strictly)
    await auth.setCustomUserClaims(uid, {
      isdLevel: u.isdLevel,
      dashboardRole: u.dashboardRole
    });
    console.log(`  ✓ Custom Claims set: { isdLevel: "${u.isdLevel}", dashboardRole: "${u.dashboardRole}" }`);

    // 2. Mirror profile to Firestore /users/{uid} and /officers/{uid}
    const profileDoc = {
      uid,
      email: u.email,
      name: u.displayName,
      rank: u.rank,
      posting: u.posting,
      isdLevel: u.isdLevel,
      clearanceLevel: u.isdLevel,
      dashboardRole: u.dashboardRole,
      role: u.dashboardRole,
      district: u.district,
      active: true,
      updatedAt: new Date().toISOString()
    };

    await db.collection("users").doc(uid).set(profileDoc, { merge: true });
    await db.collection("officers").doc(uid).set(profileDoc, { merge: true });
    console.log(`  ✓ Firestore profile updated under /users/${uid}\n`);
  }

  console.log("==================================================");
  console.log("✅ SEED COMPLETED SUCCESSFULLY!");
  console.log("Demo Accounts Ready to Test:");
  console.log("  1. admin2@orca.gov          | Pass: Password123! | Role: admin_full         (ISD-4, Full Admin)");
  console.log("  2. scrbadmin@orca.gov       | Pass: Password123! | Role: admin_scrb         (ISD-3, AI & Intel + Audit)");
  console.log("  3. admin1@orca.gov          | Pass: Password123! | Role: admin_verification (ISD-3, Access & Verification)");
  console.log("  4. investigator2@orca.gov   | Pass: Password123! | Role: investigation_l2   (ISD-2, + Verification Services)");
  console.log("  5. investigator1@orca.gov   | Pass: Password123! | Role: investigation_l1   (ISD-1, no Verification Services)");
  console.log("==================================================");
}

seedDemoUsers().then(() => process.exit(0)).catch(err => {
  console.error("\n[ERROR] Failed to seed users due to Firebase Admin Credential issue:");
  console.error("  ->", err.message || err);
  console.error("\n==================================================");
  console.error("HOW TO RUN THIS SCRIPT WITH FIREBASE CREDENTIALS:");
  console.error("1. Download your Service Account JSON key from:");
  console.error("   Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key");
  console.error("2. Set the GOOGLE_APPLICATION_CREDENTIALS env var in PowerShell:");
  console.error('   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\serviceAccountKey.json"');
  console.error("3. Re-run: node seedDemoUsers.js");
  console.error("==================================================\n");
  process.exit(1);
});