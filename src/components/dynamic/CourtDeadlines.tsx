"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import {
  AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw,
  Scale, Inbox, Filter, TrendingUp,
} from "lucide-react";
import type { CaseDeadline, DeadlineStatus, DeadlineSummary } from "@/app/api/case/deadlines/route";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

const STATUS_CFG: Record<
  DeadlineStatus,
  { label: string; bg: string; text: string; border: string; Icon: React.FC<{ size?: number }> }
> = {
  OVERDUE:  { label: "OVERDUE",   bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", Icon: AlertTriangle },
  CRITICAL: { label: "CRITICAL",  bg: "#fff7ed", text: "#92400e", border: "#fcd34d", Icon: AlertTriangle },
  WARNING:  { label: "WARNING",   bg: "#fefce8", text: "#713f12", border: "#fde68a", Icon: Clock },
  ON_TRACK: { label: "ON TRACK",  bg: "#f0fdf4", text: "#14532d", border: "#86efac", Icon: TrendingUp },
  FILED:    { label: "FILED",     bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", Icon: CheckCircle2 },
  CLOSED:   { label: "CLOSED",    bg: "#f8fafc", text: "#475569", border: "#cbd5e1", Icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: DeadlineStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap",
    }}>
      <cfg.Icon size={9} />
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function DaysChip({ days, status }: { days: number | null; status: DeadlineStatus }) {
  if (status === "FILED" || status === "CLOSED") return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  if (days === null) return <span style={{ color: MUTED, fontSize: 12 }}>Unknown</span>;

  const colour = status === "OVERDUE" ? "#991b1b"
    : status === "CRITICAL" ? "#92400e"
    : status === "WARNING"  ? "#713f12"
    : "#14532d";

  const bg = status === "OVERDUE" ? "#fef2f2"
    : status === "CRITICAL" ? "#fff7ed"
    : status === "WARNING"  ? "#fefce8"
    : "#f0fdf4";

  const text = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`;

  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 8,
      background: bg, color: colour, fontSize: 11, fontWeight: 700,
      fontFamily: "JetBrains Mono, monospace",
    }}>
      {text}
    </span>
  );
}

const SUMMARY_CARDS = [
  { key: "overdue",  label: "Overdue",     colour: "#991b1b", bg: "#fef2f2", border: "#fca5a5" },
  { key: "critical", label: "Critical",    colour: "#92400e", bg: "#fff7ed", border: "#fcd34d" },
  { key: "warning",  label: "Warning",     colour: "#713f12", bg: "#fefce8", border: "#fde68a" },
  { key: "onTrack",  label: "On Track",    colour: "#14532d", bg: "#f0fdf4", border: "#86efac" },
  { key: "filed",    label: "Filed",       colour: "#1e40af", bg: "#eff6ff", border: "#93c5fd" },
] as const;

const STATUS_FILTER_OPTIONS: { value: DeadlineStatus | "ALL" | "ACTIVE"; label: string }[] = [
  { value: "ACTIVE",   label: "Active (excl. closed)" },
  { value: "ALL",      label: "All cases" },
  { value: "OVERDUE",  label: "Overdue" },
  { value: "CRITICAL", label: "Critical (≤7d)" },
  { value: "WARNING",  label: "Warning (≤14d)" },
  { value: "ON_TRACK", label: "On Track" },
  { value: "FILED",    label: "Filed" },
  { value: "CLOSED",   label: "Closed" },
];

export const CourtDeadlines: React.FC = () => {
  const [deadlines, setDeadlines] = useState<CaseDeadline[]>([]);
  const [summary, setSummary]     = useState<DeadlineSummary | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Default: hide Closed cases — they need no action.
  const [statusFilter, setStatusFilter] = useState<DeadlineStatus | "ALL" | "ACTIVE">("ACTIVE");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [gravityFilter, setGravityFilter] = useState<"ALL" | "heinous" | "other">("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/case/deadlines");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.configured) {
        setError("Records store not connected — deadline data unavailable.");
        return;
      }
      setDeadlines(data.deadlines ?? []);
      setSummary(data.summary ?? null);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setError(e.message || "Failed to load deadlines.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const districts = useMemo(() => {
    const set = new Set(deadlines.map((d) => d.districtName).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [deadlines]);

  const filtered = useMemo(() => {
    return deadlines.filter((d) => {
      if (statusFilter === "ACTIVE" && (d.status === "CLOSED")) return false;
      if (statusFilter !== "ALL" && statusFilter !== "ACTIVE" && d.status !== statusFilter) return false;
      if (districtFilter !== "ALL" && d.districtName !== districtFilter) return false;
      if (gravityFilter === "heinous" && !d.isHeinous) return false;
      if (gravityFilter === "other"   &&  d.isHeinous) return false;
      return true;
    });
  }, [deadlines, statusFilter, districtFilter, gravityFilter]);

  // Reset to page 1 whenever filters change.
  useEffect(() => { setPage(1); }, [statusFilter, districtFilter, gravityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {SUMMARY_CARDS.map(({ key, label, colour, bg, border }) => {
            const isOverdue = key === "overdue";
            const overdueCount = summary[key as keyof DeadlineSummary] ?? 0;
            const active = statusFilter === key.toUpperCase().replace("ONTRACK", "ON_TRACK") as any;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(active ? "ALL" : key.toUpperCase().replace("ONTRACK", "ON_TRACK") as any)}
                style={{
                  background: bg, border: `1px solid ${border}`,
                  borderRadius: 8, padding: "12px 14px", textAlign: "left",
                  cursor: "pointer", transition: "box-shadow 0.15s",
                  boxShadow: active ? `0 0 0 2px ${colour}` : "none",
                  position: "relative",
                }}
              >
                {/* Blinking alert icon for overdue when count > 0 */}
                {isOverdue && overdueCount > 0 && (
                  <AlertTriangle
                    size={13}
                    color={colour}
                    style={{
                      position: "absolute", top: 10, right: 10,
                      animation: "blink 1.2s step-start infinite",
                    }}
                  />
                )}
                <div style={{ fontSize: 22, fontWeight: 800, color: colour, fontFamily: "JetBrains Mono, monospace" }}>
                  {overdueCount}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: colour, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                  {label}
                </div>
              </button>
            );
          })}
          <div style={{
            background: WHITE, border: `1px solid ${BORDER}`,
            borderRadius: 8, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>
              {summary.total}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
              Total Cases
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8,
        padding: "12px 16px", marginBottom: 16,
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        <Filter size={14} color={GRAY} style={{ flexShrink: 0 }} />

        {/* Status filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <button key={value}
              onClick={() => setStatusFilter(value as DeadlineStatus | "ALL" | "ACTIVE")}
              style={{
                padding: "4px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                cursor: "pointer",
                background: statusFilter === value ? NAVY : "transparent",
                color: statusFilter === value ? WHITE : GRAY,
                border: `1px solid ${statusFilter === value ? NAVY : BORDER}`,
              }}
            >{label}</button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* District filter */}
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            style={{
              padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6,
              fontSize: 12, color: NAVY, background: WHITE, cursor: "pointer", outline: "none",
            }}
          >
            {districts.map((d) => (
              <option key={d} value={d}>{d === "ALL" ? "All districts" : d}</option>
            ))}
          </select>

          {/* Gravity filter */}
          <select
            value={gravityFilter}
            onChange={(e) => setGravityFilter(e.target.value as any)}
            style={{
              padding: "5px 10px", border: `1px solid ${BORDER}`, borderRadius: 6,
              fontSize: 12, color: NAVY, background: WHITE, cursor: "pointer", outline: "none",
            }}
          >
            <option value="ALL">All gravity</option>
            <option value="heinous">Heinous (60-day limit)</option>
            <option value="other">Other (90-day limit)</option>
          </select>

          {/* Refresh + last refreshed */}
          <button onClick={load} disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer",
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          {lastRefreshed && (
            <span style={{ fontSize: 10, color: MUTED }}>
              Updated {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && <OrcaLoader />}

      {/* Error */}
      {error && !loading && (
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          background: "#fef2f2", border: `1px solid #fca5a5`,
          borderRadius: 8, padding: "12px 16px",
        }}>
          <AlertTriangle size={15} color="#991b1b" style={{ marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && deadlines.length > 0 && (
        <div style={{
          textAlign: "center", padding: "40px 24px",
          border: `1px dashed ${BORDER}`, borderRadius: 8, color: GRAY,
        }}>
          <Filter size={28} color={BORDER} style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: 13 }}>No cases match the selected filters.</div>
        </div>
      )}
      {!loading && !error && deadlines.length === 0 && (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          border: `1px dashed ${BORDER}`, borderRadius: 8, color: GRAY,
        }}>
          <Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>No cases with FIR dates found</div>
          <div style={{ fontSize: 12, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
            Deadline tracking requires a Crime Registered Date on each case. Register cases through Case Registration to populate this view.
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          background: WHITE, border: `1px solid ${BORDER}`,
          borderRadius: 8, overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          {/* Result count */}
          <div style={{
            padding: "10px 16px", borderBottom: `1px solid ${BORDER}`,
            fontSize: 11, color: GRAY, fontWeight: 600,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "rgba(0,0,0,0.01)",
          }}>
            <span>
              {filtered.length} case{filtered.length !== 1 ? "s" : ""}
              {totalPages > 1 && (
                <span style={{ color: MUTED, fontWeight: 400, marginLeft: 6 }}>
                  · showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, color: MUTED }}>Sorted by urgency · CrPC §167(2)</span>
          </div>

          {/* Column headers */}
          <div style={{
            display: "flex", alignItems: "center",
            borderBottom: `1px solid ${BORDER}`,
            background: "#f8fafc",
          }}>
            <div style={{ width: 4, flexShrink: 0 }} />
            {(["Crime No.", "District / Station", "Registered", "Limit", "Days Left", "Status"] as const).map((h, i) => (
              <div key={h} style={{
                flex: [1.6, 1.2, 1.2, 0.8, 1, 1.2][i],
                padding: "8px 10px",
                fontSize: 10, fontWeight: 700, color: GRAY,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {paginated.map((d, i) => {
            const accentColor = d.status === "OVERDUE" ? "#dc2626"
              : d.status === "CRITICAL" ? "#d97706"
              : d.status === "WARNING"  ? "#ca8a04"
              : "transparent";
            return (
              <div key={d.caseMasterId} style={{
                display: "flex", alignItems: "center",
                borderBottom: i < paginated.length - 1 ? `1px solid ${BORDER}` : "none",
                background: i % 2 === 0 ? WHITE : "#fcfcfd",
              }}>
                {/* Left accent bar */}
                <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: accentColor }} />

                {/* Crime No */}
                <div style={{ flex: 1.6, padding: "11px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>
                    {d.crimeNo}
                  </div>
                  {d.isHeinous && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
                      Heinous · 60-day limit
                    </div>
                  )}
                </div>

                {/* District / Station */}
                <div style={{ flex: 1.2, padding: "11px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{d.districtName}</div>
                  <div style={{ fontSize: 10, color: GRAY, marginTop: 1 }}>{d.stationName}</div>
                </div>

                {/* Registered */}
                <div style={{ flex: 1.2, padding: "11px 10px", fontSize: 12, color: GRAY, fontFamily: "JetBrains Mono, monospace" }}>
                  {fmtDate(d.registeredDate)}
                </div>

                {/* Limit */}
                <div style={{ flex: 0.8, padding: "11px 10px", fontSize: 12, color: GRAY, fontFamily: "JetBrains Mono, monospace" }}>
                  {d.deadlineDays}d
                  <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>by {fmtDate(d.deadlineDate)}</div>
                </div>

                {/* Days left */}
                <div style={{ flex: 1, padding: "11px 10px" }}>
                  <DaysChip days={d.daysRemaining} status={d.status} />
                </div>

                {/* Status */}
                <div style={{ flex: 1.2, padding: "11px 10px" }}>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, padding: "14px 0",
        }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: `1px solid ${BORDER}`, background: WHITE,
              color: page === 1 ? MUTED : NAVY, cursor: page === 1 ? "default" : "pointer",
            }}
          >← Prev</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: MUTED, padding: "0 4px" }}>…</span>
              ) : (
                <button key={p}
                  onClick={() => setPage(p as number)}
                  style={{
                    width: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${page === p ? NAVY : BORDER}`,
                    background: page === p ? NAVY : WHITE,
                    color: page === p ? WHITE : NAVY,
                    cursor: "pointer",
                  }}
                >{p}</button>
              )
            )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: `1px solid ${BORDER}`, background: WHITE,
              color: page === totalPages ? MUTED : NAVY, cursor: page === totalPages ? "default" : "pointer",
            }}
          >Next →</button>
        </div>
      )}

      {/* Footer note */}
      {!loading && deadlines.length > 0 && (
        <div style={{
          marginTop: 16, padding: "10px 14px",
          background: "#f8fafc", border: `1px solid ${BORDER}`, borderRadius: 6,
          fontSize: 11, color: MUTED, lineHeight: 1.6,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <Scale size={12} style={{ marginTop: 2, flexShrink: 0 }} color={MUTED} />
          <span>
            Deadlines are computed from the FIR registration date under CrPC Section 167(2):
            60 days for heinous offences (punishable by death or life imprisonment), 90 days for all others.
            A missed deadline entitles the accused to apply for default bail.
            This tracker is informational — confirm with the case diary before any court action.
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
};
