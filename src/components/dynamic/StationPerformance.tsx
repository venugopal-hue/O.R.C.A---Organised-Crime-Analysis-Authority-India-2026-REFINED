"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Building2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { StationMetrics } from "@/app/api/analytics/stations/route";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

type SortKey = "total" | "closureRate" | "csRate" | "active" | "avgDaysOpen" | "oldestActiveDays";

function RateCell({ value, low, mid }: { value: number; low: number; mid: number }) {
  const bg   = value >= mid ? "#f0fdf4" : value >= low ? "#fefce8" : "#fef2f2";
  const col  = value >= mid ? "#15803d" : value >= low ? "#854d0e" : "#991b1b";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
      background: bg, color: col,
    }}>
      {value}%
    </span>
  );
}

function DaysCell({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: MUTED, fontSize: 12 }}>—</span>;
  const col = value > 365 ? "#991b1b" : value > 180 ? "#854d0e" : GRAY;
  return <span style={{ fontSize: 12, fontWeight: 600, color: col }}>{value}d</span>;
}

const SortTh: React.FC<{
  label: string; col: SortKey; sort: SortKey; dir: "asc"|"desc";
  onClick: (c: SortKey) => void; align?: "right"|"left";
}> = ({ label, col, sort, dir, onClick, align = "right" }) => (
  <th
    onClick={() => onClick(col)}
    style={{
      padding: "8px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: sort === col ? NAVY : GRAY,
      cursor: "pointer", userSelect: "none", textAlign: align,
      background: "#f8fafc", borderBottom: `1px solid ${BORDER}`,
      whiteSpace: "nowrap",
    }}
  >
    {label} {sort === col ? (dir === "desc" ? "↓" : "↑") : ""}
  </th>
);

export const StationPerformance: React.FC = () => {
  const [stations, setStations] = useState<StationMetrics[]>([]);
  const [summary, setSummary]   = useState<{ totalStations: number; totalCases: number; totalClosed: number; totalCS: number; totalActive: number } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [distFilter, setDistFilter] = useState("ALL");
  const [sort, setSort]         = useState<SortKey>("total");
  const [dir, setDir]           = useState<"asc"|"desc">("desc");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/analytics/stations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setStations(data.stations ?? []);
      setSummary(data.summary ?? null);
    } catch (e: any) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    stations.forEach((s) => { if (s.districtName) set.add(s.districtName); });
    return ["ALL", ...Array.from(set).sort()];
  }, [stations]);

  const handleSort = (col: SortKey) => {
    if (sort === col) setDir((d) => d === "desc" ? "asc" : "desc");
    else { setSort(col); setDir("desc"); }
  };

  const displayed = useMemo(() => {
    let rows = stations;
    if (distFilter !== "ALL") rows = rows.filter((s) => s.districtName === distFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((s) => s.stationName.toLowerCase().includes(q) || s.districtName.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = a[sort] ?? -1;
      const bv = b[sort] ?? -1;
      return dir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [stations, distFilter, search, sort, dir]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        background: "#f8fafc", borderRadius: 8,
        padding: "12px 16px", marginBottom: 20,
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search station or district…"
          style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", width: 220 }}
        />
        <select
          value={distFilter}
          onChange={(e) => setDistFilter(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, background: WHITE }}
        >
          {districts.map((d) => <option key={d} value={d}>{d === "ALL" ? "All Districts" : d}</option>)}
        </select>
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer", marginLeft: "auto" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Stations",   value: summary.totalStations, col: NAVY },
            { label: "Total Cases",value: summary.totalCases,    col: NAVY },
            { label: "Closed",     value: summary.totalClosed,   col: "#15803d" },
            { label: "Charge-sheeted", value: summary.totalCS,   col: "#1d4ed8" },
            { label: "Active",     value: summary.totalActive,   col: "#dc2626" },
          ].map(({ label, value, col }) => (
            <div key={label} style={{ background: WHITE, borderRadius: 8, padding: "12px 16px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${col}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{value.toLocaleString("en-IN")}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <OrcaLoader />}
      {error && !loading && (
        <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}>
          <AlertTriangle size={15} color="#991b1b" style={{ marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
        </div>
      )}

      {/* Table */}
      {!loading && !error && displayed.length > 0 && (
        <div style={{ background: WHITE, borderRadius: 8, overflow: "auto", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GRAY, background: "#f8fafc", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>Station</th>
                <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: GRAY, background: "#f8fafc", borderBottom: `1px solid ${BORDER}`, textAlign: "left" }}>District</th>
                <SortTh label="Total"   col="total"           sort={sort} dir={dir} onClick={handleSort} />
                <SortTh label="Active"  col="active"          sort={sort} dir={dir} onClick={handleSort} />
                <SortTh label="Closure%" col="closureRate"    sort={sort} dir={dir} onClick={handleSort} />
                <SortTh label="CS%"     col="csRate"          sort={sort} dir={dir} onClick={handleSort} />
                <SortTh label="Avg Days Open" col="avgDaysOpen" sort={sort} dir={dir} onClick={handleSort} />
                <SortTh label="Oldest Active" col="oldestActiveDays" sort={sort} dir={dir} onClick={handleSort} />
              </tr>
            </thead>
            <tbody>
              {displayed.map((st, i) => (
                <tr key={st.stationId} style={{ background: i % 2 === 0 ? WHITE : "#f8fafc" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: NAVY, borderBottom: `1px solid ${BORDER}` }}>
                    {st.stationName}
                  </td>
                  <td style={{ padding: "9px 12px", fontSize: 12, color: GRAY, borderBottom: `1px solid ${BORDER}` }}>
                    {st.districtName}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: NAVY, borderBottom: `1px solid ${BORDER}` }}>
                    {st.total}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: st.active > 0 ? "#dc2626" : GRAY, borderBottom: `1px solid ${BORDER}` }}>
                    {st.active}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", borderBottom: `1px solid ${BORDER}` }}>
                    <RateCell value={st.closureRate} low={30} mid={60} />
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", borderBottom: `1px solid ${BORDER}` }}>
                    <RateCell value={st.csRate} low={20} mid={50} />
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", borderBottom: `1px solid ${BORDER}` }}>
                    <DaysCell value={st.avgDaysOpen} />
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", borderBottom: `1px solid ${BORDER}` }}>
                    <DaysCell value={st.oldestActiveDays} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "8px 16px", fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}` }}>
            {displayed.length} station{displayed.length !== 1 ? "s" : ""}
            {distFilter !== "ALL" ? ` in ${distFilter}` : ""}
            {search.trim() ? ` matching "${search}"` : ""}
          </div>
        </div>
      )}

      {!loading && !error && displayed.length === 0 && stations.length > 0 && (
        <div style={{ textAlign: "center", padding: "32px", color: GRAY, fontSize: 13 }}>No stations match the current filter.</div>
      )}
      {!loading && !error && stations.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px", color: GRAY, fontSize: 13 }}>No case data found.</div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
