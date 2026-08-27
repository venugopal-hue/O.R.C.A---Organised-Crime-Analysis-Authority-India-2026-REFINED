/**
 * O.R.C.A admin console — derived views (SERVER-SIDE ONLY).
 *
 * Everything here is COMPUTED from rows that already exist. Nothing in this
 * file invents a number, and where a metric cannot honestly be produced from
 * the data we hold, it is returned as `null` with a stated reason rather than
 * as a plausible-looking figure. That is the whole point of the file: the
 * screens it feeds used to be hardcoded (48,920 queries, three security
 * incidents, five notifications), and a console that invents its own evidence
 * is worse than one that says "nothing recorded yet".
 */

import type { AdminSession, AdminActivity, AdminApplication, AdminVerification } from "@/lib/adminData";
import type { OfficerProfile } from "@/lib/officerAccount";

const ms = (s: string) => {
  if (!s) return 0;
  // Catalyst returns "2026-08-24 15:23:57"; Safari and Firefox will not parse
  // that without the T, and an unparsed date silently becomes NaN.
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(t) ? 0 : t;
};

const DAY = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Security Center
// ─────────────────────────────────────────────────────────────────────────────

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SecurityEvent {
  id: string;
  kind: string;
  title: string;
  detail: string;
  severity: SecuritySeverity;
  firebaseUid: string;
  officer: string;
  ip: string;
  userAgent: string;
  occurredAt: string;
}

/**
 * What this can and cannot see.
 *
 * CAN: everything `OfficerSession` records — who signed in, when, from which
 * IP, on what client, whether the session was ever closed. Sessions are written
 * for every officer, so this is a statewide view, not the viewing admin's own.
 *
 * CANNOT: failed sign-in attempts and brute force. Authentication happens in
 * Firebase Auth on the client; a failed attempt never reaches our server, so
 * there is no row to count. The old screen showed "3 consecutive failed login
 * attempts" as a hardcoded string. Catching those for real needs either the
 * Firebase Auth activity log or a new unauthenticated reporting endpoint, and
 * the latter is an abuse surface that should not be added without a decision.
 * `SECURITY_BLIND_SPOTS` below states this on screen instead of pretending.
 */
export const SECURITY_BLIND_SPOTS = [
  "Failed sign-in attempts and brute-force detection are not visible here — authentication is handled by Firebase Auth on the client, so a failed attempt never reaches this server and leaves no row to count.",
  "Geographic location is not derived from IP addresses. No geolocation lookup is performed, and guessing a city from an IP would be a fabricated attribution.",
];

const shortAgent = (ua: string) => {
  if (!ua) return "";
  const browser =
    /Edg\/([\d.]+)/.exec(ua)?.[0] ||
    /Chrome\/([\d.]+)/.exec(ua)?.[0] ||
    /Firefox\/([\d.]+)/.exec(ua)?.[0] ||
    /Safari\/([\d.]+)/.exec(ua)?.[0] ||
    "";
  const os =
    (/Windows NT 10/.test(ua) && "Windows") ||
    (/Mac OS X/.test(ua) && "macOS") ||
    (/Android/.test(ua) && "Android") ||
    (/iPhone|iPad/.test(ua) && "iOS") ||
    (/Linux/.test(ua) && "Linux") ||
    "";
  return [browser, os].filter(Boolean).join(" · ");
};

