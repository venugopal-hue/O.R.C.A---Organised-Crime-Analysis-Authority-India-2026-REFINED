require("dotenv").config({ path: "../.env.local" });
const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin (reuse the same logic from seed scripts)
if (!admin.apps.length) {
  try {
    const serviceAccountPath = path.resolve(__dirname, "../firebase.json");
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (err) {
    console.error("❌ ERROR: Could not load firebase.json service account key.");
    console.error("Make sure firebase.json is inside the dashboard root directory.");
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function deleteUserByEmail(email) {
  const targetEmail = email.toLowerCase().trim();
  console.log(`\n🚨 ATTEMPTING TO DELETE OFFICER: ${targetEmail}`);

  try {
    let uidToDelete = null;

    // 1. Find User in Firebase Auth
    try {
      const authRecord = await auth.getUserByEmail(targetEmail);
      uidToDelete = authRecord.uid;
      console.log(`[AUTH] Found user in Firebase Auth with UID: ${uidToDelete}`);
      
      await auth.deleteUser(uidToDelete);
      console.log(`[AUTH] ✅ Successfully deleted from Authentication.`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`[AUTH] ⚠️ User not found in Firebase Authentication.`);
      } else {
        throw err;
      }
    }

    // 2. Delete from Firestore (if we found a UID, or we must search collections)
    if (uidToDelete) {
      // Delete from /users/{uid}
      await db.collection("users").doc(uidToDelete).delete();
      console.log(`[FIRESTORE] ✅ Deleted from 'users' collection.`);

      // Delete from /officers/{uid}
      await db.collection("officers").doc(uidToDelete).delete();
      console.log(`[FIRESTORE] ✅ Deleted from 'officers' collection.`);
    }

    // 3. Find and delete any pending registrations for this email
    const pendingQuery = await db.collection("pendingRegistrations").where("email", "==", targetEmail).get();
    if (!pendingQuery.empty) {
      const batch = db.batch();
      pendingQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[FIRESTORE] ✅ Deleted ${pendingQuery.size} associated record(s) from 'pendingRegistrations'.`);
    } else {
      console.log(`[FIRESTORE] No pending registrations found for this email.`);
    }

    console.log(`\n🎉 COMPLETION: All traces of ${targetEmail} have been wiped from the system.\n`);

  } catch (error) {
    console.error("\n❌ FATAL ERROR DURING DELETION:", error);
  }
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.log("\n❌ Usage: node scripts/deleteUser.js <email@domain.com>\n");
  process.exit(1);
}

deleteUserByEmail(targetEmail);
