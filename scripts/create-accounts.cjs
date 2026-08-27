/**
 * ORCA Account Creation Script
 * Creates 14 Employee + OfficerAccount rows in Catalyst and sets Firebase custom claims.
 *
 * USAGE:
 *   node scripts/create-accounts.cjs            <- dry run
 *   node scripts/create-accounts.cjs --confirm  <- actually creates
 */
"use strict";

const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");

// ── Load env ──────────────────────────────────────────────────────────────────
const envLines = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
for (const l of envLines) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq < 0) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const DRY_RUN = !process.argv.includes("--confirm");

// ── Firebase Admin ────────────────────────────────────────────────────────────
function initFirebase() {
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  if (getApps().length) return getAuth();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const sa = JSON.parse(raw);
  sa.private_key = String(sa.private_key || "").replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
  return getAuth();
}

// ── Catalyst via jiti ─────────────────────────────────────────────────────────
const { createJiti } = require(path.join(ROOT, "node_modules/jiti"));
const jiti = createJiti(__filename, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });

// ── Avatar URL helpers ────────────────────────────────────────────────────────
// For demo/ORCA accounts: gradient avatar (matches the Instagram-style image the user chose)
// For police accounts: navy initials avatar
const gradientAvatar = (name) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=ff6b35,e91e63,9c27b0&backgroundType=gradientLinear&fontFamily=Arial&fontSize=40&fontWeight=700&textColor=ffffff&size=200`;

const navyAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001f3f&color=ffffff&size=200&bold=true&rounded=true`;

// ── The 14 accounts ───────────────────────────────────────────────────────────
// RankIDs: 1=DGP 2=ADGP 3=IGP 4=DIGP 5=SP 6=ASP 7=DSP 8=Inspector 9=SI 10=ASI 11=Constable
// Districts: 5=Bengaluru Urban
// Units: 201=ISD Central Command 202=SCRB 29=Koramangala PS 32=Indiranagar PS 14=Jayanagar PS

