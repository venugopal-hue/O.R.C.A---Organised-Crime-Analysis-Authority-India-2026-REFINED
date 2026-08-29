/**
 * O.R.C.A — officer session and activity telemetry on Catalyst (SERVER-SIDE).
 *
 * Backs the Officer Audit Profile screen, which previously showed hardcoded
 * download and AI-query rows and kept login history in `localStorage` (so it
 * was per-browser and vanished when an officer changed machine).
 *
 * Every write takes the officer's UID from the verified session. The old
 * /api/auth/session-log accepted `uid`, `email` and `name` from the request
 * body with no authentication at all, which made the audit trail forgeable by
 * anyone who could reach the URL. Same rule as SEC-05.
 */

import {
  getAllRows,
  insertRows,
  updateRows,
  isCatalystConfigured,
  nextId,
} from "@/lib/catalyst";

export const SESSION_TABLE = "OfficerSession";
export const ACTIVITY_TABLE = "OfficerActivity";

export class TelemetryUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`Officer telemetry unavailable: ${reason}`);
    this.name = "TelemetryUnavailableError";
  }
}

const isMissingTable = (err: any): boolean => {
  const m = String(err?.message || "");
  return m.includes("(404)") || /no such resource|does not exist|INVALID_URL_PATTERN/i.test(m);
};

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const str = (v: any) => (v === null || v === undefined ? "" : String(v));

/** Catalyst datetime wants UTC `YYYY-MM-DD HH:MM:SS`, not an ISO string with a T. */
export function catalystDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function rowsFor(table: string, firebaseUid: string): Promise<any[]> {
  if (!isCatalystConfigured()) throw new TelemetryUnavailableError("Catalyst credentials are not set");
  let rows: any[];
  try {
    rows = await getAllRows(table);
  } catch (err: any) {
    if (isMissingTable(err)) throw new TelemetryUnavailableError(`${table} table does not exist yet`);
    throw err;
  }
  // No ZCQL scope, so no WHERE clause - filter in process. Same trade-off as
  // the rest of the platform (see catalyst.ts nextId).
  return rows.filter((r) => str(unwrap(r, table).FirebaseUID) === firebaseUid);
}

// ── Sessions ────────────────────────────────────────────────────────────────

export interface OfficerSession {
  sessionId: number | null;
  rowId: string;
  loginAt: string;
  logoutAt: string;
  durationSeconds: number | null;
  status: string;
  endReason: string;
  ipAddress: string;
  userAgent: string;
  /**
   * Still marked ACTIVE, but far too old to be a live sign-in.
   *
   * A session is closed by an explicit logout. A closed tab, a closed browser
   * or a flat battery leaves the row open for ever, so "Active Sessions" would
   * otherwise accumulate sessions that ended days ago and present them as
   * current. The stored row is left untouched - amending an audit record to
   * make a screen tidier is not acceptable - and the judgement is made here,
   * at read time, and labelled.
   */
  abandoned: boolean;
}

/**
 * Beyond this, an open session is treated as abandoned rather than live.
 *
 * Longer than any single duty shift, so a genuinely long sign-in is never
 * mislabelled.
 */
export const SESSION_STALE_AFTER_MS = 16 * 60 * 60 * 1000;

export async function listSessions(firebaseUid: string, limit = 50): Promise<OfficerSession[]> {
  const rows = await rowsFor(SESSION_TABLE, firebaseUid);
  const now = Date.now();
  const startedTimes = rows
    .map((r) => {
      const s = unwrap(r, SESSION_TABLE);
      const startedMs = s.LoginAt ? new Date(String(s.LoginAt).replace(" ", "T")).getTime() : NaN;
      return Number.isFinite(startedMs) ? startedMs : null;
    })
    .filter((v): v is number => v !== null);
  return rows
    .map((r) => {
      const s = unwrap(r, SESSION_TABLE);
      const startedMs = s.LoginAt ? new Date(String(s.LoginAt).replace(" ", "T")).getTime() : NaN;
      const isOpen = str(s.SessionStatus) === "ACTIVE" && !str(s.LogoutAt);
      const hasNewerSession =
        isOpen && Number.isFinite(startedMs) && startedTimes.some((other) => other > startedMs);
      return {
        abandoned:
          isOpen &&
          Number.isFinite(startedMs) &&
          (hasNewerSession || now - startedMs > SESSION_STALE_AFTER_MS),
        sessionId: s.SessionID != null ? Number(s.SessionID) : null,
        rowId: str(s.ROWID),
        loginAt: str(s.LoginAt),
        logoutAt: str(s.LogoutAt),
        durationSeconds: s.DurationSeconds != null && s.DurationSeconds !== "" ? Number(s.DurationSeconds) : null,
        status: str(s.SessionStatus),
        endReason: str(s.EndReason),
        ipAddress: str(s.IPAddress),
        userAgent: str(s.UserAgent),
      };
    })
    .sort((a, b) => b.loginAt.localeCompare(a.loginAt))
    .slice(0, limit);
}

