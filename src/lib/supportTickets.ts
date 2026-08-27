import { randomInt } from "crypto";

/**
 * Shared vocabulary for the public Support / Report-Issue pipeline.
 *
 * WHY THIS EXISTS
 *
 * Both public forms, the public lookup, and the admin queue have to agree on
 * exactly what a category, a severity and a status ARE. When those lists live
 * inline in a `<select>`, the admin filter drifts from the form and tickets
 * quietly become unfilterable. Everything here is the single source both sides
 * import.
 *
 * The endpoints these feed are UNAUTHENTICATED — the pages sit in the public
 * footer, before login, and are reached by exactly the people who cannot log
 * in. So this module also carries the things that only matter because the door
 * is open: length caps, a honeypot, and a rate limiter.
 */

export type TicketType = "SUPPORT" | "INCIDENT";

export const TICKET_TYPES: readonly TicketType[] = ["SUPPORT", "INCIDENT"] as const;

/** Support-portal categories — "what part of getting in is broken". */
export const SUPPORT_CATEGORIES = [
  "Login / Locked Account",
  "Registration / Badge Mapping",
  "Password Reset",
  "Clearance or Role Assignment",
  "Document Verification",
  "Platform Performance",
  "Other",
] as const;

/** Report-Issue components — "what part of the platform misbehaved". */
export const INCIDENT_COMPONENTS = [
  "AI Chatbot (ZIA)",
  "Case Registration",
  "FIR Module",
  "Evidence Locker",
  "Document Verification",
  "Threat Mapping",
  "Analytics & Reports",
  "Admin Console",
  "Login / Session",
  "Other",
] as const;

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "Critical (Platform unusable / data loss)",
  HIGH: "High (Core function blocked)",
  MEDIUM: "Medium (Visual or UI bug)",
  LOW: "Low (Cosmetic / suggestion)",
};

export const STATUSES = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

/** What a status means, spelled out for the reporter on the lookup page. */
export const PUBLIC_STATUS_NOTE: Record<string, string> = {
  NEW: "Received and queued. No engineer has picked it up yet.",
  TRIAGED: "Reviewed and categorised. Scheduled for work.",
  IN_PROGRESS: "An engineer is actively working on this.",
  RESOLVED: "A fix or answer has been applied. See the resolution note.",
  CLOSED: "Closed. No further action is planned.",
  REJECTED: "Not actionable as reported. See the resolution note.",
};

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;

export const PRIORITY_LABELS: Record<string, string> = {
  P1: "P1 — Immediate",
  P2: "P2 — High",
  P3: "P3 — Normal",
  P4: "P4 — Backlog",
};

// ── Field limits ───────────────────────────────────────────────────────────
//
// These match the Catalyst varchar widths. A public endpoint with no cap is a
// free text-storage service; a cap enforced only in the browser is no cap at
// all, so every one of these is checked server-side.

export const LIMITS = {
  name: 160,
  badge: 60,
  email: 200,
  category: 80,
  summary: 300,
  details: 8000,
  diagnostics: 2000,
  resolutionNote: 4000,
  assignedTo: 200,
} as const;

/**
 * The honeypot input name. Rendered off-screen and left empty by a human; a
 * form-filling bot completes every field it finds. Anything non-empty here is
 * discarded — with a 200, so the bot learns nothing from the response.
 */
export const HONEYPOT_FIELD = "organisation_url";

// ── Reference numbers ──────────────────────────────────────────────────────

/**
 * Reference alphabet: no 0/O/1/I/L. These get read off a screen and typed back
 * in by someone who is already having a bad day.
 */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REF_SUFFIX_LEN = 6;

/**
 * Build a reference like `ORCA-SUP-00012-K7F3QA`.
 *
 * WHY THE RANDOM SUFFIX
 *
 * The lookup endpoint is public, because the whole point is that someone who
 * cannot log in can still check their ticket. A purely sequential reference
 * would therefore be an enumeration hole: count upward from 00001 and read
 * every reporter's name, badge number and email. The suffix is the secret —
 * roughly 887 million combinations per serial — and the serial stays only so
 * the admin queue can order by it.
 */
export function buildReference(type: TicketType, serial: number): string {
  const tag = type === "INCIDENT" ? "INC" : "SUP";
  let suffix = "";
  for (let i = 0; i < REF_SUFFIX_LEN; i++) {
    suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  }
  return `ORCA-${tag}-${String(serial).padStart(5, "0")}-${suffix}`;
}

