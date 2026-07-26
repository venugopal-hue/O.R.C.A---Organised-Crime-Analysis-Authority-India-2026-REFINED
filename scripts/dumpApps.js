const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("path");

if (getApps().length === 0) {
  const serviceAccount = require(path.resolve(__dirname, "../../firebase.json"));
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function checkApps() {
  const snap = await db.collection("officer_applications").get();
  console.log(`TOTAL DOCUMENTS IN officer_applications: ${snap.size}`);
  snap.forEach(doc => {
    console.log(`- [${doc.id}] Name: ${doc.data().name}`);
  });
  process.exit(0);
}
checkApps();