const ACCOUNTS = [
  {
    uid: "AlzTFBOUyJZB1O1FhxoNZXVkgnl2",
    email: "owner@orca.gov",
    role: "orca_owner",
    clearance: "ORCA-LEVEL-I",
    name: "Arjun Mehta",
    kgid: "ORCA-001",
    rankId: 3,       // IGP — senior enough for system owner
    districtId: 5,   // Bengaluru Urban
    unitId: 201,     // ISD Central Command
    mobile: "+91-80-22201001",
    avatar: "gradient",
  },
  {
    uid: "y12wCoHPJNerkFyZawMtRrcHKtz1",
    email: "engineer@orca.gov",
    role: "orca_engineer",
    clearance: "ORCA-LEVEL-II",
    name: "Priya Krishnamurthy",
    kgid: "ORCA-002",
    rankId: 8,
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22201002",
    avatar: "gradient",
  },
  {
    uid: "3HVXWlo0hpOHcM3BYKXTXjNnhul2",
    email: "support@orca.gov",
    role: "orca_support",
    clearance: "ORCA-LEVEL-III",
    name: "Rajan Shetty",
    kgid: "ORCA-003",
    rankId: 9,
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22201003",
    avatar: "gradient",
  },
  {
    uid: "U5b5kNZHzYUICiry3udUbHfumnE3",
    email: "demo@orca.gov",
    role: "orca_demo",
    clearance: "ORCA-LEVEL-IV",
    name: "Demo Account",
    kgid: "ORCA-004",
    rankId: 8,
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22201004",
    avatar: "gradient",
  },
  {
    uid: "1jhXnLmgNDaRvE3ZtuLp6SvGMrf1",
    email: "command1@orca.gov",
    role: "command_admin_l1",
    clearance: "ISD-LEVEL-I",
    name: "Suresh Babu R",
    kgid: "KA-10045",
    rankId: 1,       // DGP
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202001",
    avatar: "navy",
  },
  {
    uid: "dLJijUaH3SSk1fWpHvpPINVfdWW2",
    email: "command2@orca.gov",
    role: "command_admin_l2",
    clearance: "ISD-LEVEL-II",
    name: "Madhavi K Nair",
    kgid: "KA-10089",
    rankId: 3,       // IGP
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202002",
    avatar: "navy",
  },
  {
    uid: "w3folg4NLTgwMwMDj3RHvOmZD0g1",
    email: "verification2@orca.gov",
    role: "verification_admin_l2",
    clearance: "ISD-LEVEL-II",
    name: "Karthik Reddy S",
    kgid: "KA-11234",
    rankId: 5,       // SP
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202003",
    avatar: "navy",
  },
  {
    uid: "WCW0poDiOjhX6CvM2UDOUES2zkF2",
    email: "verification3@orca.gov",
    role: "verification_admin_l3",
    clearance: "ISD-LEVEL-III",
    name: "Nandini Sharma",
    kgid: "KA-11567",
    rankId: 7,       // DSP
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202004",
    avatar: "navy",
  },
  {
    uid: "Cvj016Fd95aWMZz6rRYHr90CrpP2",
    email: "itsecurity@orca.gov",
    role: "it_admin",
    clearance: "ISD-LEVEL-III",
    name: "Rajesh Kumar T",
    kgid: "KA-12890",
    rankId: 8,       // Inspector
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202005",
    avatar: "navy",
  },
  {
    uid: "wgZ5NmtWLVMfY3wqLcmaltdlyZW2",
    email: "verification@orca.gov",
    role: "admin_verification",
    clearance: "ISD-LEVEL-III",
    name: "Lakshmi Devi B",
    kgid: "KA-13456",
    rankId: 10,      // ASI
    districtId: 5,
    unitId: 201,
    mobile: "+91-80-22202006",
    avatar: "navy",
  },
  {
    uid: "rWhXq90n27bFzZTgvQAJFgaZWjS2",
    email: "investigator@orca.gov",
    role: "investigation_l2",
    clearance: "ISD-LEVEL-III",
    name: "Vikram Naik P",
    kgid: "KA-14789",
    rankId: 9,       // SI
    districtId: 5,
    unitId: 29,      // Koramangala PS
    mobile: "+91-80-22203001",
    avatar: "navy",
  },
  {
    uid: "X5jqgbUbCJcBdBd6lbsrqeKMmPA2",
    email: "field3@orca.gov",
    role: "field_officer_l3",
    clearance: "ISD-LEVEL-III",
    name: "Deepak Gowda M",
    kgid: "KA-15012",
    rankId: 10,      // ASI
    districtId: 5,
    unitId: 32,      // Indiranagar PS
    mobile: "+91-80-22203002",
    avatar: "navy",
  },
  {
    uid: "sloAYfJ3xng8JgDTkdBBRhNtk4x2",
    email: "field4@orca.gov",
    role: "field_officer_l4",
    clearance: "ISD-LEVEL-IV",
    name: "Anand Kumar H",
    kgid: "KA-16345",
    rankId: 11,      // Constable
    districtId: 5,
    unitId: 14,      // Jayanagar PS
    mobile: "+91-80-22203003",
    avatar: "navy",
  },
  {
    uid: "6TJWclYekqgSfZ41Vn1Eqng1i4r2",
    email: "scrb@orca.gov",
    role: "scrb_officer",
    clearance: "CRB-LEVEL-I",
    name: "Meena Patil G",
    kgid: "KA-17678",
    rankId: 10,      // ASI
    districtId: 5,
    unitId: 202,     // SCRB
    mobile: "+91-80-22204001",
    avatar: "navy",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { createEmployee } = await jiti.import(path.join(ROOT, "src/lib/adminData.ts"));
  const { upsertOfficerAccount } = await jiti.import(path.join(ROOT, "src/lib/officerAccount.ts"));
  const auth = initFirebase();

  console.log("=".repeat(60));
  console.log(DRY_RUN
    ? "  ORCA Account Creation — DRY RUN"
    : "  ORCA Account Creation — LIVE RUN");
  console.log("=".repeat(60));

  for (const acc of ACCOUNTS) {
    const photoUrl = acc.avatar === "gradient"
      ? gradientAvatar(acc.name)
      : navyAvatar(acc.name);

    const firstParts = acc.name.split(" ");
    const firstName = firstParts.slice(0, -1).join(" ") || acc.name;
    const lastName = firstParts.slice(-1)[0] || "";

    console.log(`\n── ${acc.email} (${acc.role} / ${acc.clearance})`);
    console.log(`   Name    : ${acc.name}`);
    console.log(`   KGID    : ${acc.kgid}`);
    console.log(`   RankID  : ${acc.rankId}`);
    console.log(`   District: ${acc.districtId}  Unit: ${acc.unitId}`);
    console.log(`   UID     : ${acc.uid}`);
    console.log(`   Avatar  : ${photoUrl.slice(0, 80)}…`);

    if (DRY_RUN) continue;

    // 1. Create Employee row (uses adminData.createEmployee — exact same path as officer approval)
    const { employeeId, kgid: assignedKgid } = await createEmployee({
      firstName: acc.name,
      kgid: acc.kgid,
      rankId: acc.rankId,
      districtId: acc.districtId,
      unitId: acc.unitId,
    });
    console.log(`   ✓ Employee row created  EmployeeID=${employeeId}  KGID=${assignedKgid}`);

    // 2. Create OfficerAccount row
    const { created, accountId } = await upsertOfficerAccount(acc.uid, {
      employeeId,
      email: acc.email,
      mobile: acc.mobile,
      dashboardRole: acc.role,
      clearanceLevel: acc.clearance,
      active: true,
      accountStatus: "active",
      photoUrl,
    });
    console.log(`   ✓ OfficerAccount ${created ? "created" : "updated"}  AccountID=${accountId}`);

    // 3. Firebase custom claim
    try {
      await auth.setCustomUserClaims(acc.uid, {
        dashboardRole: acc.role,
        isdLevel: acc.clearance,
      });
      console.log(`   ✓ Firebase claims set`);
    } catch (fbErr) {
      console.warn(`   ⚠ Firebase claims skipped — user not found yet (create in Firebase console first)`);
    }
  }

  if (DRY_RUN) {
    console.log("\n" + "─".repeat(60));
    console.log("DRY RUN complete. Nothing was created.");
    console.log("Run with --confirm to create these accounts.");
    console.log("─".repeat(60));
  } else {
    console.log("\n" + "=".repeat(60));
    console.log("  All 14 accounts created successfully.");
    console.log("=".repeat(60));
  }
}

main().catch((e) => { console.error("\nFATAL:", e.message); process.exit(1); });