/**
 * The officer's currently-open session, if there is a usable one.
 *
 * Used when Firebase restores a sign-in: the browser has no record of the row
 * (sessionStorage is per tab and does not survive a restart), but the officer
 * has not signed in again either. Adopting the open row keeps a second tab, or
 * a reopened browser, from opening a duplicate session for the same sign-in.
 *
 * An abandoned row is never adopted - that would resurrect a session that
 * really did end.
 */
export async function findOpenSession(firebaseUid: string): Promise<OfficerSession | null> {
  const sessions = await listSessions(firebaseUid, 10);
  return sessions.find((s) => s.status === "ACTIVE" && !s.logoutAt && !s.abandoned) || null;
}

export async function startSession(
  firebaseUid: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): Promise<{ rowId: string; sessionId: number; loginAt: string }> {
  const now = new Date();
  const existingRows = await rowsFor(SESSION_TABLE, firebaseUid);
  const openPatches = existingRows
    .map((r) => unwrap(r, SESSION_TABLE))
    .filter((s) => str(s.SessionStatus) === "ACTIVE" && !str(s.LogoutAt) && str(s.ROWID))
    .map((s) => {
      const started = s.LoginAt ? new Date(String(s.LoginAt).replace(" ", "T")) : null;
      const duration =
        started && !Number.isNaN(started.getTime())
          ? Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
          : null;
      return {
        ROWID: s.ROWID,
        LogoutAt: catalystDate(now),
        DurationSeconds: duration,
        SessionStatus: "SUPERSEDED_BY_NEW_LOGIN",
        EndReason: "NEW_LOGIN",
      };
    });

  if (openPatches.length) {
    await updateRows(SESSION_TABLE, openPatches);
  }

  const sessionId = await nextId(SESSION_TABLE, "SessionID");
  // Returned to the caller so the client can show session duration without
  // re-reading the table on every fresh tab.
  const loginAt = catalystDate(now);
  const created = await insertRows(SESSION_TABLE, [
    {
      SessionID: sessionId,
      FirebaseUID: firebaseUid,
      LoginAt: loginAt,
      SessionStatus: "ACTIVE",
      IPAddress: (meta.ipAddress || "").slice(0, 64),
      UserAgent: (meta.userAgent || "").slice(0, 10000),
    },
  ]);
  return { rowId: str(created?.[0]?.ROWID), sessionId, loginAt };
}

/**
 * Close a session. The ROWID must belong to THIS officer — otherwise anyone
 * could close (or rewrite) another officer's session record.
 */
export async function endSession(
  firebaseUid: string,
  rowId: string,
  endReason = ""
): Promise<boolean> {
  const rows = await rowsFor(SESSION_TABLE, firebaseUid);
  const match = rows.find((r) => str(unwrap(r, SESSION_TABLE).ROWID) === String(rowId));
  if (!match) return false;

  const s = unwrap(match, SESSION_TABLE);
  const now = new Date();
  const started = s.LoginAt ? new Date(String(s.LoginAt).replace(" ", "T")) : null;
  const duration =
    started && !Number.isNaN(started.getTime())
      ? Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
      : null;

  await updateRows(SESSION_TABLE, [
    {
      ROWID: s.ROWID,
      LogoutAt: catalystDate(now),
      DurationSeconds: duration,
      SessionStatus: endReason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "LOGOUT_COMPLETED",
      EndReason: endReason.slice(0, 50),
    },
  ]);
  return true;
}

// ── Activity ────────────────────────────────────────────────────────────────

export type ActivityType = "DOWNLOAD" | "AI_QUERY" | "PRINT" | "EXPORT";

