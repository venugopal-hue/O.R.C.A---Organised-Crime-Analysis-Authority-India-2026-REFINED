require("dotenv").config({ path: "../.env.local" });
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

if (getApps().length === 0) {
  const serviceAccount = require(path.resolve(__dirname, "../firebase.json"));
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function checkPending() {
  const snap = await db.collection("pendingRegistrations").get();
  console.log(`TOTAL DOCUMENTS IN pendingRegistrations: ${snap.size}`);
  
  let pendingCount = 0;
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- [${doc.id}] Email: ${data.email} | Status: ${data.status} | Name: ${data.name}`);
    if (data.status === "pending") pendingCount++;
  });
  console.log(`TOTAL WITH status === "pending": ${pendingCount}`);
  process.exit(0);
}
checkPending();
