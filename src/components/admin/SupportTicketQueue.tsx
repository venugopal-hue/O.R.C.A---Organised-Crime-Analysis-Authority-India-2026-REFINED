"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy, RefreshCw, Info, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { ORCA_TOKENS, ORCA_MONO } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";
import { useUnsavedWarning } from "@/lib/useUnsavedWarning";
import { canWrite } from "@/lib/rbac";
import {
  STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  LIMITS,
} from "@/lib/supportTickets";

/**
 * Triage queue for tickets submitted through the public /support and
 * /report-issue pages.
 *
 * Both public forms post to the same table with a TicketType discriminator, so
 * this is one queue with a type filter rather than two near-identical screens
 * that would drift apart.
 *
 * READ-ONLY ACCOUNTS: the action bar is hidden for a role that cannot make an
 * operational write. That is presentation only — the refusal that matters
 * happens in `denyWrite` on the PATCH route. Hiding a control is never the
 * control.
 */

const T = {
  bg: ORCA_TOKENS.offWhite,
  cardBg: ORCA_TOKENS.white,
  border: ORCA_TOKENS.border,
  gold: ORCA_TOKENS.gold,
  green: ORCA_TOKENS.green,
  red: ORCA_TOKENS.red,
  navy: ORCA_TOKENS.navy,
  textPrimary: ORCA_TOKENS.navy,
  textSecondary: ORCA_TOKENS.textGray,
  textMuted: ORCA_TOKENS.textMuted,
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "#64748b",
  TRIAGED: "#0ea5e9",
  IN_PROGRESS: ORCA_TOKENS.gold,
  RESOLVED: ORCA_TOKENS.green,
  CLOSED: "#64748b",
  REJECTED: ORCA_TOKENS.red,
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: ORCA_TOKENS.red,
  HIGH: ORCA_TOKENS.orange,
  MEDIUM: ORCA_TOKENS.gold,
  LOW: ORCA_TOKENS.textMuted,
};

interface Ticket {
  rowId: string;
  ticketId: number;
  reference: string;
  type: string;
  reporterName: string;
  reporterBadge: string;
  reporterEmail: string;
  category: string;
  severity: string;
  summary: string;
  details: string;
  diagnostics: string;
  status: string;
  priority: string;
  assignedTo: string;
  resolutionNote: string;
  submittedIp: string;
  submittedAt: string;
  updatedAt: string;
}

interface TicketEvent {
  id: string;
  action: string;
  actor: string;
  note: string;
  at: string;
}

const pretty = (value: string): string => {
  if (!value) return "—";
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: T.textMuted,
  fontFamily: ORCA_MONO,
  letterSpacing: "0.05em",
};

const controlStyle: React.CSSProperties = {
  background: T.cardBg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 12,
  color: T.textPrimary,
  fontFamily: "inherit",
};

