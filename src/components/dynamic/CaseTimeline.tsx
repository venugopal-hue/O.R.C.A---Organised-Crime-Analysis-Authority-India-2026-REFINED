"use client";

import React, { useState, useCallback } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import {
  Search, Loader2, AlertTriangle, FileText, Clock,
  CheckCircle2, Activity, ShieldAlert, FileCheck, Inbox, MapPin, Calendar,
} from "lucide-react";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const GRAY   = ORCA_TOKENS.textGray;
const WHITE  = ORCA_TOKENS.white;
const SUCCESS  = "#16A34A";
const DANGER   = "#DC2626";
const PURPLE   = "#7C3AED";
const AMBER    = "#D97706";
const BLUE     = "#0369A1";
const SAFFRON  = "#FF9933";
const MONO     = "JetBrains Mono, monospace";

type EventKind =
  | "registration"
  | "incident_window"
  | "section_added"
  | "task_created"
  | "task_status"
  | "task_completed"
  | "document_verified";

interface TimelineEvent {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  detail: string;
  meta?: Record<string, string | number | null>;
}

interface TimelineResponse {
  caseId?: number;
  crimeNo?: string | null;
  caseTitle?: string | null;
  districtName?: string | null;
  events?: TimelineEvent[];
  error?: string;
}

const KIND_CONFIG: Record<
  EventKind,
  { label: string; colour: string; bg: string; Icon: React.FC<{ size?: number; color?: string }> }
> = {
  registration:      { label: "Case Registered",   colour: NAVY,    bg: "rgba(0,31,63,0.08)",    Icon: ShieldAlert   },
  incident_window:   { label: "Offence Period",     colour: DANGER,  bg: "rgba(220,38,38,0.08)",  Icon: AlertTriangle },
  section_added:     { label: "Section Applied",    colour: PURPLE,  bg: "rgba(124,58,237,0.08)", Icon: FileText      },
  task_created:      { label: "Task Created",       colour: SAFFRON, bg: "rgba(255,153,51,0.08)", Icon: Activity      },
  task_status:       { label: "Task Update",        colour: AMBER,   bg: "rgba(217,119,6,0.08)",  Icon: Clock         },
  task_completed:    { label: "Task Completed",     colour: SUCCESS, bg: "rgba(22,163,74,0.08)",  Icon: CheckCircle2  },
  document_verified: { label: "Document Verified",  colour: BLUE,    bg: "rgba(3,105,161,0.08)",  Icon: FileCheck     },
};

