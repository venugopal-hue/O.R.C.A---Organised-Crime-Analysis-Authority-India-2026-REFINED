"use client";

/**
 * One shared read of /api/officer/telemetry.
 *
 * Opening the settings tab used to issue the endpoint TWICE: the dashboard
 * fetched it for the login history, downloads and AI audit lists, while
 * useActiveSession fetched it independently to find the open session. Each of
 * those was a full scan of OfficerSession and OfficerActivity on the server.
 *
 * Callers now share a single in-flight request, and the result is held briefly
 * so switching away from the settings tab and back does not re-read the audit
 * trail from scratch. The window is deliberately short - an audit screen that
 * shows a minute-old picture of itself is worse than one that takes an extra
 * moment.
 */

export interface TelemetrySession {
  sessionId: number | null;
  rowId: string;
  loginAt: string;
  logoutAt: string;
  durationSeconds: number | null;
  status: string;
  endReason: string;
  ipAddress: string;
  userAgent: string;
  abandoned: boolean;
}

export interface TelemetryActivity {
  activityId: number | null;
  type: string;
  occurredAt: string;
  category: string;
  title: string;
  detail: string;
  sizeBytes: number | null;
}

export interface TelemetrySnapshot {
  configured: boolean;
  sessions: TelemetrySession[];
  downloads: TelemetryActivity[];
  aiQueries: TelemetryActivity[];
}

const EMPTY: TelemetrySnapshot = {
  configured: false,
  sessions: [],
  downloads: [],
  aiQueries: [],
};

/** Long enough to collapse one screen's burst, short enough to stay current. */
const FRESH_MS = 10_000;

let cached: { at: number; value: TelemetrySnapshot } | null = null;
let inFlight: Promise<TelemetrySnapshot> | null = null;

async function load(): Promise<TelemetrySnapshot> {
  const res = await fetch("/api/officer/telemetry");
  if (!res.ok) return EMPTY;
  const data = await res.json();
  return {
    configured: Boolean(data?.configured),
    sessions: Array.isArray(data?.sessions) ? data.sessions : [],
    downloads: Array.isArray(data?.downloads) ? data.downloads : [],
    aiQueries: Array.isArray(data?.aiQueries) ? data.aiQueries : [],
  };
}

/**
 * Read the officer's telemetry, sharing the request with any other caller.
 *
 * `force` skips the freshness window - used after a write, so a newly recorded
 * session or download appears immediately rather than up to FRESH_MS later.
 */
export function fetchTelemetry(force = false): Promise<TelemetrySnapshot> {
  if (!force && cached && Date.now() - cached.at < FRESH_MS) {
    return Promise.resolve(cached.value);
  }
  if (inFlight) return inFlight;

  inFlight = load()
    .catch(() => EMPTY)
    .then((value) => {
      cached = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Drop the shared copy, e.g. on sign-out so the next officer starts clean. */
export function clearTelemetryCache(): void {
  cached = null;
}