export interface OfficerActivity {
  activityId: number | null;
  type: string;
  occurredAt: string;
  category: string;
  title: string;
  detail: string;
  sizeBytes: number | null;
}

export async function listActivity(
  firebaseUid: string,
  type?: ActivityType,
  limit = 50
): Promise<OfficerActivity[]> {
  const rows = await rowsFor(ACTIVITY_TABLE, firebaseUid);
  return rows
    .map((r) => {
      const a = unwrap(r, ACTIVITY_TABLE);
      return {
        activityId: a.ActivityID != null ? Number(a.ActivityID) : null,
        type: str(a.ActivityType),
        occurredAt: str(a.OccurredAt),
        category: str(a.Category),
        title: str(a.Title),
        detail: str(a.Detail),
        sizeBytes: a.SizeBytes != null && a.SizeBytes !== "" ? Number(a.SizeBytes) : null,
      };
    })
    .filter((a) => !type || a.type === type)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/**
 * Optional AI telemetry, recorded only for AI_QUERY rows.
 *
 * These columns exist so the AI Monitoring console can show what actually
 * happened rather than a plausible-looking score. Nothing here is derived or
 * estimated: latency is measured around the call, the token counts come from
 * the provider's own `usage` block, and `outcome` is what the request returned.
 *
 * `responseText` is the assistant's reply, capped. It is stored because the
 * monitoring console shows the answer an officer was given, which is the point
 * of monitoring — but note this is a RETENTION decision: replies can restate
 * case material, so the audit.retentionDays setting applies to it in spirit
 * even though no purge job exists yet.
 */
export interface AiTelemetry {
  model?: string;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  /** OK when the model answered; ERROR when the call failed. */
  outcome?: "OK" | "ERROR";
  responseText?: string;
}

export async function recordActivity(
  firebaseUid: string,
  entry: {
    type: ActivityType;
    title: string;
    category?: string;
    detail?: string;
    sizeBytes?: number | null;
  } & AiTelemetry
): Promise<void> {
  const activityId = await nextId(ACTIVITY_TABLE, "ActivityID");
  const num = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v);

  await insertRows(ACTIVITY_TABLE, [
    {
      ActivityID: activityId,
      FirebaseUID: firebaseUid,
      ActivityType: entry.type,
      OccurredAt: catalystDate(),
      Category: (entry.category || "").slice(0, 60),
      Title: (entry.title || "").slice(0, 255),
      Detail: (entry.detail || "").slice(0, 10000),
      SizeBytes: entry.sizeBytes ?? null,
      // Absent rather than zero when not applicable: a DOWNLOAD has no latency,
      // and a 0 would average into the AI figures as though it were instant.
      Model: (entry.model || "").slice(0, 80) || null,
      LatencyMs: num(entry.latencyMs),
      PromptTokens: num(entry.promptTokens),
      CompletionTokens: num(entry.completionTokens),
      TotalTokens: num(entry.totalTokens),
      Outcome: entry.outcome || null,
      // Catalyst text columns clamp at 10,000 characters.
      ResponseText: entry.responseText ? entry.responseText.slice(0, 9900) : null,
    },
  ]);
}

/**
 * Fire-and-forget write for hot paths (e.g. logging an AI query inside the chat
 * route). Telemetry must never fail the action it is describing.
 */
/**
 * Everything the profile screen needs, reading each table exactly once.
 *
 * The screen previously issued three calls that between them scanned
 * OfficerActivity twice. Concurrency hid the cost rather than removing it.
 */
export async function listTelemetry(
  firebaseUid: string,
  limit = 50
): Promise<{
  sessions: OfficerSession[];
  downloads: OfficerActivity[];
  aiQueries: OfficerActivity[];
}> {
  const [sessions, activity] = await Promise.all([
    listSessions(firebaseUid, limit),
    listActivity(firebaseUid, undefined, Number.MAX_SAFE_INTEGER),
  ]);

  return {
    sessions,
    downloads: activity.filter((a) => a.type === "DOWNLOAD").slice(0, limit),
    aiQueries: activity.filter((a) => a.type === "AI_QUERY").slice(0, limit),
  };
}

export function recordActivitySafe(
  firebaseUid: string,
  entry: Parameters<typeof recordActivity>[1]
): void {
  recordActivity(firebaseUid, entry).catch((err) => {
    console.warn("[officerTelemetry] activity not recorded:", err?.message || err);
  });
}
