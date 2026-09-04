"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Loader2, RefreshCw, Inbox, Brain, FileDown,
  ShieldAlert, TrendingUp, LayoutList, MapPin, Repeat, CalendarDays, CheckCircle2, Sparkles, Navigation,
} from "lucide-react";
import type { RiskLevel } from "@/app/api/analytics/predictive/route";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";

/**
 * Predictive Analytics — a third view inside Crime Analytics.
 *
 * Four sections:
 *   1. Risk Indicator     — deterministic classification from backend
 *   2. Crime Trend        — 30-day historical bars + 7-day forecast bars
 *   3. Geographic Hotspots — districts ranked by case volume with coordinates
 *   4. Key Intelligence   — AI-generated summary of the above numbers
 *
 * The LLM section renders last and independently: deterministic analytics appear
 * immediately; the summary arrives when the LLM responds. If the LLM is
 * unavailable the rest of the panel is unaffected.
 *
 * All data originates from the backend. Nothing is calculated or invented here.
 */

// ── Design tokens (shared with CrimeAnalytics) ─────────────────────────────
const NAVY   = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER  = "#cbd5e1";
const TEXT    = "#1e293b";
const GRAY    = "#475569";
const MUTED   = "#94a3b8";
const RED     = "#ef4444";
const ORANGE  = "#f97316";
const GREEN   = "#10b981";
const MONO    = "JetBrains Mono, monospace";

const RISK_META: Record<RiskLevel, { label: string; colour: string; bg: string; description: string }> = {
  NORMAL: {
    label: "Normal",
    colour: GREEN,
    bg: "#d1fae5",
    description: "Current activity is within the expected historical range.",
  },
  ELEVATED_HISTORICAL_RISK: {
    label: "Elevated Historical Risk",
    colour: ORANGE,
    bg: "#ffedd5",
    description: "Case registrations are moderately above the 8-week baseline.",
  },
  SIGNIFICANT_INCREASE: {
    label: "Significant Increase",
    colour: "#dc2626",
    bg: "#fee2e2",
    description: "Case registrations are significantly above the 8-week baseline — increased operational attention warranted.",
  },
  CRITICAL_PATTERN_DETECTED: {
    label: "Critical Pattern Detected",
    colour: "#7f1d1d",
    bg: "#fecaca",
    description: "Case registrations are critically elevated relative to the 8-week baseline — immediate supervisory review required.",
  },
};

interface ForecastData {
  available: boolean;
  historicalTrend: { date: string; count: number }[];
  forecastPoints: { date: string; count: number; lower: number; upper: number }[] | null;
  forecastTotal: number | null;
  daysWithData: number;
  methodology: string | null;
}

interface Hotspot {
  districtId: number;
  districtName: string;
  latitude: number | null;
  longitude: number | null;
  total: number;
  heinous: number;
  districtRisk: {
    level: RiskLevel;
    currentWeekCount: number;
    baselineWeekAvg: number;
  };
}

interface CategoryBreakdown {
  headId: number;
  headName: string;
  last30Total: number;
  forecastedWeekTotal: number | null;
}

interface RepeatLocation {
  stationId: number;
  stationName: string;
  districtId: number | null;
  districtName: string;
  allTimeTotal: number;
  last30Total: number;
  concentrationRatio: number;
  flag: "HIGH" | "MEDIUM" | "LOW" | null;
}

interface PatrolRec {
  districtId: number;
  districtName: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  riskLevel: RiskLevel;
  currentWeekCount: number;
  totalCases: number;
  heinousCases: number;
  recommendedDays: string[];
  flaggedStations: { name: string; flag: string | null; ratio: number }[];
  rationale: string;
}

interface DayCell {
  day: string;
  count: number;
  intensity: number;
  sharePct: number;
}

interface Payload {
  configured: boolean;
  today: string;
  forecast: ForecastData;
  riskIndicator: {
    level: RiskLevel;
    currentWeekCount: number;
    baselineWeekAvg: number;
    baselineWeeks: number;
  };
  hotspots: Hotspot[];
  repeatLocations: RepeatLocation[];
  categoryBreakdown: CategoryBreakdown[];
  dayHeatmap: DayCell[];
  peakDay: DayCell | null;
  closureWeeks: { weekLabel: string; registered: number; closed: number; rate: number }[];
  patrolRecommendations: PatrolRec[];
  summary: string | null;
}

// ── Mini bar-chart (SVG) ────────────────────────────────────────────────────

interface Bar {
  date: string;
  count: number;
  isForecast: boolean;
  lower?: number;
  upper?: number;
}