function fmt(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

export const CaseTimeline: React.FC = () => {
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<TimelineResponse | null>(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/case/timeline?caseId=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error ${res.status}`);
        setResult(null);
        return;
      }
      const data: TimelineResponse = await res.json();
      if (data.error || !data.events) {
        setError(data.error ?? "No data returned");
        setResult(null);
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Network error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") search(query);
  };

  const groupedEvents: { dayLabel: string; events: TimelineEvent[] }[] = [];
  if (result?.events) {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of result.events) {
      const day = fmtDay(ev.date);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ev);
    }
    for (const [day, evs] of map) groupedEvents.push({ dayLabel: day, events: evs });
  }

  const firstDate = result?.events?.[0]?.date;
  const lastDate  = result?.events?.[result.events.length - 1]?.date;
  const span = firstDate && lastDate && firstDate !== lastDate
    ? `${new Date(firstDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} — ${new Date(lastDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
    : firstDate
    ? new Date(firstDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>

      {/* Search */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 28,
        border: `1.5px solid ${BORDER}`,
        borderRadius: 10, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        background: WHITE,
      }}>
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 16, paddingRight: 4 }}>
          <Search size={16} color={GRAY} />
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Crime Number or Case ID — e.g. 100010001202600006"
          style={{
            flex: 1, border: "none", outline: "none",
            fontSize: 13, color: "#1e293b", background: "transparent",
            padding: "13px 8px", fontFamily: "'Inter', sans-serif",
          }}
        />
        <button
          onClick={() => search(query)}
          disabled={loading || !query.trim()}
          style={{
            padding: "0 24px",
            background: loading || !query.trim() ? "#94a3b8" : NAVY,
            color: WHITE, border: "none",
            fontSize: 12.5, fontWeight: 700, cursor: loading ? "default" : "pointer",
            letterSpacing: "0.04em", transition: "background 0.15s",
            display: "flex", alignItems: "center", gap: 7,
          }}
        >
          {loading
            ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Reconstructing</>
            : "Reconstruct"}
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: "#fff5f5", border: `1px solid #fca5a5`,
          borderLeft: `4px solid ${DANGER}`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 20,
        }}>
          <AlertTriangle size={15} color={DANGER} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: DANGER }}>{error}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && searched && result && (result.events?.length ?? 0) === 0 && (
        <div style={{
          textAlign: "center", padding: "56px 24px",
          color: GRAY, border: `1px dashed ${BORDER}`, borderRadius: 10,
        }}>
          <Inbox size={28} color={BORDER} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>No events recorded for this case.</div>
          <div style={{ fontSize: 12, marginTop: 4, color: GRAY }}>The case exists but has no linked activity yet.</div>
        </div>
      )}

      {/* Timeline */}
      {result?.events && result.events.length > 0 && (
        <>
          {/* Case summary bar */}
          <div style={{
            background: NAVY, color: WHITE, borderRadius: 10,
            padding: "18px 22px", marginBottom: 24,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12, alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                Case Timeline
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, fontFamily: MONO, letterSpacing: "0.01em" }}>
                {result.crimeNo || `Case #${result.caseId}`}
              </div>
              {result.caseTitle && (
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4, lineHeight: 1.4 }}>
                  {result.caseTitle}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {result.districtName && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.7 }}>
                  <MapPin size={11} />
                  {result.districtName}
                </div>
              )}
              {span && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.7 }}>
                  <Calendar size={11} />
                  {span}
                </div>
              )}
              <div style={{
                marginTop: 2,
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6, padding: "3px 10px",
                fontSize: 11, fontWeight: 700, fontFamily: MONO,
              }}>
                {result.events.length} event{result.events.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Event groups */}
          <div style={{ paddingLeft: 8 }}>
            {groupedEvents.map((group, gi) => (
              <div key={gi}>
                {/* Day separator */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px",
                }}>
                  <div style={{ height: 1, flex: 1, background: BORDER }} />
                  <div style={{
                    fontSize: 9.5, fontWeight: 800, color: GRAY,
                    letterSpacing: "0.1em",
                    padding: "3px 12px",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 20,
                    background: "#f8fafc",
                  }}>
                    {group.dayLabel}
                  </div>
                  <div style={{ height: 1, flex: 1, background: BORDER }} />
                </div>

                {group.events.map((ev, ei) => {
                  const cfg = KIND_CONFIG[ev.kind];
                  const isLast = gi === groupedEvents.length - 1 && ei === group.events.length - 1;

                  return (
                    <div key={ev.id} style={{
                      display: "flex", gap: 0, marginBottom: isLast ? 0 : 12,
                    }}>
                      {/* Rail + node */}
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        width: 44, flexShrink: 0, paddingTop: 2,
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: cfg.bg,
                          border: `2px solid ${cfg.colour}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, zIndex: 1,
                        }}>
                          <cfg.Icon size={14} color={cfg.colour} />
                        </div>
                        {!isLast && (
                          <div style={{
                            width: 2, flex: 1, minHeight: 16,
                            background: `linear-gradient(to bottom, ${cfg.colour}40, ${BORDER})`,
                            marginTop: 2,
                          }} />
                        )}
                      </div>

                      {/* Card */}
                      <div style={{
                        flex: 1,
                        background: WHITE,
                        border: `1px solid ${BORDER}`,
                        borderLeft: `3px solid ${cfg.colour}`,
                        borderRadius: "0 8px 8px 0",
                        padding: "11px 16px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        marginLeft: 8,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div>
                            <span style={{
                              fontSize: 9.5, fontWeight: 800, color: cfg.colour,
                              textTransform: "uppercase", letterSpacing: "0.07em",
                              marginRight: 8,
                            }}>
                              {cfg.label}
                            </span>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginTop: 3 }}>
                              {ev.title}
                            </div>
                          </div>
                          <div style={{
                            fontSize: 10.5, color: GRAY, whiteSpace: "nowrap",
                            flexShrink: 0, fontFamily: MONO, marginTop: 2,
                          }}>
                            {fmt(ev.date)}
                          </div>
                        </div>
                        {ev.detail && (
                          <div style={{ fontSize: 12, color: GRAY, marginTop: 6, lineHeight: 1.6 }}>
                            {ev.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Initial placeholder */}
      {!searched && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px",
          border: `1px dashed ${BORDER}`, borderRadius: 10,
          background: "rgba(0,31,63,0.015)",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "rgba(0,31,63,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}>
            <Activity size={24} color={NAVY} style={{ opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
            Case Timeline Reconstructor
          </div>
          <div style={{ fontSize: 12.5, color: GRAY, maxWidth: 400, textAlign: "center", lineHeight: 1.7 }}>
            Enter a Crime Number or internal Case ID to reconstruct the complete event
            history — registration, offence window, IPC sections, task activity, and document verification.
          </div>
          <div style={{
            marginTop: 18, fontSize: 11, color: GRAY, fontFamily: MONO,
            background: "rgba(0,31,63,0.05)", padding: "6px 14px", borderRadius: 6,
          }}>
            e.g. 100010001202600006
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