export default function SupportTicketQueue() {
  const { dashboardRole } = useAuth();
  const mayTriage = canWrite(dashboardRole, "operational");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [openRef, setOpenRef] = useState("");
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Draft triage values for the open ticket, so typing a note does not
  // re-render the whole queue on every keystroke.
  const [draftStatus, setDraftStatus] = useState("");
  const [draftPriority, setDraftPriority] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support/tickets");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setTickets(j.tickets || []);
      setCounts(j.counts || {});
      setConfigured(j.configured !== false);
    } catch (e: any) {
      setError(e?.message || "Could not load the ticket queue.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const openTicket = useMemo(
    () => tickets.find((t) => t.reference === openRef) || null,
    [tickets, openRef]
  );

  /**
   * Unsaved triage warning.
   *
   * "Dirty" here is not "has a value" — every field opens pre-loaded from the
   * stored ticket, so that would warn on every expanded row. It is "differs
   * from what is stored", which is exactly the set of edits a refresh would
   * throw away. An officer who types a resolution note and then reloads the
   * console loses it the same way a reporter loses a half-typed ticket.
   */
  const triageDirty =
    openTicket !== null &&
    (draftStatus !== openTicket.status ||
      draftPriority !== openTicket.priority ||
      draftAssignee !== openTicket.assignedTo ||
      draftNote !== openTicket.resolutionNote);

  useUnsavedWarning(triageDirty && mayTriage);

  const expand = useCallback(
    async (t: Ticket) => {
      // Collapsing this row, or opening a different one, replaces the draft
      // values — so unsaved triage is lost exactly as it would be on a
      // refresh. beforeunload cannot see an in-page change, so this asks
      // directly. Only when there is something to discard.
      if (triageDirty && !window.confirm(
        "This ticket has unsaved triage changes. Leave them unsaved?"
      )) {
        return;
      }

      if (openRef === t.reference) {
        setOpenRef("");
        return;
      }
      setOpenRef(t.reference);
      setDraftStatus(t.status);
      setDraftPriority(t.priority);
      setDraftAssignee(t.assignedTo);
      setDraftNote(t.resolutionNote);
      setSaveError("");
      setEvents([]);
      setEventsLoading(true);
      try {
        const res = await fetch(`/api/support/tickets?reference=${encodeURIComponent(t.reference)}`);
        const j = await res.json();
        if (res.ok && j.success) setEvents(j.events || []);
      } catch {
        /* the trail is supplementary — the ticket itself is already on screen */
      } finally {
        setEventsLoading(false);
      }
    },
    [openRef, triageDirty]
  );

  async function save() {
    if (!openTicket || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/support/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: openTicket.reference,
          status: draftStatus,
          priority: draftPriority,
          assignedTo: draftAssignee,
          resolutionNote: draftNote,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setSaveError(j.error || `Update failed (${res.status})`);
        return;
      }
      setLoaded(false); // triggers a reload with the new values
      const ref = openTicket.reference;
      const detail = await fetch(`/api/support/tickets?reference=${encodeURIComponent(ref)}`);
      const dj = await detail.json();
      if (detail.ok && dj.success) setEvents(dj.events || []);
    } catch (e: any) {
      setSaveError(e?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.reference.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.reporterName.toLowerCase().includes(q) ||
        t.reporterBadge.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tickets, typeFilter, statusFilter, search]);

  const openCount = (counts.NEW || 0) + (counts.TRIAGED || 0) + (counts.IN_PROGRESS || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: 0 }}>
            Support &amp; Incidents
          </h1>
          <p style={{ fontSize: 12, color: T.textSecondary, margin: "4px 0 0" }}>
            Tickets submitted from the public Technical Support and Report Issue pages
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#fff",
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: T.textPrimary,
            cursor: loading ? "default" : "pointer",
          }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          {loading ? "Reading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.06)",
            border: `1px solid ${T.red}55`,
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 12,
            color: T.red,
          }}
        >
          {error}
        </div>
      )}

      {!configured && (
        <div
          style={{
            background: "rgba(255,153,51,0.06)",
            border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 12,
            color: T.textSecondary,
          }}
        >
          The ticket store is not configured, so nothing can be listed here. Submissions from the public
          pages are being refused with a service-unavailable message rather than silently dropped.
        </div>
      )}

      {/* Counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {(
          [
            ["Open", openCount, openCount ? T.gold : T.green],
            ["New", counts.NEW || 0, (counts.NEW || 0) ? T.gold : T.textPrimary],
            ["In Progress", counts.IN_PROGRESS || 0, T.textPrimary],
            ["Resolved", counts.RESOLVED || 0, T.green],
            ["Total", tickets.length, T.textPrimary],
          ] as const
        ).map(([label, value, colour]) => (
          <div
            key={label}
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colour as string, marginTop: 6 }}>
              {loaded ? value : "—"}
            </div>
          </div>
        ))}
      </div>

      {!mayTriage && (
        <div
          style={{
            background: "rgba(255,153,51,0.06)",
            border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Info style={{ width: 16, height: 16, color: T.gold, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 11.5, color: T.textSecondary, lineHeight: 1.55 }}>
            <strong style={{ color: T.textPrimary }}>This account is read-only.</strong> Tickets can be
            read but not triaged, assigned or closed.
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={controlStyle}>
          <option value="ALL">All types</option>
          <option value="SUPPORT">Support tickets</option>
          <option value="INCIDENT">Incident reports</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={controlStyle}>
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, summary, officer, badge…"
          style={{ ...controlStyle, flex: "1 1 240px", minWidth: 200 }}
        />
      </div>

      {/* Queue */}
      <div
        style={{
          background: T.cardBg,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {visible.length === 0 ? (
          <div style={{ padding: 34, textAlign: "center" }}>
            {tickets.length === 0 ? (
              <>
                <ShieldCheck style={{ width: 34, height: 34, color: T.green, margin: "0 auto 10px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
                  {loaded ? "No tickets have been submitted" : "Loading…"}
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                  Tickets raised on the public Technical Support and Report Issue pages appear here.
                </div>
              </>
            ) : (
              <>
                <LifeBuoy style={{ width: 34, height: 34, color: T.textMuted, margin: "0 auto 10px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
                  No ticket matches this filter
                </div>
              </>
            )}
          </div>
        ) : (
          visible.map((t) => {
            const isOpen = openRef === t.reference;
            return (
              <div key={t.reference} style={{ borderBottom: `1px solid ${T.border}` }}>
                <button
                  onClick={() => void expand(t)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: isOpen ? "rgba(0,31,63,0.03)" : "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      background: STATUS_COLOR[t.status] || T.textMuted,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: 10,
                      fontFamily: ORCA_MONO,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[t.status] || t.status}
                  </span>

                  <span
                    style={{
                      fontFamily: ORCA_MONO,
                      fontSize: 11,
                      color: T.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    {t.reference}
                  </span>

                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: T.textPrimary,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.summary}
                  </span>

                  {t.type === "INCIDENT" && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        fontFamily: ORCA_MONO,
                        color: SEVERITY_COLOR[t.severity] || T.textMuted,
                        border: `1px solid ${SEVERITY_COLOR[t.severity] || T.border}`,
                        borderRadius: 10,
                        padding: "2px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {t.severity}
                    </span>
                  )}

                  <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
                    {pretty(t.submittedAt)}
                  </span>

                  {isOpen ? (
                    <ChevronUp style={{ width: 15, height: 15, color: T.textMuted, flexShrink: 0 }} />
                  ) : (
                    <ChevronDown style={{ width: 15, height: 15, color: T.textMuted, flexShrink: 0 }} />
                  )}
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 18px", background: "rgba(0,31,63,0.02)" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 14,
                        marginBottom: 14,
                      }}
                    >
                      <Field label="TYPE" value={t.type === "INCIDENT" ? "Incident Report" : "Support Ticket"} />
                      <Field label="CATEGORY" value={t.category} />
                      <Field label="REPORTER" value={t.reporterName} />
                      <Field label="BADGE / SERVICE ID" value={t.reporterBadge} />
                      <Field label="EMAIL" value={t.reporterEmail || "not supplied"} />
                      <Field
                        label="SEVERITY"
                        value={SEVERITY_LABELS[t.severity] || t.severity}
                      />
                      <Field label="SUBMITTED" value={pretty(t.submittedAt)} />
                      <Field label="LAST UPDATED" value={pretty(t.updatedAt)} />
                      <Field label="SOURCE IP" value={t.submittedIp || "not recorded"} />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={labelStyle}>DETAILS AS SUBMITTED</div>
                      <pre
                        style={{
                          margin: "6px 0 0",
                          padding: "10px 12px",
                          background: T.cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: T.textPrimary,
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                        }}
                      >
                        {t.details}
                      </pre>
                    </div>

                    {t.diagnostics && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={labelStyle}>BROWSER DIAGNOSTICS</div>
                        <pre
                          style={{
                            margin: "6px 0 0",
                            padding: "10px 12px",
                            background: T.cardBg,
                            border: `1px solid ${T.border}`,
                            borderRadius: 6,
                            fontSize: 11,
                            color: T.textSecondary,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            overflowX: "auto",
                            fontFamily: ORCA_MONO,
                          }}
                        >
                          {t.diagnostics}
                        </pre>
                      </div>
                    )}

                    {/* Triage */}
                    {mayTriage && (
                      <div
                        style={{
                          background: T.cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          padding: 14,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ ...labelStyle, marginBottom: 10 }}>TRIAGE</div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 12,
                            marginBottom: 12,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={labelStyle}>STATUS</label>
                            <select
                              value={draftStatus}
                              onChange={(e) => setDraftStatus(e.target.value)}
                              style={controlStyle}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={labelStyle}>PRIORITY</label>
                            <select
                              value={draftPriority}
                              onChange={(e) => setDraftPriority(e.target.value)}
                              style={controlStyle}
                            >
                              <option value="">Not set</option>
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {PRIORITY_LABELS[p]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={labelStyle}>ASSIGNED TO</label>
                            <input
                              type="text"
                              value={draftAssignee}
                              maxLength={LIMITS.assignedTo}
                              onChange={(e) => setDraftAssignee(e.target.value)}
                              placeholder="Engineer or cell"
                              style={controlStyle}
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                          <label style={labelStyle}>
                            RESOLUTION NOTE — SHOWN TO THE REPORTER ON THE PUBLIC LOOKUP PAGE
                          </label>
                          <textarea
                            rows={3}
                            value={draftNote}
                            maxLength={LIMITS.resolutionNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="What was done, or why this is not actionable."
                            style={{ ...controlStyle, resize: "vertical", lineHeight: 1.5 }}
                          />
                        </div>

                        {saveError && (
                          <div
                            role="alert"
                            style={{
                              background: "rgba(239,68,68,0.06)",
                              border: `1px solid ${T.red}`,
                              borderRadius: 6,
                              padding: "9px 12px",
                              fontSize: 12,
                              color: T.red,
                              marginBottom: 10,
                            }}
                          >
                            {saveError}
                          </div>
                        )}

                        <button
                          onClick={() => void save()}
                          disabled={saving}
                          style={{
                            background: saving ? T.textMuted : T.navy,
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 18px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: saving ? "wait" : "pointer",
                          }}
                        >
                          {saving ? "Saving…" : "Save Triage"}
                        </button>
                      </div>
                    )}

                    {/* Event trail */}
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 8 }}>HISTORY</div>
                      {eventsLoading ? (
                        <div style={{ fontSize: 12, color: T.textMuted }}>Reading history…</div>
                      ) : events.length === 0 ? (
                        <div style={{ fontSize: 12, color: T.textMuted }}>No recorded activity.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {events.map((ev) => (
                            <div
                              key={ev.id}
                              style={{
                                display: "flex",
                                gap: 10,
                                alignItems: "baseline",
                                fontSize: 11.5,
                                color: T.textSecondary,
                                borderLeft: `2px solid ${T.border}`,
                                paddingLeft: 10,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: ORCA_MONO,
                                  fontSize: 10,
                                  color: T.textMuted,
                                  flexShrink: 0,
                                  minWidth: 130,
                                }}
                              >
                                {pretty(ev.at)}
                              </span>
                              <span>
                                <strong style={{ color: T.textPrimary }}>{ev.action}</strong>
                                {ev.note ? ` — ${ev.note}` : ""}
                                {ev.actor ? (
                                  <span style={{ color: T.textMuted }}> · {ev.actor}</span>
                                ) : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: T.textPrimary,
          marginTop: 3,
          overflowWrap: "anywhere",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}
