const { initializeApp: initializeAdminApp, getApps: getAdminApps, cert } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { initializeApp: initializeClientApp } = require("firebase/app");
const { getAuth: getClientAuth, signInWithEmailAndPassword } = require("firebase/auth");
const fs = require("fs");
const path = require("path");

// Load .env.local manually if running via plain node
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

async function runDiagnostics() {
  console.log("==========================================================");
  console.log("🔍 O.R.C.A AUTH DIAGNOSTIC SCRIPT (checkAuthSetup.js)");
  console.log("==========================================================\n");

  // 1. Initialize Client SDK
  const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  console.log("▶ [Frontend Client SDK Config]:");
  console.log("  Project ID:", clientConfig.projectId);
  console.log("  API Key   :", clientConfig.apiKey ? clientConfig.apiKey.substring(0, 10) + "..." : "MISSING");
  console.log("  AuthDomain:", clientConfig.authDomain);

  const clientApp = initializeClientApp(clientConfig, "clientApp");
  let clientAuth;
  try {
    clientAuth = getClientAuth(clientApp);
  } catch (authErr) {
    console.error("  ❌ Client Auth init error:", authErr.message);
  }

  // 2. Initialize Admin SDK
  let adminApp;
  let adminProjectId = "MISSING";
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(__dirname, "../../firebase.json");
  
  if (fs.existsSync(saPath)) {
    const saContent = JSON.parse(fs.readFileSync(saPath, "utf-8"));
    adminProjectId = saContent.project_id;
    adminApp = initializeAdminApp({
      credential: cert(saPath),
      projectId: adminProjectId
    }, "adminApp");
    console.log("\n▶ [Backend Admin SDK Config (from service account key)]:");
    console.log("  Service Account Path:", saPath);
    console.log("  Project ID          :", adminProjectId);
    console.log("  Client Email        :", saContent.client_email);
  } else {
    console.log("\n▶ [Backend Admin SDK Config]:");
    console.error("  ❌ Service Account file not found at:", saPath);
  }

  // 3. Project ID Comparison
  console.log("\n==========================================================");
  console.log("⚖️ PROJECT ID MISMATCH CHECK");
  console.log("==========================================================");
  console.log(`Frontend Client SDK Project ID : "${clientConfig.projectId}"`);
  console.log(`Backend Admin SDK Project ID   : "${adminProjectId}"`);
  if (clientConfig.projectId === adminProjectId && clientConfig.projectId !== undefined) {
    console.log("✅ STATUS: IDENTICAL — Both client and admin SDKs point to exact same project.");
  } else {
    console.error("❌ STATUS: MISMATCH — Client and admin SDKs are pointing to different projects!");
  }

  // 4. List Existing Users via Admin SDK
  if (adminApp) {
    console.log("\n==========================================================");
    console.log("👥 CURRENT USERS IN FIREBASE AUTH (via Admin SDK)");
    console.log("==========================================================");
    const adminAuthInstance = getAdminAuth(adminApp);
    const listUsersResult = await adminAuthInstance.listUsers(50);
    console.log(`Found ${listUsersResult.users.length} total user(s) in project "${adminProjectId}":`);
    
    for (const userRecord of listUsersResult.users) {
      console.log(`  • Email: ${userRecord.email?.padEnd(30)} | UID: ${userRecord.uid}`);
      console.log(`    Custom Claims:`, JSON.stringify(userRecord.customClaims || {}));
    }
  }

  // 5. Direct Client SDK Authentication Test
  console.log("\n==========================================================");
  console.log("🔑 DIRECT signInWithEmailAndPassword TEST (via Client SDK)");
  console.log("==========================================================");
  
  const testAccounts = [
    { email: "admin2@orca.gov", password: "Password123!" },
    { email: "scrbadmin@orca.gov", password: "Password123!" },
    { email: "rajeev.kumar@orca.test", password: "Demo@12345" }
  ];

  if (clientAuth) {
    for (const acc of testAccounts) {
      process.stdout.write(`Testing login for "${acc.email}" ... `);
      try {
        const userCred = await signInWithEmailAndPassword(clientAuth, acc.email, acc.password);
        console.log(`✅ SUCCESS (UID: ${userCred.user.uid})`);
      } catch (err) {
        console.log(`❌ FAILED -> [${err.code}]: ${err.message}`);
      }
    }
  } else {
    console.log("Skipping direct signInWithEmailAndPassword test due to Client Auth init error.");
  }

  console.log("\n==========================================================");
}

runDiagnostics().catch(err => {
  console.error("Fatal diagnostic error:", err);
  process.exit(1);
});
