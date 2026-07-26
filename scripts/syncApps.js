const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

if (getApps().length === 0) {
  const serviceAccount = require(path.resolve(__dirname, "../../firebase.json"));
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function syncProfiles() {
  try {
    const pendingSnap = await db.collection("pendingRegistrations").get();
    
    if (pendingSnap.empty) {
      console.log("No pending registrations found to sync.");
      process.exit(0);
    }
    
    let syncedCount = 0;
    for (const doc of pendingSnap.docs) {
      const data = doc.data();
      const uid = doc.id;
      
      const appRef = db.collection("officer_applications").doc(uid);
      const appSnap = await appRef.get();
      
      if (!appSnap.exists) {
        console.log(`Syncing missing profile to officer_applications: ${data.email || uid}`);
        
        // Reconstruct appData from pendingData as best as possible
        const appData = {
          id: uid,
          firstName: data.firstName || "Unknown",
          lastName: data.lastName || "Unknown",
          name: data.name || "Unknown Officer",
          email: data.email || "",
          badgeId: data.badgeId || "",
          rank: data.rank || "",
          station: data.station || "",
          district: data.district || "",
          postingType: data.postingType || "",
          mobile: data.mobile || "",
          requestedAccess: data.requestedAccess || "",
          submittedAt: data.submittedAt || new Date().toISOString(),
          status: data.status || "pending",
          priority: data.priority || "MEDIUM",
          hasPassword: true,
          photoUrl: data.photoUrl || "",
          timeline: [
            { status: "applied", date: new Date().toISOString(), remarks: "Application recovered and synced via admin override." }
          ],
          internalRemarks: "",
          assignedReviewer: "",
          securityClearance: "None",
          bgVerification: "pending",
          deptVerification: "pending",
          supervisorApproval: "pending"
        };
        
        await appRef.set(appData, { merge: true });
        syncedCount++;
      }
    }
    console.log(`Successfully synced ${syncedCount} missing profiles into officer_applications.`);
    process.exit(0);
  } catch (err) {
    console.error("Error syncing profiles:", err);
    process.exit(1);
  }
}

syncProfiles();
