/**
 * O.R.C.A — Zoho Catalyst Data Store access layer (SERVER-SIDE ONLY).
 *
 * This module is the single place the platform talks to Catalyst. When the
 * migration off Firebase completes, only this file changes.
 *
 * AUTHENTICATION IS THE SAME EVERYWHERE, INCLUDING ON APPSAIL.
 *
 * This module does NOT use `zcatalyst-sdk-node`, so it never picks up
 * credentials from an AppSail request context. It exchanges the Self Client
 * refresh token below over plain HTTP, in every environment.
 *
 * That matters at deploy time: `.env.local` is git-ignored and is NOT shipped,
 * so CATALYST_CLIENT_ID, CATALYST_CLIENT_SECRET and CATALYST_REFRESH_TOKEN must
 * be set as environment variables on the AppSail app itself. Without them
 * `isCatalystConfigured()` is false and every screen in the console renders its
 * "not connected" state — an outage that looks like an empty database.
 *
 * (An earlier version of this comment claimed the opposite: that AppSail
 * authenticates from the request and these variables are ignored. It is wrong,
 * and acting on it would deploy an app that cannot read a single row.)
 *
 * Never import this from a client component — it holds secrets.
 */

/**
 * EACH SETTING HAS TWO ACCEPTABLE NAMES.
 *
 * The AppSail console refuses environment variable names that contain its own
 * reserved keywords, so `CATALYST_CLIENT_ID` and its siblings cannot be
 * entered there at all — the console answers "should not contain keywords".
 * The `ORCA_DS_*` names carry exactly the same values and are accepted.
 *
 * Both are read, `ORCA_DS_*` first, so:
 *   - a deployed service uses the names the console will actually accept;
 *   - `.env.local` keeps working unchanged for local development;
 *   - neither has to be migrated in a hurry.
 *
 * "DS" is Data Store. The word Catalyst is deliberately absent from the name.
 */
const envAny = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
};

const ACCOUNTS_DOMAIN =
  envAny("ORCA_DS_ACCOUNTS_DOMAIN", "CATALYST_ACCOUNTS_DOMAIN") || "https://accounts.zoho.in";
const API_DOMAIN =
  envAny("ORCA_DS_API_DOMAIN", "CATALYST_API_DOMAIN") || "https://api.catalyst.zoho.in";
const PROJECT_ID = envAny("ORCA_DS_PROJECT_ID", "CATALYST_PROJECT_ID") || "42921000000067081";
const ENVIRONMENT = envAny("ORCA_DS_ENVIRONMENT", "CATALYST_ENVIRONMENT") || "Development";

const CLIENT_ID = envAny("ORCA_DS_CLIENT_ID", "CATALYST_CLIENT_ID");
const CLIENT_SECRET = envAny("ORCA_DS_CLIENT_SECRET", "CATALYST_CLIENT_SECRET");
const REFRESH_TOKEN = envAny("ORCA_DS_REFRESH_TOKEN", "CATALYST_REFRESH_TOKEN");

/** Thrown when Catalyst credentials are absent, so callers can degrade gracefully. */
export class CatalystNotConfiguredError extends Error {
  constructor() {
    super(
      "Catalyst credentials are not set. Locally, add CATALYST_CLIENT_ID, " +
        "CATALYST_CLIENT_SECRET and CATALYST_REFRESH_TOKEN to .env.local. On an " +
        "AppSail service use ORCA_DS_CLIENT_ID, ORCA_DS_CLIENT_SECRET and " +
        "ORCA_DS_REFRESH_TOKEN instead — the console rejects names containing its " +
        "own reserved keywords."
    );
    this.name = "CatalystNotConfiguredError";
  }
}

export function isCatalystConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

// ── Access token cache ──────────────────────────────────────────────────────
// Access tokens live ~1 hour. Cache and refresh a minute before expiry so a
// burst of dropdown lookups does not trigger a token exchange each time.
let cachedToken: { value: string; expiresAt: number } | null = null;

// De-duplicates concurrent refreshes. Without this, a page that fires N
// parallel lookups on a cold cache starts N token exchanges at once — Zoho
// rate-limits the OAuth endpoint hard, several fail, and their tables come back
// silently empty. All callers now await the same in-flight exchange.
let inFlight: Promise<string> | null = null;