/**
 * Normalise a reference a human typed: trim, upper-case, and tolerate spaces
 * or missing hyphens. Returns "" when it cannot possibly be a reference, so
 * the lookup route can reject it without touching the database.
 */
export function normaliseReference(input: string): string {
  const cleaned = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = cleaned.match(/^ORCA(SUP|INC)(\d{5})([A-Z0-9]{6})$/);
  if (!m) return "";
  return `ORCA-${m[1]}-${m[2]}-${m[3]}`;
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface TicketSubmission {
  type: TicketType;
  reporterName: string;
  reporterBadge: string;
  reporterEmail: string;
  category: string;
  severity: string;
  summary: string;
  details: string;
  diagnostics: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: TicketSubmission;
}

const clean = (v: unknown, max: number): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Multi-line fields keep their line breaks; only the length is capped. */
const cleanMultiline = (v: unknown, max: number): string =>
  String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateSubmission(body: Record<string, unknown>): ValidationResult {
  const type: TicketType = body.type === "INCIDENT" ? "INCIDENT" : "SUPPORT";

  const reporterName = clean(body.reporterName, LIMITS.name);
  const reporterBadge = clean(body.reporterBadge, LIMITS.badge);
  const reporterEmail = clean(body.reporterEmail, LIMITS.email).toLowerCase();
  const category = clean(body.category, LIMITS.category);
  const summary = clean(body.summary, LIMITS.summary);
  const details = cleanMultiline(body.details, LIMITS.details);
  const diagnostics = cleanMultiline(body.diagnostics, LIMITS.diagnostics);

  let severity = String(body.severity ?? "").toUpperCase();

  if (reporterName.length < 2) return { ok: false, error: "Officer name is required." };
  if (!reporterBadge) return { ok: false, error: "Badge / Service ID is required." };

  // Every field on both forms is required. `required` in the markup is a
  // convenience for the person filling it in, not a control — a direct POST
  // never sees it — so each one is checked again here.
  if (!reporterEmail) {
    return { ok: false, error: "Official email address is required." };
  }
  if (!EMAIL_RE.test(reporterEmail)) {
    return { ok: false, error: "Email address is not valid." };
  }

  // Severity is a field only the incident form shows. Silently defaulting a
  // missing one to MEDIUM would file a severity the reporter never chose, so
  // an incident must state it. A support ticket has no such field and carries
  // MEDIUM as a stated convention rather than a guess at the reporter's intent.
  if (type === "INCIDENT") {
    if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
      return { ok: false, error: "Select a severity level." };
    }
  } else {
    severity = "MEDIUM";
  }

  const allowed: readonly string[] =
    type === "INCIDENT" ? INCIDENT_COMPONENTS : SUPPORT_CATEGORIES;
  if (!category) {
    return {
      ok: false,
      error: type === "INCIDENT" ? "Select the affected component." : "Select an issue category.",
    };
  }
  if (!allowed.includes(category)) {
    return { ok: false, error: "Select a valid category." };
  }

  if (summary.length < 5) return { ok: false, error: "Give a short summary of the problem." };
  if (details.length < 20) {
    return { ok: false, error: "Describe the problem in at least 20 characters." };
  }

  return {
    ok: true,
    value: {
      type,
      reporterName,
      reporterBadge,
      reporterEmail,
      category,
      severity,
      summary,
      details,
      diagnostics,
    },
  };
}

// ── Rate limiting ──────────────────────────────────────────────────────────

/**
 * Per-IP fixed-window counter, held in process memory.
 *
 * This is deliberately modest: it is one instance's view, so it does not
 * survive a restart and does not coordinate across instances. It is not a
 * defence against a determined flood — it is what stops one browser, one
 * script, or one stuck retry loop from filling the table. A real flood needs
 * the platform edge, which is not ours to configure.
 */
interface RateWindow {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Map<string, RateWindow>>();

export interface RateVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  scope: string,
  key: string,
  max: number,
  windowMs: number
): RateVerdict {
  const id = key || "unknown";
  let bucket = buckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    buckets.set(scope, bucket);
  }

  const now = Date.now();

  // Opportunistic sweep so an unbounded key space (one entry per IP ever seen)
  // cannot grow forever on a long-lived process.
  if (bucket.size > 5000) {
    for (const [k, w] of bucket) if (w.resetAt <= now) bucket.delete(k);
  }

  const existing = bucket.get(id);
  if (!existing || existing.resetAt <= now) {
    bucket.set(id, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test seam — the suites need a clean slate between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const SUBMIT_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
export const LOOKUP_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };
