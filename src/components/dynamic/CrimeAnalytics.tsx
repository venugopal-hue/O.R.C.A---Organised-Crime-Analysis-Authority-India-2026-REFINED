"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, RefreshCw, Info, Inbox } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import { explainThreat, MIN_CASES_FOR_CONFIDENCE, type ThreatScore } from "@/lib/threatIndex";
import { SearchableSelect, type SelectOption } from "@/components/dynamic/SearchableSelect";
import { FirLiveAnalytics } from "@/components/dynamic/FirLiveAnalytics";

/**
 * Crime Analytics — district statistics counted from CaseMaster.
 *
 * Replaces a table of four districts of invented figures (28 cases, "9.4
 * Critical", a "Patrol Dispatch Rate" backed by no table anywhere) and two
 * dropdowns that were wired to nothing at all.
 *
 * Removed at the user's instruction, because neither can be sourced:
 *   Avg Resolution       CaseMaster has no closed/disposed timestamp.
 *   Patrol Dispatch Rate no patrol or dispatch table exists in the schema.
 *
 * Threat Index is kept, but rebuilt so it can be checked — see threatIndex.ts
 * for the formula. Every score on screen carries its own working in the
 * tooltip.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const RED = "#ef4444";
const ORANGE = "#f97316";
const BLUE = "#1E3A8A";
const GREEN = "#10b981";
const MONO = "JetBrains Mono, monospace";

interface Option { id: number; name: string }

interface Row {
  districtId: number;
  districtName: string;
  total: number;
  heinous: number;
  underInvestigation: number;
  chargeSheeted: number;
  closed: number;
  threat: ThreatScore;
}

interface Payload {
  configured: boolean;
  rows: Row[];
  totals: { total: number; heinous: number; underInvestigation: number; chargeSheeted: number; closed: number };
  unassigned: number;
  casesInSystem: number;
  filters: { districts: Option[]; categories: Option[]; gravities: Option[]; statuses: Option[] } | null;
}

/** SearchableSelect works in strings; the API returns numeric ids. */
const asOptions = (list: Option[] | undefined): SelectOption[] =>
  (list || []).map((o) => ({ id: String(o.id), label: o.name }));

const bandColour = (band: ThreatScore["band"]) =>
  band === "Critical" ? RED : band === "Elevated" ? ORANGE : band === "Moderate" ? BLUE : MUTED;

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: GRAY,
  textTransform: "uppercase",
  borderBottom: `2px solid ${BORDER}`,
  background: "rgba(0,0,0,0.01)",
  fontFamily: "'Inter', sans-serif",
  whiteSpace: "nowrap",
};

const tdNum: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
  fontFamily: MONO,
  color: TEXT,
};

export const CrimeAnalytics: React.FC = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Which half of Crime Analytics is on screen.
   *
   * FIR Live is a VIEW of this tab, not a tab of its own. Both halves count
   * `CaseMaster`; two separate screens counting the same table drift apart, and
   * when they do an officer has no way to tell which one is right. Keeping them
   * together is what stops that.
   */
  const [view, setView] = useState<"districts" | "fir">("districts");

  const [district, setDistrict] = useState("");
  const [category, setCategory] = useState("");
  const [gravity, setGravity] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (district) qs.set("district", district);
      if (category) qs.set("category", category);
      if (gravity) qs.set("gravity", gravity);
      if (status) qs.set("status", status);

      const res = await fetch(`/api/analytics/crime?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Could not load crime statistics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [district, category, gravity, status]);

  useEffect(() => { load(); }, [load]);

  const filtered = Boolean(district || category || gravity || status);

  /**
   * Which of the three empty states applies.
   *
   * Telling these apart matters: "nothing registered yet" is a normal state on
   * a new deployment, while "nothing matches your filter" is the officer's own
   * doing, and they need different words.
   */
  const emptyKind = useMemo(() => {
    if (!data) return null;
    if (!data.configured) return "unconfigured";
    if (data.casesInSystem === 0) return "no-cases";
    if (data.totals.total === 0) return filtered ? "no-match" : "unassigned";
    return null;
  }, [data, filtered]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      background: "#fff",
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      // NOT hidden. <Panel> uses overflow:hidden for its corners, and that
      // clipped the filter dropdowns half way down - which is why this
      // component carries the panel styling itself rather than being wrapped.
      overflow: "visible",
    }}>
      {/* ── View switch ──────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 4,
        padding: "10px 16px 0 16px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {([
          ["districts", "Districts", "Statewide totals and Threat Index by district"],
          ["fir", "FIR Live", "Time-based volumes, ageing and disposal speed"],
        ] as const).map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            title={hint}
            onClick={() => setView(id)}
            style={{
              padding: "9px 16px",
              border: "none",
              background: "transparent",
              borderBottom: `3px solid ${view === id ? SAFFRON : "transparent"}`,
              color: view === id ? NAVY : GRAY,
              fontWeight: view === id ? 800 : 600,
              fontSize: 13,
              cursor: "pointer",
              marginBottom: -1,
            }}
            aria-pressed={view === id}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "fir" ? (
        <FirLiveAnalytics />
      ) : (
      <>
      {/*
        SearchableSelect, not a native <select>: the browser renders a native
        option list as an OS-level popup, so its scrollbar is the operating
        system's and none of this project's styling reaches it. The rest of the
        console (Case Registration) uses this control for the same reason.
      */}
      <div style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "flex-end",
        padding: "14px 16px",
        background: "rgba(0,0,0,0.02)",
        borderBottom: `1px solid ${BORDER}`,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
      }}>
        <div style={{ minWidth: 210, flex: "1 1 210px", maxWidth: 260 }}>
          <SearchableSelect
            label="Sector District"
            value={district}
            onChange={setDistrict}
            options={asOptions(data?.filters?.districts)}
            placeholder="All Districts (Karnataka)"
            emptyMessage="No districts loaded"
          />
        </div>

        <div style={{ minWidth: 165, flex: "1 1 165px", maxWidth: 200 }}>
          <SearchableSelect
            label="Case Category"
            value={category}
            onChange={setCategory}
            options={asOptions(data?.filters?.categories)}
            placeholder="All Categories"
            emptyMessage="No categories loaded"
          />
        </div>

        <div style={{ minWidth: 150, flex: "1 1 150px", maxWidth: 190 }}>
          <SearchableSelect
            label="Gravity"
            value={gravity}
            onChange={setGravity}
            options={asOptions(data?.filters?.gravities)}
            placeholder="All"
            emptyMessage="No gravity levels loaded"
          />
        </div>

        <div style={{ minWidth: 175, flex: "1 1 175px", maxWidth: 210 }}>
          <SearchableSelect
            label="Case Status"
            value={status}
            onChange={setStatus}
            options={asOptions(data?.filters?.statuses)}
            placeholder="All"
            emptyMessage="No statuses loaded"
          />
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 12px",
            background: "transparent",
            border: `1px solid ${BORDER}`,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            color: GRAY,
            cursor: loading ? "default" : "pointer",
          }}
        >
          <RefreshCw style={{ width: 13, height: 13, animation: loading ? "spin 1s linear infinite" : undefined }} />
          Refresh
        </button>
      </div>

      {/* Summary strip — only when there is something to summarise. */}
      {data && data.totals.total > 0 && (
        <div style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          padding: "12px 16px",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {[
            ["Cases", data.totals.total, TEXT],
            ["Heinous", data.totals.heinous, RED],
            ["Under Investigation", data.totals.underInvestigation, ORANGE],
            ["Charge Sheeted", data.totals.chargeSheeted, BLUE],
            ["Closed", data.totals.closed, GREEN],
          ].map(([label, value, colour]) => (
            <div key={String(label)}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: MONO, color: colour as string }}>
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && !data && (
        <OrcaLoader padding="40px 16px" />
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "24px 16px", color: RED, fontSize: 13 }}>
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {emptyKind && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "36px 20px", color: GRAY, fontSize: 13, lineHeight: 1.6 }}>
          <Inbox style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: MUTED }} />
          <div>
            {emptyKind === "unconfigured" && (
              <>The case database is not configured on this server, so no statistics can be read.</>
            )}
            {emptyKind === "no-cases" && (
              <>
                <strong style={{ color: TEXT }}>No cases registered yet.</strong>
                <div style={{ marginTop: 4 }}>
                  Every figure on this screen is counted from registered FIRs. As cases are
                  entered through Case Registration, the districts below fill in on their own.
                </div>
              </>
            )}
            {emptyKind === "no-match" && (
              <>
                <strong style={{ color: TEXT }}>No cases match these filters.</strong>
                <div style={{ marginTop: 4 }}>
                  {data?.casesInSystem} case{data?.casesInSystem === 1 ? "" : "s"} registered in total.
                </div>
              </>
            )}
            {emptyKind === "unassigned" && (
              <>
                <strong style={{ color: TEXT }}>Cases are registered, but none map to a district.</strong>
                <div style={{ marginTop: 4 }}>
                  A case reaches its district through its police station
                  (<code style={{ fontFamily: MONO }}>PoliceStationID → Unit → District</code>).
                  {data?.unassigned ? ` ${data.unassigned} case(s) have a station that resolves to no district.` : ""}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {data && data.rows.length > 0 && !emptyKind && (
        <div style={{ overflowX: "auto", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["District", "Total Cases", "Heinous", "Under Investigation", "Charge Sheeted", "Closed", "Threat Index"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const colour = bandColour(row.threat.band);
                const tip = explainThreat(row.threat, { total: row.total });
                return (
                  <tr
                    key={row.districtId}
                    style={{ borderBottom: `1px solid ${BORDER}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: NAVY }}>
                      {row.districtName}
                    </td>
                    <td style={tdNum}>{row.total}</td>
                    <td style={{ ...tdNum, color: row.heinous ? RED : MUTED, fontWeight: row.heinous ? 600 : 400 }}>
                      {row.heinous}
                    </td>
                    <td style={tdNum}>{row.underInvestigation}</td>
                    <td style={tdNum}>{row.chargeSheeted}</td>
                    <td style={tdNum}>{row.closed}</td>
                    <td style={{ padding: "14px 16px" }}>
                      {row.threat.score === null ? (
                        <span style={{ fontSize: 12, color: MUTED }} title={tip}>No cases</span>
                      ) : (
                        <span
                          title={tip}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: `${colour}18`,
                            color: colour,
                            padding: "3px 8px",
                            borderRadius: 4,
                            fontSize: 11.5,
                            fontWeight: 600,
                            fontFamily: MONO,
                            cursor: "help",
                          }}
                        >
                          {row.threat.score.toFixed(1)} {row.threat.band}
                          {row.threat.provisional && (
                            <Info style={{ width: 11, height: 11, opacity: 0.8 }} />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* What the index is, stated on the screen rather than only in the code.
          The number it replaced was a literal with no definition anywhere. */}
      {data && data.totals.total > 0 && (
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${BORDER}`, fontSize: 11.5, color: GRAY, lineHeight: 1.7 }}>
          <strong style={{ color: NAVY }}>Threat Index</strong> — 0-10, weighted from registered cases:
          {" "}50% share of heinous offences, 30% share not yet closed, 20% case volume relative to the
          busiest district shown. Hover any score for its working.
          {" "}<span style={{ color: MUTED }}>
            Bands: 7.0+ Critical · 4.5+ Elevated · below Moderate. Scores marked
            {" "}<Info style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle" }} />{" "}
            rest on fewer than {MIN_CASES_FOR_CONFIDENCE} cases and are provisional.
            It reflects reported cases and workload only — not crime rate, not prediction,
            and not any officer&apos;s performance.
          </span>
          {data.unassigned > 0 && (
            <div style={{ marginTop: 6, color: ORANGE }}>
              {data.unassigned} case(s) excluded: their police station maps to no district.
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default CrimeAnalytics;