export function buildSecurityEvents(
  sessions: AdminSession[],
  officers: OfficerProfile[],
  now = Date.now()
): SecurityEvent[] {
  const nameOf = (uid: string) =>
    officers.find((o) => o.firebaseUid === uid)?.name || uid || "Unattributed";

  const events: SecurityEvent[] = [];

  // Oldest first, so "first seen" and "new IP" mean what they say.
  const chronological = [...sessions].sort((a, b) => ms(a.loginAt) - ms(b.loginAt));

  const seenIpsByUid = new Map<string, Set<string>>();

  for (const s of chronological) {
    const uid = s.firebaseUid;
    const when = ms(s.loginAt);

    // 1. A session that was never closed and is now old. Either the officer's
    //    browser died without firing `pagehide`, or the session is genuinely
    //    still open on a machine nobody is at.
    if (s.status === "ACTIVE" && when && now - when > DAY) {
      events.push({
        id: `stale-${s.sessionId}-${s.loginAt}`,
        kind: "STALE_SESSION",
        title: "Session left open for more than 24 hours",
        detail: `Signed in ${new Date(when).toLocaleString()} and never signed out. Still marked ACTIVE.`,
        severity: "MEDIUM",
        firebaseUid: uid,
        officer: nameOf(uid),
        ip: s.ipAddress,
        userAgent: shortAgent(s.userAgent),
        occurredAt: s.loginAt,
      });
    }

    // 2. An IP this officer has not signed in from before. Not an incident on
    //    its own — a new device or a new station looks exactly like this — but
    //    it is the thing worth a human glance.
    if (s.ipAddress) {
      const seen = seenIpsByUid.get(uid) || new Set<string>();
      if (seen.size > 0 && !seen.has(s.ipAddress)) {
        events.push({
          id: `newip-${s.sessionId}-${s.ipAddress}`,
          kind: "NEW_IP",
          title: "Sign-in from an address not used before",
          detail: `First sign-in from ${s.ipAddress}. Previously seen from ${[...seen].join(", ")}.`,
          severity: "MEDIUM",
          firebaseUid: uid,
          officer: nameOf(uid),
          ip: s.ipAddress,
          userAgent: shortAgent(s.userAgent),
          occurredAt: s.loginAt,
        });
      }
      seen.add(s.ipAddress);
      seenIpsByUid.set(uid, seen);
    }

    // 3. No address recorded at all. Worth surfacing because it means the audit
    //    trail cannot attribute that session to a machine — and because it is
    //    exactly what a reverse proxy that drops x-forwarded-for looks like.
    if (!s.ipAddress) {
      events.push({
        id: `noip-${s.sessionId}-${s.loginAt}`,
        kind: "NO_SOURCE_ADDRESS",
        title: "Session recorded with no source address",
        detail:
          "The request carried no usable client address, so this session cannot be attributed to a machine.",
        severity: "LOW",
        firebaseUid: uid,
        officer: nameOf(uid),
        ip: "",
        userAgent: shortAgent(s.userAgent),
        occurredAt: s.loginAt,
      });
    }
  }

  // 4. Two sessions open at once from different addresses. Overlap is computed
  //    from the real login/logout window, not from "both look recent".
  const byUid = new Map<string, AdminSession[]>();
  chronological.forEach((s) => {
    const list = byUid.get(s.firebaseUid) || [];
    list.push(s);
    byUid.set(s.firebaseUid, list);
  });

  for (const [uid, list] of byUid) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.ipAddress || !b.ipAddress || a.ipAddress === b.ipAddress) continue;
        const aStart = ms(a.loginAt);
        const aEnd = a.logoutAt ? ms(a.logoutAt) : now;
        const bStart = ms(b.loginAt);
        const bEnd = b.logoutAt ? ms(b.logoutAt) : now;
        if (!aStart || !bStart) continue;
        if (aStart < bEnd && bStart < aEnd) {
          events.push({
            id: `concurrent-${uid}-${a.sessionId}-${b.sessionId}`,
            kind: "CONCURRENT_ADDRESSES",
            title: "Two sessions open at once from different addresses",
            detail: `${a.ipAddress} and ${b.ipAddress} overlapped between ${new Date(
              Math.max(aStart, bStart)
            ).toLocaleString()} and ${new Date(Math.min(aEnd, bEnd)).toLocaleString()}.`,
            severity: "HIGH",
            firebaseUid: uid,
            officer: nameOf(uid),
            ip: `${a.ipAddress} / ${b.ipAddress}`,
            userAgent: shortAgent(b.userAgent),
            occurredAt: b.loginAt,
          });
        }
      }
    }
  }

  return events.sort((x, y) => ms(y.occurredAt) - ms(x.occurredAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform analytics (the tab formerly known as Crime DB Analytics)
// ─────────────────────────────────────────────────────────────────────────────

export interface Metric {
  key: string;
  label: string;
  /** null means "not measurable from what we record" — never shown as 0. */
  value: number | null;
  /** Set only when `value` is null: why the number cannot be produced. */
  unavailable?: string;
  hint?: string;
}

export interface PlatformAnalytics {
  metrics: Metric[];
  aiQueriesByDay: { day: string; count: number }[];
  activityByCategory: { category: string; count: number }[];
  topOfficers: { officer: string; events: number }[];
  busiestHours: { hour: number; count: number }[];
}

const dayKey = (iso: string) => {
  const t = ms(iso);
  return t ? new Date(t).toISOString().slice(0, 10) : "";
};

export function buildPlatformAnalytics(input: {
  activity: AdminActivity[];
  sessions: AdminSession[];
  officers: OfficerProfile[];
  caseCount: number;
  evidenceCount: number;
  verifications: AdminVerification[];
  now?: number;
}): PlatformAnalytics {
  const { activity, sessions, officers, caseCount, evidenceCount, verifications } = input;
  const now = input.now ?? Date.now();

  const nameOf = (uid: string) =>
    officers.find((o) => o.firebaseUid === uid)?.name || uid || "Unattributed";

  const since = (days: number) => now - days * DAY;
  const aiQueries = activity.filter((a) => a.activityType === "AI_QUERY");
  const downloads = activity.filter((a) => a.activityType === "DOWNLOAD");

  const scansRun = verifications.reduce((n, v) => n + v.scanCount, 0);

  const metrics: Metric[] = [
    {
      key: "ai-total",
      label: "AI Queries",
      value: aiQueries.length,
      hint: "Recorded in OfficerActivity",
    },
    {
      key: "ai-7d",
      label: "AI Queries (7 days)",
      value: aiQueries.filter((a) => ms(a.occurredAt) >= since(7)).length,
    },
    {
      key: "sessions",
      label: "Sign-ins Recorded",
      value: sessions.length,
    },
    {
      key: "officers-active",
      label: "Active Officer Accounts",
      value: officers.filter((o) => o.active).length,
    },
    {
      key: "cases",
      label: "Cases Registered",
      value: caseCount,
      hint: "CaseMaster",
    },
    {
      key: "evidence",
      label: "Evidence Items",
      value: evidenceCount,
      hint: "Evidence",
    },
    {
      key: "documents-sealed",
      label: "Documents Sealed",
      value: verifications.length,
    },
    {
      key: "scans",
      label: "Verification Scans",
      value: scansRun,
    },
    {
      key: "downloads",
      label: "Documents Downloaded",
      value: downloads.length,
    },
    {
      key: "db-queries",
      label: "Database Queries",
      value: null,
      unavailable:
        "Not measured. Catalyst does not expose a per-query counter and the app does not log reads, so any figure here would be invented.",
    },
    {
      key: "search-latency",
      label: "Average Search Time",
      value: null,
      unavailable:
        "Not measured. Request timings are not recorded anywhere, so this cannot be computed after the fact.",
    },
  ];

  // AI queries per day, last 14 days, zero-filled so the shape of the series is
  // honest about quiet days rather than skipping them.
  const dayCounts = new Map<string, number>();
  aiQueries.forEach((a) => {
    const k = dayKey(a.occurredAt);
    if (k) dayCounts.set(k, (dayCounts.get(k) || 0) + 1);
  });
  const aiQueriesByDay: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const k = new Date(now - i * DAY).toISOString().slice(0, 10);
    aiQueriesByDay.push({ day: k, count: dayCounts.get(k) || 0 });
  }

  const catCounts = new Map<string, number>();
  activity.forEach((a) => {
    const k = a.category || a.activityType || "Uncategorised";
    catCounts.set(k, (catCounts.get(k) || 0) + 1);
  });
  const activityByCategory = [...catCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const officerCounts = new Map<string, number>();
  activity.forEach((a) => {
    const k = nameOf(a.firebaseUid);
    officerCounts.set(k, (officerCounts.get(k) || 0) + 1);
  });
  const topOfficers = [...officerCounts.entries()]
    .map(([officer, events]) => ({ officer, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 8);

  const hourCounts = new Array(24).fill(0);
  activity.forEach((a) => {
    const t = ms(a.occurredAt);
    if (t) hourCounts[new Date(t).getHours()]++;
  });
  const busiestHours = hourCounts.map((count, hour) => ({ hour, count }));

  return { metrics, aiQueriesByDay, activityByCategory, topOfficers, busiestHours };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications — derived, not stored
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationKind = "CRITICAL" | "WARNING" | "SECURITY" | "INFO";

export interface AdminNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  occurredAt: string;
  /** Admin tab this notification is about, so the UI can offer to jump there. */
  tab?: string;
}

/**
 * Notifications are computed on read rather than stored.
 *
 * A stored notification needs a writer, a read/unread state per admin, and a
 * retention rule — three moving parts whose only job would be to restate facts
 * the database already holds. Deriving them means the list cannot drift out of
 * step with reality: an application that gets approved stops being a pending
 * application, and its notification disappears on the next read without anyone
 * having to remember to delete it.
 *
 * The trade-off, stated plainly: there is no per-admin "mark as read", because
 * there is nowhere to record it. If dismissal turns out to matter, that is the
 * point at which a table earns its place.
 */
export function buildNotifications(input: {
  applications: AdminApplication[];
  security: SecurityEvent[];
  officers: OfficerProfile[];
  orphanEvidence: number;
  now?: number;
}): AdminNotification[] {
  const { applications, security, officers, orphanEvidence } = input;
  const now = input.now ?? Date.now();
  const out: AdminNotification[] = [];

  const pending = applications.filter((a) => a.status === "pending");
  pending.forEach((a) => {
    const waited = ms(a.submittedAt) ? Math.floor((now - ms(a.submittedAt)) / DAY) : 0;
    out.push({
      id: `app-${a.applicationId}`,
      kind: waited >= 3 ? "CRITICAL" : "INFO",
      title: `Registration awaiting review — ${a.fullName || a.email}`,
      detail: waited >= 1 ? `Submitted ${waited} day${waited === 1 ? "" : "s"} ago.` : "Submitted today.",
      occurredAt: a.submittedAt,
      tab: "admin-pending",
    });
  });

  security
    .filter((e) => e.severity === "CRITICAL" || e.severity === "HIGH")
    .slice(0, 10)
    .forEach((e) => {
      out.push({
        id: `sec-${e.id}`,
        kind: "SECURITY",
        title: e.title,
        detail: `${e.officer}${e.ip ? ` — ${e.ip}` : ""}`,
        occurredAt: e.occurredAt,
        tab: "admin-security",
      });
    });

  // An officer account with no Employee row cannot be named on a case or hold
  // evidence. Worth flagging loudly because the account otherwise looks fine.
  const noEmployee = officers.filter((o) => !o.employeeId);
  if (noEmployee.length) {
    out.push({
      id: "no-employee-row",
      kind: "CRITICAL",
      title: `${noEmployee.length} officer account${noEmployee.length === 1 ? " has" : "s have"} no personnel record`,
      detail:
        "Without an Employee row these officers cannot be selected as an investigating officer or an evidence custodian.",
      occurredAt: new Date(now).toISOString(),
      tab: "admin-directory",
    });
  }

  const noKgid = officers.filter((o) => o.employeeId && !o.kgid);
  if (noKgid.length) {
    out.push({
      id: "no-kgid",
      kind: "WARNING",
      title: `${noKgid.length} officer${noKgid.length === 1 ? "" : "s"} without a KGID`,
      detail: "The Karnataka Government ID is blank on their personnel record.",
      occurredAt: new Date(now).toISOString(),
      tab: "admin-directory",
    });
  }

  if (orphanEvidence > 0) {
    out.push({
      id: "orphan-evidence",
      kind: "CRITICAL",
      title: `${orphanEvidence} evidence item${orphanEvidence === 1 ? "" : "s"} with no chain of custody`,
      detail: "Registered without an opening custody event — the chain cannot be verified.",
      occurredAt: new Date(now).toISOString(),
      tab: "admin-verification",
    });
  }

  return out.sort((a, b) => ms(b.occurredAt) - ms(a.occurredAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Monitoring
// ─────────────────────────────────────────────────────────────────────────────

export interface AiQueryRecord {
  id: string;
  firebaseUid: string;
  officer: string;
  badge: string;
  query: string;
  response: string;
  module: string;
  occurredAt: string;
  model: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  outcome: string;
  /** Attachments and case context, as recorded by the chat route. */
  context: string;
  hadAttachment: boolean;
  /** Why this query is worth a look. Empty when nothing stands out. */
  flags: string[];
  /** True when this row predates the telemetry columns. */
  legacy: boolean;
}

/**
 * WHAT THIS SCREEN IS, PLAINLY
 *
 * It shows every officer's AI questions and the answers they were given, to any
 * administrator who can reach the tab. That is a surveillance capability and it
 * was chosen deliberately by the user after the alternatives (aggregate-only,
 * or removing the tab) were put to them. It is not a side effect of the
 * implementation.
 *
 * WHAT IS REAL AND WHAT WAS DROPPED
 *
 * The screen this replaced showed five invented conversations with a
 * "confidence" percentage, a star rating, and statuses of FLAGGED / ESCALATED.
 * None of those exist:
 *
 *   confidence  the models return no confidence score; the numbers were literals
 *   rating      nothing in the app ever asks an officer to rate an answer
 *   FLAGGED     there was no review workflow to flag anything into
 *
 * They are gone rather than approximated. What replaced them is measured:
 * latency timed around the provider call, token counts from the provider's own
 * usage block, the model that actually answered, and whether the call
 * succeeded — plus the flags below, which are conditions rather than scores.
 */
const FLAG_SLOW_MS = 8000;
/** A reply this short after a real question is usually a refusal or a stub. */
const FLAG_SHORT_REPLY = 40;

/**
 * The marker the chatbot used to inline an attached text file INTO the prompt.
 *
 * The chat route now records `auditPrompt` — what the officer actually typed —
 * so attachment contents are not stored. That was not always true: queries
 * recorded before that change captured the assembled prompt, file contents and
 * all. Those rows are real and cannot be rewritten, so they are detected and
 * labelled rather than left to quietly contradict the privacy note on the page.
 */
const INLINED_ATTACHMENT = /---\s*Attached files\s*---/i;

export function buildAiQueries(
  activity: AdminActivity[],
  officers: OfficerProfile[]
): AiQueryRecord[] {
  const byUid = new Map(officers.map((o) => [o.firebaseUid, o]));

  return activity
    .filter((a) => a.activityType === "AI_QUERY")
    .map((a) => {
      const who = byUid.get(a.firebaseUid);
      const hadAttachment = /Images attached:/i.test(a.detail || "");
      const flags: string[] = [];

      if (a.outcome === "ERROR") flags.push("Failed — no answer returned");
      // An attachment is sent to an external model provider, so it leaves the
      // department's network. Worth naming; the chat route already records it.
      if (hadAttachment) flags.push("Attachment sent to the model provider");
      if (a.latencyMs !== null && a.latencyMs > FLAG_SLOW_MS) {
        flags.push(`Slow — ${(a.latencyMs / 1000).toFixed(1)}s`);
      }
      if (INLINED_ATTACHMENT.test(a.title || "")) {
        flags.push("Contains attached file text (recorded before prompt capture was separated)");
      }
      if (
        a.outcome === "OK" &&
        a.responseText &&
        a.responseText.length < FLAG_SHORT_REPLY &&
        (a.title || "").length > FLAG_SHORT_REPLY
      ) {
        flags.push("Very short answer to a long question");
      }

      return {
        id: String(a.activityId ?? `${a.firebaseUid}-${a.occurredAt}`),
        firebaseUid: a.firebaseUid,
        officer: who?.name || a.firebaseUid || "Unattributed",
        badge: who?.kgid || "",
        query: a.title,
        response: a.responseText,
        module: a.category,
        occurredAt: a.occurredAt,
        model: a.model,
        latencyMs: a.latencyMs,
        promptTokens: a.promptTokens,
        completionTokens: a.completionTokens,
        totalTokens: a.totalTokens,
        outcome: a.outcome,
        context: a.detail,
        hadAttachment,
        flags,
        // Rows written before the telemetry columns existed carry no outcome.
        // Marked so the screen can say "not recorded" instead of implying the
        // query failed or returned nothing.
        legacy: !a.outcome,
      };
    })
    .sort((x, y) => ms(y.occurredAt) - ms(x.occurredAt));
}

export interface AiStats {
  total: number;
  flagged: number;
  failed: number;
  withAttachments: number;
  /** null when no row carries a latency — never 0. */
  medianLatencyMs: number | null;
  totalTokens: number | null;
  legacyRows: number;
  /** Rows whose stored question still carries an attachment's contents. */
  inlinedAttachmentRows: number;
  models: { model: string; count: number }[];
}

export function summariseAiQueries(records: AiQueryRecord[]): AiStats {
  // Median, not mean: one 30-second image transcription drags a mean far enough
  // to misrepresent a set of otherwise fast queries.
  const latencies = records
    .map((r) => r.latencyMs)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const median =
    latencies.length === 0
      ? null
      : latencies.length % 2
      ? latencies[(latencies.length - 1) / 2]
      : Math.round((latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2);

  const tokenRows = records.filter((r) => r.totalTokens !== null);
  const modelCounts = new Map<string, number>();
  records.forEach((r) => {
    if (r.model) modelCounts.set(r.model, (modelCounts.get(r.model) || 0) + 1);
  });

  return {
    total: records.length,
    flagged: records.filter((r) => r.flags.length > 0).length,
    failed: records.filter((r) => r.outcome === "ERROR").length,
    withAttachments: records.filter((r) => r.hadAttachment).length,
    medianLatencyMs: median,
    totalTokens: tokenRows.length
      ? tokenRows.reduce((n, r) => n + (r.totalTokens || 0), 0)
      : null,
    legacyRows: records.filter((r) => r.legacy).length,
    inlinedAttachmentRows: records.filter((r) =>
      r.flags.some((f) => f.startsWith("Contains attached file text"))
    ).length,
    models: [...modelCounts.entries()]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count),
  };
}