const TrendChart: React.FC<{ bars: Bar[]; maxVal: number }> = ({ bars, maxVal }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const W = 700;
  const H = 160;
  const PAD_L = 32;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = bars.length;
  const barW = Math.max(2, Math.floor(chartW / n) - 2);
  const safe = Math.max(1, maxVal);

  const labelEvery = Math.max(1, Math.ceil(n / 10));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      aria-label="Crime trend chart"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD_T + chartH * (1 - f);
        const val = Math.round(safe * f);
        return (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke={BORDER} strokeWidth={0.5} />
            <text x={PAD_L - 4} y={y + 4} fontSize={10} fill={MUTED} textAnchor="end" fontFamily={MONO}>
              {val}
            </text>
          </g>
        );
      })}

      {/* Confidence band (forecast only) */}
      {(() => {
        const forecastBars = bars.filter((b) => b.isForecast && b.lower !== undefined && b.upper !== undefined);
        if (forecastBars.length < 2) return null;
        const safe2 = Math.max(1, maxVal);
        // Build polygon: upper edge left-to-right, lower edge right-to-left
        const points: string[] = [];
        forecastBars.forEach((b, fi) => {
          const globalIdx = bars.indexOf(b);
          const cx = PAD_L + globalIdx * (chartW / n) + barW / 2;
          const yUpper = PAD_T + chartH - Math.min((b.upper! / safe2) * chartH, chartH);
          points.push(`${cx},${yUpper}`);
        });
        [...forecastBars].reverse().forEach((b) => {
          const globalIdx = bars.indexOf(b);
          const cx = PAD_L + globalIdx * (chartW / n) + barW / 2;
          const yLower = PAD_T + chartH - Math.min((b.lower! / safe2) * chartH, chartH);
          points.push(`${cx},${yLower}`);
        });
        return (
          <polygon
            points={points.join(" ")}
            fill={`${SAFFRON}28`}
            stroke={`${SAFFRON}66`}
            strokeWidth={0.8}
          />
        );
      })()}

      {/* Bars */}
      {bars.map((b, i) => {
        const x = PAD_L + i * (chartW / n) + 1;
        const barH = Math.max(1, (b.count / safe) * chartH);
        const y = PAD_T + chartH - barH;
        const hovered = hoveredIdx === i;
        const fill = b.isForecast
          ? hovered ? SAFFRON : `${SAFFRON}99`
          : hovered ? NAVY : `${NAVY}cc`;
        const stroke = b.isForecast ? SAFFRON : hovered ? "#fff" : NAVY;
        const label = b.date.slice(5); // MM-DD

        // Tooltip: clamp so it never goes off the right edge
        const tipW = 60;
        const tipH = 22;
        const tipX = Math.min(x + barW / 2 - tipW / 2, W - PAD_R - tipW);
        const tipY = Math.max(PAD_T, y - tipH - 6);

        return (
          <g
            key={b.date}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: "crosshair" }}
          >
            {/* Invisible hit area covering full column height for easy hover */}
            <rect
              x={x}
              y={PAD_T}
              width={barW}
              height={chartH}
              fill="transparent"
            />
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={fill}
              stroke={stroke}
              strokeWidth={hovered ? 1.5 : b.isForecast ? 1 : 0}
              rx={1}
            />
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2}
                y={H - 4}
                fontSize={9}
                fill={b.isForecast ? SAFFRON : hovered ? TEXT : GRAY}
                textAnchor="middle"
                fontFamily={MONO}
                fontWeight={hovered || b.isForecast ? 700 : 400}
              >
                {label}
              </text>
            )}

            {/* Floating tooltip */}
            {hovered && (
              <g>
                <rect
                  x={tipX}
                  y={tipY}
                  width={tipW}
                  height={tipH}
                  rx={4}
                  fill={b.isForecast ? "#7c3aed" : NAVY}
                  opacity={0.93}
                />
                <text
                  x={tipX + tipW / 2}
                  y={tipY + 14}
                  fontSize={9}
                  fontWeight={700}
                  fill="#fff"
                  textAnchor="middle"
                  fontFamily={MONO}
                >
                  {b.date.slice(5)}: {b.count}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Divider between historical and forecast */}
      {bars.some((b) => b.isForecast) && bars.some((b) => !b.isForecast) && (() => {
        const splitIdx = bars.findIndex((b) => b.isForecast);
        const divX = PAD_L + splitIdx * (chartW / n);
        return (
          <line
            x1={divX}
            x2={divX}
            y1={PAD_T}
            y2={PAD_T + chartH}
            stroke={SAFFRON}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        );
      })()}
    </svg>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

type BaselineWeeks = 4 | 8 | 12;
const BASELINE_OPTIONS: BaselineWeeks[] = [4, 8, 12];

type SubTab = "risk" | "trend" | "categories" | "hotspots" | "locations" | "dow" | "closure" | "patrol" | "intel";
const SUB_TABS: { id: SubTab; label: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }> }[] = [
  { id: "risk",       label: "Risk",             Icon: ShieldAlert    },
  { id: "trend",      label: "Trend & Forecast", Icon: TrendingUp     },
  { id: "categories", label: "Categories",       Icon: LayoutList     },
  { id: "hotspots",   label: "Hotspots",         Icon: MapPin         },
  { id: "locations",  label: "Repeat Locations", Icon: Repeat         },
  { id: "dow",        label: "Day Pattern",      Icon: CalendarDays   },
  { id: "closure",    label: "Closure Rate",     Icon: CheckCircle2   },
  { id: "patrol",     label: "Patrol Allocation",Icon: Navigation     },
  { id: "intel",      label: "Intelligence",     Icon: Sparkles       },
];

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export const PredictiveAnalytics: React.FC = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<BaselineWeeks>(8);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("risk");
  const abortRef = useRef<AbortController | null>(null);
  const baselineRef = useRef<BaselineWeeks>(baseline);
  const visibleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // keep ref in sync so the interval closure always sees the current baseline
  useEffect(() => { baselineRef.current = baseline; }, [baseline]);

  const load = useCallback(async (bw: BaselineWeeks = 8) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/analytics/predictive?baseline=${bw}`, { signal: ctrl.signal });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json);
      setLastRefreshed(new Date());
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Could not load predictive analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + reload when baseline changes
  useEffect(() => {
    load(baseline);
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline]);

  // Auto-refresh: tick every AUTO_REFRESH_MS while panel is visible and tab is active
  useEffect(() => {
    const startTimer = () => {
      if (timerRef.current) return; // already running
      timerRef.current = setInterval(() => {
        if (visibleRef.current && !document.hidden) {
          load(baselineRef.current);
        }
      }, AUTO_REFRESH_MS);
    };
    const stopTimer = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    // IntersectionObserver: start/stop timer when panel enters/leaves viewport
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) startTimer(); else stopTimer();
    }, { threshold: 0.1 });
    if (containerRef.current) io.observe(containerRef.current);

    // Also pause when the browser tab goes to background
    const onVisChange = () => {
      if (document.hidden) stopTimer();
      else if (visibleRef.current) startTimer();
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      stopTimer();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
    };
  // load is stable (no deps), safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PDF export ──────────────────────────────────────────────────────────

  const exportPDF = () => {
    if (!data) return;
    const pw = window.open("", "_blank");
    if (!pw) { alert("Popup blocker prevented export. Please allow popups for this site."); return; }

    const { riskIndicator, forecast, hotspots, categoryBreakdown, repeatLocations, dayHeatmap, peakDay, closureWeeks } = data;
    const risk = RISK_META[riskIndicator.level];
    const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const refId = `PA-${Date.now().toString(36).toUpperCase()}`;

    const rateRow = (w: { weekLabel: string; registered: number; closed: number; rate: number }) =>
      `<tr><td>${w.weekLabel}</td><td>${w.registered}</td><td>${w.closed}</td><td>${w.rate}%</td></tr>`;

    const hotspotRow = (h: typeof hotspots[0], i: number) =>
      `<tr><td>#${i + 1}</td><td>${h.districtName}</td><td>${h.total}</td><td>${h.heinous || "—"}</td><td>${RISK_META[h.districtRisk.level].label}</td></tr>`;

    const catRow = (c: typeof categoryBreakdown[0]) =>
      `<tr><td>${c.headName}</td><td>${c.last30Total}</td><td>${c.forecastedWeekTotal ?? "—"}</td></tr>`;

    const dowRow = (cell: typeof dayHeatmap[0]) =>
      `<tr${peakDay?.day === cell.day ? ' style="font-weight:700;background:#f0f6ff"' : ""}><td>${cell.day}</td><td>${cell.count}</td><td>${cell.sharePct}%</td></tr>`;

    pw.document.write(`<!DOCTYPE html><html><head>
      <title>O.R.C.A Predictive Analytics Report — ${data.today}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 28px; color: #1e293b; background: #fff; font-size: 11px; line-height: 1.5; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 0; pointer-events: none; text-align: center; }
        .watermark-text { font-size: 3.5rem; font-weight: 900; color: rgba(0,31,63,0.06); letter-spacing: 0.08em; }
        .wrap { position: relative; z-index: 1; }
        .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #001f3f; padding-bottom: 10px; margin-bottom: 14px; }
        .hdr-title { font-size: 16px; font-weight: 800; color: #001f3f; letter-spacing: 0.5px; }
        .badge { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid #fca5a5; padding: 3px 9px; font-size: 9px; font-weight: 700; border-radius: 4px; font-family: monospace; }
        .meta { margin-bottom: 14px; font-size: 10.5px; color: #64748b; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .section-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; margin: 16px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .risk-box { padding: 10px 14px; border-left: 4px solid ${risk.colour}; background: ${risk.bg}; border-radius: 4px; margin-bottom: 6px; }
        .risk-label { font-size: 13px; font-weight: 800; color: ${risk.colour}; }
        .risk-desc { font-size: 10.5px; color: #1e293b; margin-top: 3px; }
        .stats { display: flex; gap: 24px; margin-top: 8px; }
        .stat-val { font-size: 18px; font-weight: 700; font-family: monospace; }
        .stat-lbl { font-size: 9px; color: #94a3b8; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th { background: #001f3f; color: #fff; text-align: left; padding: 6px 9px; font-size: 9.5px; text-transform: uppercase; font-weight: 700; }
        td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 8.5px; color: #94a3b8; text-align: center; }
        @media print { @page { size: A4; margin: 12mm 14mm; } body { padding: 0; } .footer { position: fixed; bottom: 0; left: 0; right: 0; } }
      </style>
    </head><body>
      <div class="watermark">
        <div class="watermark-text">O.R.C.A</div>
        <div style="font-size:1.6rem;font-weight:900;color:rgba(0,31,63,0.06);letter-spacing:0.12em">CONFIDENTIAL</div>
      </div>
      <div class="wrap">
        <div class="hdr">
          <div class="hdr-title">O.R.C.A — PREDICTIVE ANALYTICS REPORT</div>
          <div class="badge">CONFIDENTIAL // COPS INTERNAL USE ONLY</div>
        </div>
        <div class="meta">
          <strong>REPORT REF:</strong> ${refId} &nbsp;|&nbsp;
          <strong>GENERATED:</strong> ${now} IST &nbsp;|&nbsp;
          <strong>BASELINE PERIOD:</strong> ${riskIndicator.baselineWeeks} weeks &nbsp;|&nbsp;
          <strong>DATA DATE:</strong> ${data.today} &nbsp;|&nbsp;
          <strong>ISSUING AUTHORITY:</strong> Organized Crime Analysis Authority (O.R.C.A)
        </div>

        <div class="section-title">1. Risk Indicator</div>
        <div class="risk-box">
          <div class="risk-label">${risk.label.toUpperCase()}</div>
          <div class="risk-desc">${risk.description}</div>
          <div class="stats">
            <div><div class="stat-lbl">Current Week</div><div class="stat-val" style="color:${risk.colour}">${riskIndicator.currentWeekCount}</div><div class="stat-lbl">cases (last 7 days)</div></div>
            <div><div class="stat-lbl">${riskIndicator.baselineWeeks}-Week Avg</div><div class="stat-val" style="color:#475569">${riskIndicator.baselineWeekAvg}</div><div class="stat-lbl">cases/week (historical)</div></div>
          </div>
        </div>
        <div style="font-size:9px;color:#94a3b8;margin-bottom:4px">Thresholds: &lt;10% above baseline = Normal · 10–29% = Elevated · 30–59% = Significant · ≥60% = Critical</div>

        <div class="section-title">2. 7-Day Forecast</div>
        ${forecast.available && forecast.forecastPoints ? `
        <table>
          <thead><tr><th>Date</th><th>Projected Cases</th><th>Lower Bound</th><th>Upper Bound</th></tr></thead>
          <tbody>${forecast.forecastPoints.map(p => `<tr><td>${p.date}</td><td>${p.count}</td><td>${p.lower}</td><td>${p.upper}</td></tr>`).join("")}</tbody>
        </table>
        <div style="font-size:9px;color:#94a3b8">Total projected: ${forecast.forecastTotal} cases · OLS linear projection · ±1 SE confidence bounds</div>
        ` : `<p style="color:#94a3b8;font-size:10px">Insufficient historical data for forecast (${forecast.daysWithData} of 30 days have registrations; minimum 7 required).</p>`}

        <div class="section-title">3. Crime Category Breakdown (Last 30 Days)</div>
        <table>
          <thead><tr><th>Category</th><th>Last 30 Days</th><th>7-Day Forecast</th></tr></thead>
          <tbody>${categoryBreakdown.map(catRow).join("")}</tbody>
        </table>

        <div class="section-title">4. Geographic Hotspots</div>
        <table>
          <thead><tr><th>Rank</th><th>District</th><th>Total Cases</th><th>Heinous</th><th>District Risk</th></tr></thead>
          <tbody>${hotspots.map(hotspotRow).join("")}</tbody>
        </table>

        <div class="section-title">5. Repeat Location Detection</div>
        ${repeatLocations.length ? `
        <table>
          <thead><tr><th>Station</th><th>District</th><th>Concentration</th><th>All-Time</th><th>Last 30d</th><th>Flag</th></tr></thead>
          <tbody>${repeatLocations.map(r => `<tr><td>${r.stationName}</td><td>${r.districtName}</td><td>${r.concentrationRatio}×</td><td>${r.allTimeTotal}</td><td>${r.last30Total}</td><td>${r.flag}</td></tr>`).join("")}</tbody>
        </table>` : `<p style="color:#94a3b8;font-size:10px">No disproportionate station concentrations detected.</p>`}

        <div class="section-title">6. Day-of-Week Pattern (Last 90 Days)</div>
        <table>
          <thead><tr><th>Day</th><th>Cases</th><th>Share</th></tr></thead>
          <tbody>${dayHeatmap.map(dowRow).join("")}</tbody>
        </table>
        ${peakDay ? `<div style="font-size:9px;color:#94a3b8">Peak day: ${peakDay.day} — ${peakDay.count} cases (${peakDay.sharePct}%)</div>` : ""}

        <div class="section-title">7. Case Closure Rate (Last 12 Weeks)</div>
        <table>
          <thead><tr><th>Week Starting</th><th>Registered</th><th>Closed</th><th>Closure Rate</th></tr></thead>
          <tbody>${[...closureWeeks].reverse().map(rateRow).join("")}</tbody>
        </table>
        <div style="font-size:9px;color:#94a3b8">Closure rate = cases at status "Closed" ÷ total registrations in that registration week.</div>

        <div class="footer">
          CONFIDENTIAL STATE GOVERNMENT PROPERTY — DISCLOSURE OR DISTRIBUTION PROHIBITED<br/>
          O.R.C.A Intelligence Console · ${refId} · Generated ${now} IST
        </div>
      </div>
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
    </body></html>`);
    pw.document.close();
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderHeader = () => (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      borderBottom: `1px solid ${BORDER}`,
      background: "rgba(0,0,0,0.02)",
      flexWrap: "wrap",
      gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Predictive Analytics
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
          Deterministic — all figures computed from registered FIR data
          {lastRefreshed && (
            <span style={{ marginLeft: 8, color: GREEN, fontWeight: 600 }}>
              · refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              {" "}· auto-refresh every 5 min
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Baseline period selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Baseline:</span>
          <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 4, overflow: "hidden" }}>
            {BASELINE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setBaseline(opt)}
                disabled={loading}
                style={{
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: MONO,
                  background: baseline === opt ? NAVY : "transparent",
                  color: baseline === opt ? "#fff" : GRAY,
                  border: "none",
                  borderRight: opt !== 12 ? `1px solid ${BORDER}` : "none",
                  cursor: loading ? "default" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {opt}W
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={exportPDF}
          disabled={loading || !data}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: data ? NAVY : "transparent",
            border: `1px solid ${data ? NAVY : BORDER}`,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            color: data ? "#fff" : MUTED,
            cursor: loading || !data ? "default" : "pointer",
          }}
        >
          <FileDown style={{ width: 13, height: 13 }} />
          Export PDF
        </button>
        <button
          onClick={() => load(baseline)}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
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
    </div>
  );

  if (loading && !data) {
    return (
      <div ref={containerRef}>
        {renderHeader()}
        <OrcaLoader padding="40px 16px" />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef}>
        {renderHeader()}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "28px 16px", color: RED, fontSize: 13 }}>
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data || !data.configured) {
    return (
      <div ref={containerRef}>
        {renderHeader()}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "36px 20px", color: GRAY, fontSize: 13 }}>
          <Inbox style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: MUTED }} />
          <span>The case database is not configured on this server.</span>
        </div>
      </div>
    );
  }

  const { riskIndicator, forecast, hotspots, repeatLocations, categoryBreakdown, dayHeatmap, peakDay, closureWeeks, patrolRecommendations, summary } = data;
  const risk = RISK_META[riskIndicator.level];

  // Build bar series: historical + forecast
  const allBars: Bar[] = [
    ...(forecast.historicalTrend || []).map((p) => ({ ...p, isForecast: false })),
    ...(forecast.forecastPoints || []).map((p) => ({ ...p, isForecast: true, lower: p.lower, upper: p.upper })),
  ];
  const maxVal = Math.max(1, ...allBars.map((b) => b.count));

  // ── Sub-tab bar ─────────────────────────────────────────────────────────
  const renderSubTabs = () => (
    <div style={{
      display: "flex",
      gap: 6,
      padding: "10px 16px",
      borderBottom: `1px solid ${BORDER}`,
      background: "#f8fafc",
      overflowX: "auto",
      flexShrink: 0,
    }}>
      {SUB_TABS.map(({ id, label, Icon }) => {
        const active = subTab === id;
        return (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              fontSize: 11.5,
              fontWeight: 600,
              color: active ? "#fff" : GRAY,
              background: active ? NAVY : "#fff",
              border: `1px solid ${active ? NAVY : BORDER}`,
              borderRadius: 20,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
              boxShadow: active ? `0 1px 4px ${NAVY}33` : "none",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER;
              }
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={containerRef}>
      {renderHeader()}
      {renderSubTabs()}

      <div style={{ padding: "16px 16px 24px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── 1. Risk Indicator ────────────────────────────────────────── */}
        {subTab === "risk" && <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Risk Indicator
          </div>
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "16px",
            border: `1px solid ${risk.colour}44`,
            borderLeft: `4px solid ${risk.colour}`,
            borderRadius: 6,
            background: risk.bg,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: risk.colour, letterSpacing: 0.3 }}>
                {risk.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 12.5, color: TEXT, marginTop: 5, lineHeight: 1.5 }}>
                {risk.description}
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Current Week
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: TEXT }}>
                    {riskIndicator.currentWeekCount}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>cases (last 7 days)</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {riskIndicator.baselineWeeks}-Week Avg
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, color: GRAY }}>
                    {riskIndicator.baselineWeekAvg.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>cases/week (historical)</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 6, paddingLeft: 2 }}>
            Thresholds: &lt;10% above baseline = Normal · 10–29% = Elevated · 30–59% = Significant · ≥60% = Critical
          </div>
        </section>}

        {/* ── 2. Crime Trend + Forecast ────────────────────────────────── */}
        {subTab === "trend" && <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Crime Trend
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 14, marginLeft: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: GRAY }}>
                <div style={{ width: 12, height: 12, background: `${NAVY}cc`, borderRadius: 2 }} />
                Historical
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: GRAY }}>
                <div style={{ width: 12, height: 12, background: `${SAFFRON}99`, border: `1px solid ${SAFFRON}`, borderRadius: 2 }} />
                7-day Forecast
              </div>
            </div>
          </div>

          <div style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            padding: "12px",
            background: "#fafafa",
          }}>
            {allBars.length > 0 ? (
              <TrendChart bars={allBars} maxVal={maxVal} />
            ) : (
              <div style={{ padding: "24px 0", color: MUTED, fontSize: 12, textAlign: "center" }}>
                No case registration dates available.
              </div>
            )}
          </div>

          {!forecast.available && (
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 8,
              padding: "10px 12px",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              background: "#fffbeb",
              fontSize: 12,
              color: GRAY,
            }}>
              <AlertTriangle style={{ width: 14, height: 14, color: ORANGE, flexShrink: 0, marginTop: 1 }} />
              <span>
                Insufficient historical data for reliable prediction.{" "}
                {forecast.daysWithData} of 30 days have registrations (minimum 7 required).
              </span>
            </div>
          )}

          {forecast.available && forecast.forecastTotal !== null && (
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6, paddingLeft: 2 }}>
              Projected next 7 days: <strong style={{ color: TEXT }}>{forecast.forecastTotal}</strong> cases ·{" "}
              {forecast.methodology} · <span style={{ color: `${SAFFRON}cc` }}>shaded band = ±1 SE confidence interval</span>
            </div>
          )}
        </section>}

        {/* ── 3. Crime Category Breakdown ─────────────────────────────── */}
        {subTab === "categories" && <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Crime Category Breakdown <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}>(last 30 days + 7-day forecast)</span>
          </div>

          {!categoryBreakdown?.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No crime head data available.
            </div>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.025)" }}>
                    {["Crime Category", "Last 30 Days", "7-Day Forecast", "Trend"].map((h) => (
                      <th key={h} style={{
                        padding: "9px 14px",
                        textAlign: "left",
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: GRAY,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        borderBottom: `1px solid ${BORDER}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((cat) => {
                    const maxCat = Math.max(1, ...categoryBreakdown.map((c) => c.last30Total));
                    const barPct = Math.round((cat.last30Total / maxCat) * 100);
                    const forecastRatio = cat.forecastedWeekTotal !== null && cat.last30Total > 0
                      ? (cat.forecastedWeekTotal / (cat.last30Total / 4.3))
                      : null;
                    const trendColour = forecastRatio === null ? MUTED
                      : forecastRatio > 1.2 ? RED
                      : forecastRatio > 0.9 ? ORANGE
                      : GREEN;
                    const trendLabel = forecastRatio === null ? "—"
                      : forecastRatio > 1.2 ? "↑ Rising"
                      : forecastRatio > 0.9 ? "→ Stable"
                      : "↓ Falling";
                    return (
                      <tr
                        key={cat.headId}
                        style={{ borderBottom: `1px solid ${BORDER}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "11px 14px", fontWeight: 600, color: NAVY, maxWidth: 220 }}>
                          <div>{cat.headName}</div>
                          <div style={{
                            marginTop: 4,
                            height: 4,
                            borderRadius: 2,
                            background: `${NAVY}22`,
                            overflow: "hidden",
                          }}>
                            <div style={{ width: `${barPct}%`, height: "100%", background: NAVY, borderRadius: 2 }} />
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>{cat.last30Total}</td>
                        <td style={{ padding: "11px 14px", fontFamily: MONO, color: cat.forecastedWeekTotal !== null ? TEXT : MUTED }}>
                          {cat.forecastedWeekTotal !== null ? cat.forecastedWeekTotal : <span style={{ fontSize: 11 }}>Insufficient data</span>}
                        </td>
                        <td style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, color: trendColour }}>
                          {trendLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 6, paddingLeft: 2 }}>
            Forecast requires at least 3 days with registrations in the last 30 days. Trend compares projected week against recent weekly average.
          </div>
        </section>}

        {/* ── 5. Geographic Hotspots ───────────────────────────────────── */}
        {subTab === "hotspots" && <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Geographic Hotspots
          </div>

          {hotspots.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No cases registered yet.
            </div>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.025)" }}>
                    {["Rank", "District", "District Risk", "This Week", "Total", "Heinous", "Coordinates"].map((h) => (
                      <th key={h} style={{
                        padding: "9px 14px",
                        textAlign: "left",
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: GRAY,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        borderBottom: `1px solid ${BORDER}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((h, i) => (
                    <tr
                      key={h.districtId}
                      style={{ borderBottom: `1px solid ${BORDER}` }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: MONO, color: i < 3 ? RED : GRAY, fontWeight: 700 }}>
                        #{i + 1}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: NAVY }}>
                        {h.districtName}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {(() => {
                          const r = RISK_META[h.districtRisk.level];
                          return (
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: r.bg,
                              color: r.colour,
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: 0.2,
                            }}>
                              {r.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>
                        {h.districtRisk.currentWeekCount}
                      </td>
                      <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>
                        {h.total}
                      </td>
                      <td style={{ padding: "11px 14px", fontFamily: MONO, color: h.heinous ? RED : MUTED }}>
                        {h.heinous || "—"}
                      </td>
                      <td style={{ padding: "11px 14px", fontFamily: MONO, color: MUTED, fontSize: 11 }}>
                        {h.latitude !== null && h.longitude !== null
                          ? `${h.latitude.toFixed(4)}°N, ${h.longitude.toFixed(4)}°E`
                          : <span style={{ color: MUTED }}>No coordinate</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 6, paddingLeft: 2 }}>
            Ranked by total registered cases. Coordinates are district headquarters from the reference table.
          </div>
        </section>}

        {/* ── 6. Repeat Location Detection ────────────────────────────── */}
        {subTab === "locations" && <section>
          <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
            Repeat Location Detection <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}>(stations with disproportionate case load)</span>
          </div>

          {!repeatLocations?.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No disproportionate station concentrations detected.
            </div>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.025)" }}>
                    {["Station", "District", "Concentration", "All-Time", "Last 30 Days", "Flag"].map((h) => (
                      <th key={h} style={{
                        padding: "9px 14px",
                        textAlign: "left",
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: GRAY,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        borderBottom: `1px solid ${BORDER}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repeatLocations.map((loc) => {
                    const flagColour = loc.flag === "HIGH" ? RED : loc.flag === "MEDIUM" ? ORANGE : "#ca8a04";
                    const flagBg = loc.flag === "HIGH" ? "#fee2e2" : loc.flag === "MEDIUM" ? "#ffedd5" : "#fefce8";
                    return (
                      <tr
                        key={loc.stationId}
                        style={{ borderBottom: `1px solid ${BORDER}` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "11px 14px", fontWeight: 600, color: NAVY }}>{loc.stationName}</td>
                        <td style={{ padding: "11px 14px", color: GRAY }}>{loc.districtName}</td>
                        <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>
                          {loc.concentrationRatio}×
                          <div style={{ marginTop: 3, height: 3, borderRadius: 2, background: "#e2e8f0", overflow: "hidden", width: 60 }}>
                            <div style={{
                              width: `${Math.min(100, (loc.concentrationRatio / 4) * 100)}%`,
                              height: "100%",
                              background: flagColour,
                              borderRadius: 2,
                            }} />
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>{loc.allTimeTotal}</td>
                        <td style={{ padding: "11px 14px", fontFamily: MONO, color: TEXT }}>{loc.last30Total}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: flagBg,
                            color: flagColour,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}>
                            {loc.flag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 6, paddingLeft: 2 }}>
            Concentration ratio = station's share of district cases ÷ expected equal share. HIGH ≥ 3×, MEDIUM ≥ 2×, LOW ≥ 1.5×.
          </div>
        </section>}

        {/* ── 7. Day-of-Week Heatmap ───────────────────────────────────── */}
        {subTab === "dow" && <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Day-of-Week Pattern
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>last 90 days</div>
          </div>

          {!dayHeatmap?.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No day-of-week data available.
            </div>
          ) : (() => {
            const maxCount = Math.max(1, ...dayHeatmap.map((d) => d.count));
            const avgCount = dayHeatmap.reduce((a, d) => a + d.count, 0) / 7;
            const FULL_DAY: Record<string, string> = {
              Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
              Thu: "Thursday", Fri: "Friday", Sat: "Saturday",
            };
            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayHeatmap.map((cell) => {
                    const isPeak = peakDay?.day === cell.day;
                    const isWeekend = cell.day === "Sun" || cell.day === "Sat";
                    const barPct = Math.round((cell.count / maxCount) * 100);
                    const vsAvg = avgCount > 0 ? ((cell.count - avgCount) / avgCount) * 100 : 0;
                    const vsAvgLabel = vsAvg >= 1 ? `+${Math.round(vsAvg)}% vs avg` : vsAvg <= -1 ? `${Math.round(vsAvg)}% vs avg` : "≈ avg";
                    const vsAvgColour = vsAvg >= 10 ? RED : vsAvg >= 1 ? ORANGE : vsAvg <= -10 ? GREEN : MUTED;

                    return (
                      <div
                        key={cell.day}
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${isPeak ? "#f59e0b" : isWeekend ? "#e2e8f0" : BORDER}`,
                          background: isPeak
                            ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                            : isWeekend ? "#f8fafc" : "#fff",
                          overflow: "hidden",
                          boxShadow: isPeak ? "0 2px 12px rgba(245,158,11,0.18)" : "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        {/* Top accent bar — full width, height scales with intensity */}
                        <div style={{
                          height: 4,
                          background: isPeak
                            ? "linear-gradient(90deg, #f59e0b, #FBBF24)"
                            : `linear-gradient(90deg, rgba(0,31,63,${0.12 + cell.intensity * 0.88}), rgba(0,31,63,0.08))`,
                          width: `${barPct}%`,
                          transition: "width 0.5s ease",
                          borderRadius: "0 2px 2px 0",
                        }} />

                        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px" }}>

                          {/* Day label block */}
                          <div style={{ flexShrink: 0, width: 96 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: isPeak ? "#92400e" : isWeekend ? GRAY : NAVY,
                                letterSpacing: 0.2,
                              }}>
                                {FULL_DAY[cell.day]}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              {isWeekend && (
                                <span style={{
                                  fontSize: 8.5, fontWeight: 700, color: GRAY,
                                  background: "#e2e8f0", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.3,
                                }}>WEEKEND</span>
                              )}
                              {isPeak && (
                                <span style={{
                                  fontSize: 8.5, fontWeight: 700, color: "#92400e",
                                  background: "#fde68a", borderRadius: 3, padding: "1px 5px", letterSpacing: 0.3,
                                }}>PEAK DAY</span>
                              )}
                            </div>
                          </div>

                          {/* Big count */}
                          <div style={{ flexShrink: 0, textAlign: "center", width: 56 }}>
                            <div style={{
                              fontSize: 28,
                              fontWeight: 900,
                              fontFamily: MONO,
                              color: isPeak ? "#92400e" : TEXT,
                              lineHeight: 1,
                            }}>
                              {cell.count}
                            </div>
                            <div style={{ fontSize: 9, color: MUTED, marginTop: 2, letterSpacing: 0.3 }}>CASES</div>
                          </div>

                          {/* Progress track */}
                          <div style={{ flex: 1 }}>
                            <div style={{
                              height: 10,
                              borderRadius: 5,
                              background: isPeak ? "#fde68a88" : "#e2e8f0",
                              overflow: "hidden",
                              position: "relative",
                            }}>
                              <div style={{
                                width: `${barPct}%`,
                                height: "100%",
                                borderRadius: 5,
                                background: isPeak
                                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                                  : `linear-gradient(90deg, ${NAVY}, ${NAVY}88)`,
                                transition: "width 0.5s ease",
                              }} />
                            </div>
                            {/* vs average label */}
                            <div style={{ marginTop: 5, fontSize: 10, color: vsAvgColour, fontWeight: 600 }}>
                              {vsAvgLabel}
                            </div>
                          </div>

                          {/* Share % pill */}
                          <div style={{
                            flexShrink: 0,
                            padding: "6px 12px",
                            borderRadius: 20,
                            background: isPeak ? "#fde68a" : "#f1f5f9",
                            border: `1px solid ${isPeak ? "#f59e0b" : BORDER}`,
                          }}>
                            <div style={{
                              fontSize: 14,
                              fontWeight: 800,
                              fontFamily: MONO,
                              color: isPeak ? "#92400e" : NAVY,
                              textAlign: "center",
                              lineHeight: 1,
                            }}>
                              {cell.sharePct}%
                            </div>
                            <div style={{ fontSize: 8.5, color: isPeak ? "#b45309" : MUTED, textAlign: "center", marginTop: 2, letterSpacing: 0.3 }}>
                              OF TOTAL
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10, paddingLeft: 2 }}>
                  vs avg compares each day against the 7-day mean · top bar width = relative volume · share = % of 90-day registrations
                </div>
              </>
            );
          })()}
        </section>}

        {/* ── 8. Case Closure Rate Trend ───────────────────────────────── */}
        {subTab === "closure" && <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Case Closure Rate Trend
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>last 12 weeks · by registration date</div>
          </div>

          {!closureWeeks?.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No closure data available.
            </div>
          ) : (() => {
            const weeks = [...closureWeeks].reverse(); // latest first
            const maxReg = Math.max(1, ...closureWeeks.map((w) => w.registered));
            const avgRate = Math.round(closureWeeks.reduce((a, w) => a + w.rate, 0) / closureWeeks.length * 10) / 10;
            const latestRate = weeks[0]?.rate ?? 0;
            const prevRate = weeks[1]?.rate ?? null;
            const trend = prevRate !== null ? latestRate - prevRate : null;
            const latestRc = latestRate >= 60 ? GREEN : latestRate >= 30 ? ORANGE : RED;
            const bestWeek = [...weeks].sort((a, b) => b.rate - a.rate)[0];

            return (
              <>
                {/* ── 3 summary stat cards ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    {
                      label: "Latest Week",
                      value: `${latestRate}%`,
                      sub: trend !== null
                        ? `${trend >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(trend * 10) / 10)}pp vs prev week`
                        : weeks[0]?.weekLabel ?? "",
                      valueColour: latestRc,
                      subColour: trend !== null ? (trend >= 0 ? GREEN : RED) : MUTED,
                      border: latestRc,
                    },
                    {
                      label: "12-Week Average",
                      value: `${avgRate}%`,
                      sub: avgRate >= 60 ? "On target" : avgRate >= 30 ? "Below target" : "Needs attention",
                      valueColour: NAVY,
                      subColour: avgRate >= 60 ? GREEN : avgRate >= 30 ? ORANGE : RED,
                      border: BORDER,
                    },
                    {
                      label: "Best Week",
                      value: `${bestWeek?.rate ?? 0}%`,
                      sub: bestWeek?.weekLabel ?? "",
                      valueColour: GREEN,
                      subColour: MUTED,
                      border: BORDER,
                    },
                  ].map((card) => (
                    <div key={card.label} style={{
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: `1px solid ${card.border}44`,
                      borderLeft: `3px solid ${card.border}`,
                      background: "#fff",
                    }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: card.valueColour, lineHeight: 1 }}>
                        {card.value}
                      </div>
                      <div style={{ fontSize: 10, color: card.subColour, marginTop: 5, fontWeight: 600 }}>
                        {card.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Week rows ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {weeks.map((w, i) => {
                    const rc = w.rate >= 60 ? GREEN : w.rate >= 30 ? ORANGE : RED;
                    const rcBg = w.rate >= 60 ? "#d1fae5" : w.rate >= 30 ? "#ffedd5" : "#fee2e2";
                    const isLatest = i === 0;
                    const regPct = Math.round((w.registered / maxReg) * 100);
                    const closedOfReg = w.registered > 0 ? Math.round((w.closed / w.registered) * 100) : 0;

                    return (
                      <div
                        key={w.weekLabel}
                        style={{
                          padding: "11px 14px",
                          borderRadius: 8,
                          border: `1px solid ${isLatest ? NAVY + "44" : BORDER}`,
                          background: isLatest ? "rgba(0,31,63,0.03)" : "#fff",
                          display: "grid",
                          gridTemplateColumns: "90px 1fr 1fr 80px",
                          alignItems: "center",
                          gap: 14,
                        }}
                      >
                        {/* Week label */}
                        <div>
                          <div style={{ fontSize: 11, fontFamily: MONO, color: isLatest ? NAVY : GRAY, fontWeight: isLatest ? 700 : 400 }}>
                            {w.weekLabel}
                          </div>
                          {isLatest && (
                            <div style={{
                              display: "inline-block",
                              marginTop: 3,
                              fontSize: 8.5,
                              fontWeight: 700,
                              color: "#fff",
                              background: NAVY,
                              borderRadius: 3,
                              padding: "1px 5px",
                              letterSpacing: 0.4,
                            }}>
                              LATEST
                            </div>
                          )}
                        </div>

                        {/* Registered bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 600 }}>REGISTERED</span>
                            <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT, fontWeight: 700 }}>{w.registered}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${regPct}%`, height: "100%", background: `${NAVY}99`, borderRadius: 3 }} />
                          </div>
                        </div>

                        {/* Closed bar */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 600 }}>CLOSED</span>
                            <span style={{ fontSize: 10, fontFamily: MONO, color: TEXT, fontWeight: 700 }}>{w.closed}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ width: `${closedOfReg}%`, height: "100%", background: `${GREEN}cc`, borderRadius: 3 }} />
                          </div>
                        </div>

                        {/* Rate badge */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: rcBg,
                          border: `1px solid ${rc}44`,
                        }}>
                          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: MONO, color: rc }}>
                            {w.rate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10, paddingLeft: 2 }}>
                  Closure rate = cases at "Closed" status ÷ total registrations that week · Green ≥ 60% · Orange ≥ 30% · Red &lt; 30%
                </div>
              </>
            );
          })()}
        </section>}

        {/* ── 9. Patrol Allocation ─────────────────────────────────────── */}
        {subTab === "patrol" && <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Beat & Patrol Allocation
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>derived from risk, volume, heinous cases & station concentration</div>
          </div>

          {!patrolRecommendations?.length ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: MUTED, fontSize: 12 }}>
              <Inbox style={{ width: 15, height: 15 }} />
              No case data to base recommendations on.
            </div>
          ) : (
            <>
              {/* Legend */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                {([
                  { label: "HIGH priority", colour: RED,    bg: "#fee2e2" },
                  { label: "MEDIUM priority", colour: ORANGE, bg: "#ffedd5" },
                  { label: "LOW priority",   colour: GRAY,  bg: "#f1f5f9" },
                ] as const).map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: l.colour, fontWeight: 600 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: `1px solid ${l.colour}44` }} />
                    {l.label}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {patrolRecommendations.map((rec, idx) => {
                  const priorityColour = rec.priority === "HIGH" ? RED : rec.priority === "MEDIUM" ? ORANGE : GRAY;
                  const priorityBg    = rec.priority === "HIGH" ? "#fee2e2" : rec.priority === "MEDIUM" ? "#ffedd5" : "#f1f5f9";
                  const riskMeta = RISK_META[rec.riskLevel];

                  return (
                    <div key={rec.districtId} style={{
                      borderRadius: 10,
                      border: `1px solid ${priorityColour}33`,
                      borderLeft: `4px solid ${priorityColour}`,
                      background: "#fff",
                      overflow: "hidden",
                      boxShadow: rec.priority === "HIGH" ? `0 2px 10px ${RED}0f` : "0 1px 3px rgba(0,0,0,0.04)",
                    }}>
                      {/* Header row */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderBottom: `1px solid ${BORDER}`,
                        background: rec.priority === "HIGH" ? "#fff9f9" : "#fff",
                      }}>
                        {/* Rank */}
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: priorityBg, border: `1px solid ${priorityColour}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800, color: priorityColour, flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>

                        {/* District + priority */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{rec.districtName}</div>
                          <div style={{ fontSize: 10.5, color: GRAY, marginTop: 1 }}>{rec.rationale}</div>
                        </div>

                        {/* Priority badge */}
                        <div style={{
                          padding: "4px 10px", borderRadius: 20,
                          background: priorityBg, border: `1px solid ${priorityColour}44`,
                          fontSize: 10, fontWeight: 800, color: priorityColour, letterSpacing: 0.5,
                          flexShrink: 0,
                        }}>
                          {rec.priority}
                        </div>

                        {/* Risk badge */}
                        <div style={{
                          padding: "4px 10px", borderRadius: 20,
                          background: riskMeta.bg,
                          fontSize: 10, fontWeight: 700, color: riskMeta.colour,
                          flexShrink: 0,
                        }}>
                          {riskMeta.label}
                        </div>
                      </div>

                      {/* Body */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                        {/* Stat: cases */}
                        <div style={{ padding: "10px 16px", borderRight: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>
                            This Week / Total
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: TEXT }}>
                            {rec.currentWeekCount}
                            <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}> / {rec.totalCases}</span>
                          </div>
                          {rec.heinousCases > 0 && (
                            <div style={{ fontSize: 10, color: RED, fontWeight: 600, marginTop: 2 }}>
                              ⚠ {rec.heinousCases} heinous
                            </div>
                          )}
                        </div>

                        {/* Recommended patrol days */}
                        <div style={{ padding: "10px 16px", borderRight: `1px solid ${BORDER}` }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                            Recommended Patrol Days
                          </div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {rec.recommendedDays.map((d) => (
                              <span key={d} style={{
                                padding: "3px 8px", borderRadius: 4,
                                background: NAVY, color: "#fff",
                                fontSize: 10.5, fontWeight: 700, fontFamily: MONO,
                              }}>{d}</span>
                            ))}
                          </div>
                        </div>

                        {/* Flagged stations */}
                        <div style={{ padding: "10px 16px" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                            Focus Stations
                          </div>
                          {rec.flaggedStations.length ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {rec.flaggedStations.slice(0, 3).map((s) => {
                                const sc = s.flag === "HIGH" ? RED : s.flag === "MEDIUM" ? ORANGE : "#ca8a04";
                                return (
                                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span style={{
                                      fontSize: 8.5, fontWeight: 700, padding: "1px 4px",
                                      borderRadius: 3, background: sc + "22", color: sc,
                                    }}>{s.flag}</span>
                                    <span style={{ fontSize: 10.5, color: TEXT, fontWeight: 500 }}>{s.name}</span>
                                    <span style={{ fontSize: 9.5, color: MUTED }}>{s.ratio}×</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: 10.5, color: MUTED }}>No concentration flags</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10, paddingLeft: 2 }}>
                Priority score = risk level + heinous case weight + current week volume · Patrol days from 90-day day-of-week analysis · Stations flagged by concentration ratio ≥ 1.5×
              </div>
            </>
          )}
        </section>}

        {/* ── 10. Key Intelligence Findings ────────────────────────────── */}
        {subTab === "intel" && <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Brain style={{ width: 14, height: 14, color: NAVY }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Key Intelligence Findings
            </div>
          </div>

          <div style={{
            padding: "14px 16px",
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            background: "#f8fafc",
            fontSize: 13,
            color: TEXT,
            lineHeight: 1.7,
          }}>
            {summary ? (
              <>
                <div>{summary}</div>
                <div style={{ marginTop: 10, fontSize: 10.5, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
                  AI-generated interpretation of the above deterministic analytics. All statistics are from registered case data.
                </div>
              </>
            ) : (
              <div style={{ color: MUTED, fontSize: 12 }}>
                {loading
                  ? "Computing summary…"
                  : "AI summary unavailable — no LLM provider is configured or reachable. Deterministic analytics above are unaffected."}
              </div>
            )}
          </div>
        </section>}

      </div>
    </div>
  );
};
