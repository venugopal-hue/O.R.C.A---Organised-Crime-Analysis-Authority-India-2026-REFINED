/**
 * ORCA Account Wipe Script
 *
 * Deletes test/seed officer accounts from Catalyst + Firebase Auth.
 * Reference data (~650 rows of districts, units, ranks, etc.) is NEVER touched.
 *
 * USAGE:
 *   node scripts/wipe-accounts.js            <- dry run (shows what will be deleted)
 *   node scripts/wipe-accounts.js --confirm  <- actually deletes
 *
 * The script refuses to run if any operational table (CaseMaster, Evidence,
 * etc.) has rows, because an EmployeeID may be referenced.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envFile)) {
    console.error("ERROR: .env.local not found — cannot load Catalyst/Firebase credentials.");
    process.exit(1);
  }
  const lines = fs.readFileSync(envFile, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const DRY_RUN = !process.argv.includes("--confirm");

// ── Catalyst config ───────────────────────────────────────────────────────────
const ACCOUNTS_DOMAIN =
  process.env.ORCA_DS_ACCOUNTS_DOMAIN ||
  process.env.CATALYST_ACCOUNTS_DOMAIN ||
  "https://accounts.zoho.in";
const API_DOMAIN =
  process.env.ORCA_DS_API_DOMAIN ||
  process.env.CATALYST_API_DOMAIN ||
  "https://api.catalyst.zoho.in";
const PROJECT_ID =
  process.env.ORCA_DS_PROJECT_ID ||
  process.env.CATALYST_PROJECT_ID ||
  "42921000000067081";
const ENVIRONMENT =
  process.env.ORCA_DS_ENVIRONMENT ||
  process.env.CATALYST_ENVIRONMENT ||
  "Development";
const CLIENT_ID = process.env.ORCA_DS_CLIENT_ID || process.env.CATALYST_CLIENT_ID;
const CLIENT_SECRET = process.env.ORCA_DS_CLIENT_SECRET || process.env.CATALYST_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ORCA_DS_REFRESH_TOKEN || process.env.CATALYST_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("ERROR: Catalyst credentials missing from .env.local");
  process.exit(1);
}

let cachedToken = null;

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
  });
  const res = await fetch(`${ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60000 };
  return cachedToken.value;
}

async function catalystFetch(urlPath, init = {}) {
  const token = await getToken();
  const res = await fetch(`${API_DOMAIN}/baas/v1/project/${PROJECT_ID}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      Environment: ENVIRONMENT,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text.replace(/:\s*(\d{16,})(?=\s*[,}\]])/g, ':"$1"')) : null;
  } catch {
    throw new Error(`Catalyst non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const detail = body?.data?.message || body?.message || JSON.stringify(body);
    throw new Error(`Catalyst ${init.method || "GET"} ${urlPath} (${res.status}): ${detail}`);
  }
  return body;
}

async function getAllRows(table) {
  const rows = [];
  let nextToken = null;
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams({ max_rows: "200" });
    if (nextToken) qs.set("next_token", nextToken);
    const body = await catalystFetch(`/table/${table}/row?${qs}`);
    const list = Array.isArray(body?.data) ? body.data : [];
    rows.push(...list);
    if (!body?.more_records || !body?.next_token) break;
    nextToken = String(body.next_token);
  }
  return rows;
}

async function deleteRow(table, rowId) {
  await catalystFetch(`/table/${table}/row/${rowId}`, { method: "DELETE" });
}

// ── Firebase Admin ────────────────────────────────────────────────────────────
function initFirebase() {
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");

  if (getApps().length) return getAuth();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || !raw.trim().startsWith("{")) {
    console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_KEY missing or not JSON");
    process.exit(1);
  }
  const sa = JSON.parse(raw);
  sa.private_key = String(sa.private_key || "").replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
  initializeApp({ credential: cert(sa) });
  return getAuth();
}

// ── Operational table guard ───────────────────────────────────────────────────
const OPERATIONAL_TABLES = [
  "CaseMaster", "Evidence", "EvidenceCustody", "Accused", "Victim",
  "ComplainantDetails", "VerifiedDocument", "OfficerApplication", "Bulletin",
];

async function checkOperationalTables() {
  console.log("\n── Pre-flight: checking operational tables ──────────────────────");
  const blocked = [];
  for (const table of OPERATIONAL_TABLES) {
    let rows;
    try {
      rows = await getAllRows(table);
    } catch (e) {
      // Table may not exist yet — treat as empty
      rows = [];
    }
    const count = rows.length;
    const status = count === 0 ? "  ok   " : "  STOP ";
    console.log(`${status} ${table.padEnd(24)} ${count} rows`);
    if (count > 0) blocked.push({ table, count });
  }
  if (blocked.length) {
    console.error(
      "\nSTOPPED — the following tables have rows. An EmployeeID may be referenced." +
      "\nResolve this before wiping accounts:\n" +
      blocked.map((b) => `  ${b.table}: ${b.count} rows`).join("\n")
    );
    process.exit(1);
  }
  console.log("\nAll operational tables are empty — safe to proceed.\n");
}

// ── Reference table count (verify we never touch them) ───────────────────────
const REFERENCE_TABLES = [
  "District", "Unit", "Rank", "Court", "Section", "Designation",
  "CaseCategory", "EvidenceType", "CustodyEventType", "ReligionMaster",
  "OccupationMaster", "UnitType", "GravityOffence", "EvidenceStatus",
  "CaseStatusMaster", "State",
];

async function countReferenceTables(label) {
  let total = 0;
  const counts = [];
  for (const table of REFERENCE_TABLES) {
    let rows;
    try {
      rows = await getAllRows(table);
    } catch {
      rows = [];
    }
    total += rows.length;
    counts.push({ table, count: rows.length });
  }
  console.log(`\n── Reference data ${label} ─────────────────────────────────────`);
  for (const { table, count } of counts) {
    console.log(`  ${table.padEnd(22)} ${count} rows`);
  }
  console.log(`  ${"TOTAL".padEnd(22)} ${total} rows`);
  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log(DRY_RUN
    ? "  ORCA Account Wipe — DRY RUN (no changes will be made)"
    : "  ORCA Account Wipe — LIVE RUN");
  console.log("=".repeat(60));

  // 1. Pre-flight check
  await checkOperationalTables();

  // 2. Count reference tables before
  const refBefore = await countReferenceTables("BEFORE");

  // 3. Gather Catalyst account data
  console.log("\n── Catalyst accounts to delete ──────────────────────────────────");
  const [employees, accounts, sessions, activity, chats] = await Promise.all([
    getAllRows("Employee").catch(() => []),
    getAllRows("OfficerAccount").catch(() => []),
    getAllRows("OfficerSession").catch(() => []),
    getAllRows("OfficerActivity").catch(() => []),
    getAllRows("ChatConversation").catch(() => []),
  ]);

  if (employees.length === 0 && accounts.length === 0) {
    console.log("  No Catalyst account rows found — already clean.");
  } else {
    console.log(`  Employee         : ${employees.length} rows`);
    if (employees.length) {
      for (const e of employees) {
        const name = `${e.FirstName || ""} ${e.LastName || ""}`.trim() || "(no name)";
        console.log(`    ROWID ${String(e.ROWID).padEnd(20)} ${name}`);
      }
    }
    console.log(`  OfficerAccount   : ${accounts.length} rows`);
    if (accounts.length) {
      for (const a of accounts) {
        const uid = a.FirebaseUID || a.UID || "(no UID)";
        const email = a.Email || a.email || "(no email)";
        const role = a.DashboardRole || a.Role || "(no role)";
        console.log(`    ROWID ${String(a.ROWID).padEnd(20)} ${email.padEnd(35)} ${role}`);
        if (email.toLowerCase().includes("bhushan")) {
          console.log("    *** bhushan@orca.gov detected — confirm this is a seed account, not real staff ***");
        }
      }
    }
    console.log(`  OfficerSession   : ${sessions.length} rows`);
    console.log(`  OfficerActivity  : ${activity.length} rows`);
    console.log(`  ChatConversation : ${chats.length} rows`);
  }

  // 4. Gather Firebase Auth users
  console.log("\n── Firebase Auth users to delete ────────────────────────────────");
  const auth = initFirebase();
  const firebaseUsers = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    firebaseUsers.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  if (firebaseUsers.length === 0) {
    console.log("  No Firebase Auth users found — already clean.");
  } else {
    for (const u of firebaseUsers) {
      const role = u.customClaims?.dashboardRole || u.customClaims?.role || "(no role claim)";
      console.log(`  UID ${u.uid.padEnd(30)} ${(u.email || "(no email)").padEnd(38)} ${role}`);
    }
  }

  if (DRY_RUN) {
    console.log("\n" + "─".repeat(60));
    console.log("DRY RUN complete. Nothing was deleted.");
    console.log("Review the list above, then run:");
    console.log("  node scripts/wipe-accounts.js --confirm");
    console.log("─".repeat(60));
    return;
  }

  // ── LIVE DELETE ───────────────────────────────────────────────────────────
  console.log("\n── Deleting Catalyst rows ───────────────────────────────────────");

  for (const row of activity) {
    await deleteRow("OfficerActivity", row.ROWID);
    console.log(`  deleted OfficerActivity  ${row.ROWID}`);
  }
  for (const row of sessions) {
    await deleteRow("OfficerSession", row.ROWID);
    console.log(`  deleted OfficerSession   ${row.ROWID}`);
  }
  for (const row of chats) {
    await deleteRow("ChatConversation", row.ROWID);
    console.log(`  deleted ChatConversation ${row.ROWID}`);
  }
  for (const row of accounts) {
    await deleteRow("OfficerAccount", row.ROWID);
    console.log(`  deleted OfficerAccount   ${row.ROWID}`);
  }
  for (const row of employees) {
    await deleteRow("Employee", row.ROWID);
    console.log(`  deleted Employee         ${row.ROWID}`);
  }

  console.log("\n── Deleting Firebase Auth users ─────────────────────────────────");
  for (const u of firebaseUsers) {
    await auth.deleteUser(u.uid);
    console.log(`  deleted UID ${u.uid}   ${u.email || ""}`);
  }

  // Verify reference tables untouched
  const refAfter = await countReferenceTables("AFTER");

  console.log("\n" + "=".repeat(60));
  if (refBefore === refAfter) {
    console.log(`  Reference data: ${refBefore} rows BEFORE = ${refAfter} rows AFTER (unchanged)`);
  } else {
    console.error(`  WARNING: reference row count changed! ${refBefore} -> ${refAfter}`);
  }
  console.log("  Account wipe complete.");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