async function getAccessToken(): Promise<string> {
  if (!isCatalystConfigured()) throw new CatalystNotConfiguredError();

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  if (inFlight) return inFlight;

  inFlight = exchangeRefreshToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function exchangeRefreshToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID as string,
    client_secret: CLIENT_SECRET as string,
    refresh_token: REFRESH_TOKEN as string,
  });

  const res = await fetch(`${ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Catalyst token exchange failed (${res.status}): ${data.error || JSON.stringify(data)}`
    );
  }

  const ttlSeconds = Number(data.expires_in) || 3600;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (ttlSeconds - 60) * 1000,
  };
  return cachedToken.value;
}

async function catalystFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${API_DOMAIN}/baas/v1/project/${PROJECT_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      Environment: ENVIRONMENT,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: any = null;
  try {
    // Catalyst returns ids as UNQUOTED JSON numbers around 4.3e16 - well past
    // Number.MAX_SAFE_INTEGER - so a plain JSON.parse silently ROUNDS them. The
    // id comes back a few digits off and a later call on it 404s while the
    // record quietly survives.
    //
    // This was originally patched for ROWID only. It is NOT only ROWID: the
    // File Store returns `id` the same way, and the rounding made every upload
    // and download fail with INVALID_ID (folder ...143871 parsed as ...143870;
    // file ids came back 2-6 out). Any integer of 16+ digits is already
    // unrepresentable in JavaScript, so quoting every one of them is strictly
    // safer than letting it round.
    body = text ? JSON.parse(text.replace(/:\s*(\d{16,})(?=\s*[,}\]])/g, ':"$1"')) : null;
  } catch {
    throw new Error(`Catalyst returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail = body?.data?.message || body?.message || JSON.stringify(body);
    throw new Error(`Catalyst ${init.method || "GET"} ${path} failed (${res.status}): ${detail}`);
  }
  // Return the whole envelope — callers need `next_token` / `more_records` too.
  return body;
}

// ── Row operations ──────────────────────────────────────────────────────────

/** Catalyst rejects max_rows values above a few hundred. */
const PAGE_SIZE = 200;

// ── Table read cache ────────────────────────────────────────────────────────
/**
 * Without ZCQL there is no WHERE clause, so every read is a full-table scan
 * filtered in process. One screen used to trigger the same scan repeatedly:
 * /api/officer/profile alone reads six tables, and the settings tab called it
 * alongside /api/officer/telemetry (which scanned OfficerActivity twice) while
 * useActiveSession fetched telemetry again on its own.
 *
 * Caching the raw rows briefly collapses that burst into one scan per table.
 * Writes invalidate their own table, so a freshly inserted row is never hidden.
 */
const rowCache = new Map<string, { rows: any[]; expiresAt: number }>();

/**
 * Reference data - the ER diagram's lookup tables. These change when someone
 * loads a new dataset, not during a shift, so they tolerate a long TTL. They
 * are also the expensive ones: Section is 929 rows across 5 pages.
 */
const REFERENCE_TABLES = new Set([
  "Rank", "Designation", "Unit", "UnitType", "District", "State",
  "Section", "Act", "CrimeHead", "CrimeSubHead", "CasteMaster",
]);

const REFERENCE_TTL_MS = 10 * 60 * 1000;
/**
 * Short enough that an officer never reads a stale audit trail - a write
 * invalidates immediately anyway - but long enough to collapse the several
 * reads that make up a single screen.
 */
const TRANSACTIONAL_TTL_MS = 5 * 1000;

const ttlFor = (table: string) =>
  REFERENCE_TABLES.has(table) ? REFERENCE_TTL_MS : TRANSACTIONAL_TTL_MS;

/** De-duplicates concurrent scans of the same table into one request. */
const inFlightScans = new Map<string, Promise<any[]>>();

/**
 * Generation counter per table, bumped on every write.
 *
 * Clearing the cache is not enough on its own: a scan that STARTED before the
 * write will still resolve afterwards and cache its now-stale rows. That is not
 * theoretical - it was seen live, where an evidence item moved to "Sent to FSL"
 * and the very next read reported it still in custody. The scan records the
 * generation it began in and refuses to cache if a write has landed since.
 */
const generation = new Map<string, number>();
const genOf = (t: string) => generation.get(t) ?? 0;

/** Drop a table's cached rows. Called by every write path. */
export function invalidateTable(tableName: string): void {
  rowCache.delete(tableName);
  generation.set(tableName, genOf(tableName) + 1);
}

/** Drop everything. Used by scripts that reload reference data. */
export function invalidateAllTables(): void {
  for (const t of rowCache.keys()) generation.set(t, genOf(t) + 1);
  rowCache.clear();
}

/**
 * Read every row of a table, following Catalyst's cursor pagination.
 *
 * Catalyst does NOT accept a `page` parameter — passing one returns HTTP 400.
 * It returns `next_token` and `more_records` instead, which is what we follow.
 */
export async function getAllRows(tableName: string, maxPages = 50): Promise<any[]> {
  const cached = rowCache.get(tableName);
  if (cached && Date.now() < cached.expiresAt) return cached.rows;

  // Two requests arriving together must not each start their own scan.
  const running = inFlightScans.get(tableName);
  if (running) return running;

  const startedAt = genOf(tableName);
  const scan = scanAllRows(tableName, maxPages)
    .then((rows) => {
      // Only cache if no write landed while this scan was running.
      if (genOf(tableName) === startedAt) {
        rowCache.set(tableName, { rows, expiresAt: Date.now() + ttlFor(tableName) });
      }
      return rows;
    })
    .finally(() => {
      inFlightScans.delete(tableName);
    });

  inFlightScans.set(tableName, scan);
  return scan;
}

async function scanAllRows(tableName: string, maxPages: number): Promise<any[]> {
  const rows: any[] = [];
  let nextToken: string | null = null;

  for (let i = 0; i < maxPages; i++) {
    const qs = new URLSearchParams({ max_rows: String(PAGE_SIZE) });
    if (nextToken) qs.set("next_token", nextToken);

    const body = await catalystFetch(`/table/${tableName}/row?${qs.toString()}`);
    const list: any[] = Array.isArray(body?.data) ? body.data : [];
    rows.push(...list);

    if (!body?.more_records || !body?.next_token) break;
    nextToken = String(body.next_token);
  }
  return rows;
}

/**
 * Insert one or more rows. Returns the created rows including their ROWIDs
 * (as strings - see the ROWID note in catalystFetch).
 */
export async function insertRows(tableName: string, rows: Record<string, any>[]): Promise<any[]> {
  if (!rows.length) return [];
  const created: any[] = [];
  // Catalyst caps a single insert call; chunk to stay well inside it.
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const body = await catalystFetch(`/table/${tableName}/row`, {
      method: "POST",
      body: JSON.stringify(chunk),
    });
    invalidateTable(tableName);
    const data = body?.data;
    created.push(...(Array.isArray(data) ? data : [data]));
  }
  return created;
}

/**
 * Update one or more existing rows. Each row MUST carry its ROWID - Catalyst
 * identifies the target by it and rejects the call otherwise.
 */
export async function updateRows(tableName: string, rows: Record<string, any>[]): Promise<any[]> {
  if (!rows.length) return [];
  const updated: any[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const body = await catalystFetch(`/table/${tableName}/row`, {
      method: "PATCH",
      body: JSON.stringify(chunk),
    });
    invalidateTable(tableName);
    const data = body?.data;
    updated.push(...(Array.isArray(data) ? data : [data]));
  }
  return updated;
}

/**
 * Delete a single row by ROWID.
 *
 * Catalyst accepts the table NAME here; the id-based form
 * (`/table/{table_id}/row/{rowid}`) also works and is what the cleanup scripts
 * fall back to. Returns true when the row is gone.
 */
export async function deleteRow(tableName: string, rowId: string | number): Promise<boolean> {
  if (!rowId) return false;
  try {
    await catalystFetch(`/table/${tableName}/row/${rowId}`, { method: "DELETE" });
    invalidateTable(tableName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Highest existing value of a numeric column, used to allocate the next
 * business ID (CaseMasterID, VictimMasterID, ...). Catalyst assigns ROWID
 * automatically, but the schema's own IDs are ours to manage.
 *
 * Implemented over the row API rather than ZCQL: the Self Client token is
 * scoped to ZohoCatalyst.tables.* only, and /query returns OAUTH_SCOPE_MISMATCH
 * without ZohoCatalyst.zcql.READ. Fine at current volumes; if CaseMaster grows
 * large, add the zcql scope and switch this to SELECT MAX(...).
 *
 * LIMITATION, stated rather than hidden: serialising here removes the race
 * WITHIN one server process, which is what produced the duplicate SessionID in
 * OfficerSession. Two AppSail instances allocating at the same instant can
 * still collide. A real fix needs an identifier the database owns - either
 * Catalyst's own ROWID, or a dedicated counter row updated conditionally.
 */
const idLocks = new Map<string, Promise<unknown>>();

export async function nextId(tableName: string, idColumn: string): Promise<number> {
  // Serialise allocations for this table. OfficerSession already contains two
  // rows that both claim SessionID 1 - two overlapping sign-ins each read the
  // maximum before either had written. Queueing removes that window within a
  // process.
  const key = `${tableName}.${idColumn}`;
  const previous = idLocks.get(key) || Promise.resolve();
  const run = previous.then(() => allocateId(tableName, idColumn), () => allocateId(tableName, idColumn));
  idLocks.set(key, run.catch(() => undefined));
  return run;
}

async function allocateId(tableName: string, idColumn: string): Promise<number> {
  try {
    // Deliberately NOT the cached read: allocating from rows that may be
    // seconds old is exactly how two callers pick the same number.
    invalidateTable(tableName);
    const rows = await getAllRows(tableName);
    let max = 0;
    for (const r of rows) {
      const rec = r[tableName] || r;
      const v = Number(rec?.[idColumn]);
      if (Number.isFinite(v) && v > max) max = v;
    }
    return max + 1;
  } catch {
    return 1;
  }
}

export const CATALYST_META = { PROJECT_ID, ENVIRONMENT, API_DOMAIN };

// ── File Store ──────────────────────────────────────────────────────────────
/**
 * Catalyst File Store, used by Evidence Registration for photos, videos and
 * PDFs.
 *
 * Chosen over Firebase Storage deliberately: Catalyst is the India DC
 * (api.catalyst.zoho.in), and for evidence carrying a chain of custody, where
 * the bytes physically live is a legal question rather than a convenience one.
 *
 * Verified end to end before anything was built on it - upload, download and
 * delete, with SHA-256 matching byte for byte on a 3 MB payload.
 *
 * NOTE: file and folder ids are 17-digit numbers. They MUST stay strings - see
 * the parsing note in catalystFetch. Passing a rounded id yields
 * "404 INVALID_ID" while the file sits happily in the folder.
 */

/** Folder that holds evidence attachments. Created once, in the console/setup. */
export const EVIDENCE_FOLDER_ID =
  envAny("ORCA_DS_EVIDENCE_FOLDER_ID", "CATALYST_EVIDENCE_FOLDER_ID") || "42921000000143871";

export interface StoredFile {
  id: string;
  name: string;
  size: number;
}

/** Upload one file. `data` is the raw bytes. */
export async function uploadFile(
  folderId: string,
  fileName: string,
  data: Buffer | Uint8Array | ArrayBuffer,
  mimeType = "application/octet-stream"
): Promise<StoredFile> {
  const token = await getAccessToken();
  const form = new FormData();
  // Catalyst expects the multipart part to be named "code".
  form.append("code", new Blob([data as BlobPart], { type: mimeType }), fileName);

  const res = await fetch(`${API_DOMAIN}/baas/v1/project/${PROJECT_ID}/folder/${folderId}/file`, {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Environment: ENVIRONMENT },
    body: form,
    cache: "no-store",
  });

  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text.replace(/:\s*(\d{16,})(?=\s*[,}\]])/g, ':"$1"'));
  } catch {
    throw new Error(`File Store returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`File upload failed (${res.status}): ${body?.data?.message || JSON.stringify(body)}`);
  }

  const d = body?.data || {};
  return { id: String(d.id), name: String(d.file_name || fileName), size: Number(d.file_size) || 0 };
}

/** Download one file's bytes. */
export async function downloadFile(folderId: string, fileId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(
    `${API_DOMAIN}/baas/v1/project/${PROJECT_ID}/folder/${folderId}/file/${fileId}/download`,
    { headers: { Authorization: `Zoho-oauthtoken ${token}`, Environment: ENVIRONMENT }, cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`File download failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Delete one file. Returns true when it is gone. */
export async function deleteFile(folderId: string, fileId: string): Promise<boolean> {
  try {
    await catalystFetch(`/folder/${folderId}/file/${fileId}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}
