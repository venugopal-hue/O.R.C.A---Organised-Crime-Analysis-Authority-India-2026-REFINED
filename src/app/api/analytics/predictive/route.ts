import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { dayOf, istDate } from "@/lib/firAnalytics";
import { GRAVITY_HEINOUS } from "@/lib/threatIndex";
import { aiRuntimeSettings } from "@/lib/systemSettings";

/**
 * GET /api/analytics/predictive
 *
 * Returns three deterministic outputs computed from real CaseMaster rows:
 *
 *   forecast      — 7-day linear projection from the last 30 days of daily counts.
 *                   Empty when fewer than 7 days carry any data.
 *
 *   riskIndicator — NORMAL / ELEVATED_HISTORICAL_RISK / SIGNIFICANT_INCREASE /
 *                   CRITICAL_PATTERN_DETECTED, derived from current-week vs
 *                   8-week-average-week counts. Thresholds documented below.
 *
 *   hotspots      — districts ranked by case density (total cases) with their
 *                   coordinates. Coordinates come from the District reference row;
 *                   a district with no coordinate is excluded from the hotspot
 *                   list rather than plotted at a made-up location.
 *
 *   earlyWarning  — current-week and baseline-week counts that back the risk
 *                   indicator so the UI can show the numbers, not just the label.
 *
 * The LLM summary is computed here after the deterministic section and is
 * OPTIONAL — its absence does not fail the response.
 *
 * ── Forecast methodology ─────────────────────────────────────────────────────
 *
 *   1. Build a day-by-day count series for the last 30 calendar days.
 *   2. Fit a simple ordinary-least-squares line through those 30 points.
 *   3. Project the line forward 7 days.
 *   4. Clamp projected values to ≥ 0 (crime counts cannot be negative).
 *   5. Round to the nearest integer.
 *
 *   Insufficient data: fewer than 7 of the 30 days have any registered case.
 *   In that state `forecast` is null and the UI shows the stated message.
 *
 * ── Risk thresholds ──────────────────────────────────────────────────────────
 *
 *   baseline = average cases per week over the previous 8 weeks (weeks 2-9
 *              behind the current week, so the current week is never in its
 *              own baseline).
 *   ratio    = currentWeekCount / baseline   (undefined when baseline === 0)
 *
 *   baseline === 0, currentWeek === 0  → NORMAL
 *   baseline === 0, currentWeek  > 0   → ELEVATED_HISTORICAL_RISK  (new activity)
 *   ratio  < 1.10                      → NORMAL
 *   ratio  < 1.30                      → ELEVATED_HISTORICAL_RISK
 *   ratio  < 1.60                      → SIGNIFICANT_INCREASE
 *   ratio >= 1.60                      → CRITICAL_PATTERN_DETECTED
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const s = (v: unknown) => String(v ?? "").trim();

const KA_LAT = [11.0, 19.0] as const;
const KA_LNG = [73.5, 79.0] as const;

function coordPair(rawLat: unknown, rawLng: unknown): { lat: number; lng: number } | null {
  const lat = Number(String(rawLat ?? "").trim());
  const lng = Number(String(rawLng ?? "").trim());
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= KA_LAT[0] && lat <= KA_LAT[1] &&
    lng >= KA_LNG[0] && lng <= KA_LNG[1];
  return ok ? { lat, lng } : null;
}

/** Subtract `days` calendar days from a YYYY-MM-DD string. */
function subtractDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Add `days` calendar days to a YYYY-MM-DD string. */
function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** OLS linear regression. Returns { m, b } for y = m*x + b. */
function linearRegression(points: number[]): { m: number; b: number } {
  const n = points.length;
  if (n === 0) return { m: 0, b: 0 };
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
  const sumY = points.reduce((a, v) => a + v, 0);
  const sumXY = points.reduce((a, v, i) => a + i * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

export type RiskLevel =
  | "NORMAL"
  | "ELEVATED_HISTORICAL_RISK"
  | "SIGNIFICANT_INCREASE"
  | "CRITICAL_PATTERN_DETECTED";

function classifyRisk(currentWeek: number, baseline: number): RiskLevel {
  if (baseline === 0) {
    return currentWeek === 0 ? "NORMAL" : "ELEVATED_HISTORICAL_RISK";
  }
  const ratio = currentWeek / baseline;
  if (ratio < 1.1) return "NORMAL";
  if (ratio < 1.3) return "ELEVATED_HISTORICAL_RISK";
  if (ratio < 1.6) return "SIGNIFICANT_INCREASE";
  return "CRITICAL_PATTERN_DETECTED";
}

async function buildSummary(
  analytics: {
    riskLevel: RiskLevel;
    currentWeek: number;
    baselineWeek: number;
    forecastTotal: number | null;
    topHotspots: { districtName: string; total: number }[];
    topCategories: { headName: string; last30Total: number; forecastedWeekTotal: number | null }[];
    repeatLocations: { stationName: string; districtName: string; concentrationRatio: number; flag: string | null }[];
    peakDay: { day: string; count: number; sharePct: number } | null;
    today: string;
  }
): Promise<string | null> {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!nvidiaKey && !groqKey) return null;

  const ai = await aiRuntimeSettings();

  const prompt = [
    `Date: ${analytics.today}`,
    `Risk level: ${analytics.riskLevel}`,
    `Current week registrations: ${analytics.currentWeek}`,
    `8-week average weekly registrations: ${analytics.baselineWeek.toFixed(1)}`,
    analytics.forecastTotal !== null
      ? `7-day forecast (next week projected): ${analytics.forecastTotal} cases`
      : "7-day forecast: insufficient historical data",
    analytics.topHotspots.length
      ? `Top districts by case volume: ${analytics.topHotspots.map((h) => `${h.districtName} (${h.total})`).join(", ")}`
      : "No district hotspot data available.",
    analytics.topCategories.length
      ? `Top crime categories (last 30 days): ${analytics.topCategories.map((c) => `${c.headName} (${c.last30Total}${c.forecastedWeekTotal !== null ? `, forecast next 7d: ${c.forecastedWeekTotal}` : ""})`).join(", ")}`
      : "No crime category data available.",
    analytics.repeatLocations.length
      ? `High-concentration stations: ${analytics.repeatLocations.slice(0, 3).map((r) => `${r.stationName} in ${r.districtName} (${r.concentrationRatio}x expected load, flag: ${r.flag})`).join("; ")}`
      : "No repeat location concentrations detected.",
    analytics.peakDay
      ? `Peak registration day (last 90 days): ${analytics.peakDay.day} (${analytics.peakDay.count} cases, ${analytics.peakDay.sharePct}% of total)`
      : "",
  ].filter(Boolean).join("\n");

  const systemInstruction =
    "You are an intelligence analyst for the O.R.C.A law enforcement console. " +
    "Provide a concise operational summary (3-5 sentences) based ONLY on the supplied analytics data. " +
    "Do not invent statistics, cases, locations, officer names, or crime categories not present in the data. " +
    "If data is insufficient to support a conclusion, state that explicitly. " +
    "Write for a senior police officer, not a general audience. Be direct and factual.";

  const providers = [
    { name: "NVIDIA", url: "https://integrate.api.nvidia.com/v1/chat/completions", key: nvidiaKey },
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groqKey },
  ].filter((p) => p.key);

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false });
  }

  try {
    // Baseline weeks: 4, 8, or 12 — defaults to 8
    const bwParam = req.nextUrl.searchParams.get("baseline");
    const baselineWeeks: 4 | 8 | 12 =
      bwParam === "4" ? 4 : bwParam === "12" ? 12 : 8;
    const baselineDays = baselineWeeks * 7;

    const today = istDate();

    const [caseRows, unitRows, districtRows, crimeHeadRows] = await Promise.all([
      getAllRows("CaseMaster"),
      getAllRows("Unit"),
      getAllRows("District"),
      getAllRows("CrimeHead"),
    ]);

    // station → district + name
    const stationDistrict = new Map<number, number>();
    const stationName = new Map<number, string>();
    for (const r of unitRows) {
      const u = unwrap(r, "Unit");
      const id = num(u.UnitID);
      const d = num(u.DistrictID);
      if (id !== null && d !== null) stationDistrict.set(id, d);
      if (id !== null) stationName.set(id, s(u.UnitName) || `Station ${id}`);
    }

    // district metadata
    const districtMeta = new Map<number, { name: string; lat: number | null; lng: number | null }>();
    for (const r of districtRows) {
      const d = unwrap(r, "District");
      const id = num(d.DistrictID);
      if (id === null) continue;
      const coord = coordPair(d.Latitude, d.Longitude);
      districtMeta.set(id, {
        name: s(d.DistrictName) || `District ${id}`,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
      });
    }

    // crime head id → name
    const crimeHeadName = new Map<number, string>();
    for (const r of crimeHeadRows) {
      const h = unwrap(r, "CrimeHead");
      const id = num(h.CrimeHeadID);
      if (id !== null) crimeHeadName.set(id, s(h.CrimeHeadName) || `Head ${id}`);
    }

    // ── Build daily series (last 30 days) ────────────────────────────────────

    const window30Start = subtractDays(today, 29); // 30 days inclusive of today
    const dailyCounts = new Map<string, number>();
    // per-category daily counts: categoryId → (date → count)
    const categoryDailyCounts = new Map<number, Map<string, number>>();
    for (let i = 0; i < 30; i++) {
      dailyCounts.set(subtractDays(today, i), 0);
    }

    // ── Current week and variable-length baseline ─────────────────────────────
    // Current week: last 7 days (including today)
    const weekStart = subtractDays(today, 6);
    // Baseline: baselineWeeks full weeks before the current week
    const baselineEnd = subtractDays(today, 7);

    let currentWeekCount = 0;
    const baselineDayCounts = new Map<string, number>();
    for (let i = 0; i < baselineDays; i++) {
      baselineDayCounts.set(subtractDays(baselineEnd, i), 0);
    }

    // ── Day-of-week counts (last 90 days for a meaningful sample) ────────────
    const dow90Start = subtractDays(today, 89);
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // index 0 = Sunday … 6 = Saturday

    // ── District totals for hotspots + per-district risk ─────────────────────
    const districtTotals = new Map<number, { total: number; heinous: number }>();
    // per-district: current week count and baseline day counts
    const districtCurrentWeek = new Map<number, number>();
    const districtBaselineCounts = new Map<number, number>(); // total over 56 baseline days
    // per-station totals (all time + last 30 days)
    const stationTotals = new Map<number, { allTime: number; last30: number }>();

    for (const r of caseRows) {
      const c = unwrap(r, "CaseMaster");
      const registered = dayOf(c.CrimeRegisteredDate);

      const stationId = num(c.PoliceStationID);
      const districtId = stationId !== null ? stationDistrict.get(stationId) ?? null : null;

      // daily series (total)
      if (registered && dailyCounts.has(registered)) {
        dailyCounts.set(registered, (dailyCounts.get(registered) ?? 0) + 1);
      }

      // daily series per crime head (last 30 days only)
      const headId = num(c.CrimeHeadID);
      if (registered && registered >= window30Start && registered <= today && headId !== null) {
        if (!categoryDailyCounts.has(headId)) {
          const empty = new Map<string, number>();
          for (let i = 0; i < 30; i++) empty.set(subtractDays(today, i), 0);
          categoryDailyCounts.set(headId, empty);
        }
        const m = categoryDailyCounts.get(headId)!;
        if (m.has(registered)) m.set(registered, (m.get(registered) ?? 0) + 1);
      }

      // current week
      if (registered && registered >= weekStart && registered <= today) {
        currentWeekCount++;
      }

      // baseline
      if (registered && baselineDayCounts.has(registered)) {
        baselineDayCounts.set(registered, (baselineDayCounts.get(registered) ?? 0) + 1);
      }

      // district totals (all time) + per-district risk windows
      if (districtId !== null) {
        const existing = districtTotals.get(districtId) ?? { total: 0, heinous: 0 };
        existing.total++;
        if (GRAVITY_HEINOUS.has(num(c.GravityOffenceID) ?? 0)) existing.heinous++;
        districtTotals.set(districtId, existing);

        if (registered && registered >= weekStart && registered <= today) {
          districtCurrentWeek.set(districtId, (districtCurrentWeek.get(districtId) ?? 0) + 1);
        }
        if (registered && baselineDayCounts.has(registered)) {
          districtBaselineCounts.set(districtId, (districtBaselineCounts.get(districtId) ?? 0) + 1);
        }
      }

      // day-of-week (last 90 days)
      if (registered && registered >= dow90Start && registered <= today) {
        const d = new Date(`${registered}T00:00:00Z`).getUTCDay(); // 0=Sun…6=Sat
        dowCounts[d]++;
      }

      // station totals
      if (stationId !== null) {
        const ex = stationTotals.get(stationId) ?? { allTime: 0, last30: 0 };
        ex.allTime++;
        if (registered && registered >= window30Start && registered <= today) ex.last30++;
        stationTotals.set(stationId, ex);
      }
    }

    // ── Forecast ─────────────────────────────────────────────────────────────

    // Ordered array: index 0 = 29 days ago, index 29 = today
    const series: number[] = [];
    for (let i = 29; i >= 0; i--) {
      series.push(dailyCounts.get(subtractDays(today, i)) ?? 0);
    }

    // Historical trend points for the chart (last 30 days with dates)
    const historicalTrend = series.map((count, i) => ({
      date: subtractDays(today, 29 - i),
      count,
    }));

    // Only forecast when at least 7 of the 30 days had a non-zero registration.
    const daysWithData = series.filter((v) => v > 0).length;
    const MIN_DAYS_FOR_FORECAST = 7;

    let forecastPoints: { date: string; count: number; lower: number; upper: number }[] | null = null;
    let forecastTotal: number | null = null;

    if (daysWithData >= MIN_DAYS_FOR_FORECAST) {
      const { m, b } = linearRegression(series);

      // Residual standard error of the OLS fit over the 30-day training window.
      // SE = sqrt( sum((y_i - ŷ_i)^2) / (n - 2) )
      // Used to build a ±1 SE band around each forecast point.
      const n = series.length;
      const ssRes = series.reduce((acc, y, i) => {
        const yHat = m * i + b;
        return acc + (y - yHat) ** 2;
      }, 0);
      const se = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

      forecastPoints = [];
      let total = 0;
      for (let i = 0; i < 7; i++) {
        const x = 30 + i;
        const projected = Math.max(0, Math.round(m * x + b));
        const date = addDays(today, i + 1);
        forecastPoints.push({
          date,
          count: projected,
          lower: Math.max(0, Math.round(projected - se)),
          upper: Math.round(projected + se),
        });
        total += projected;
      }
      forecastTotal = total;
    }

    // ── Day-of-week heatmap ───────────────────────────────────────────────────

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowMax = Math.max(1, ...dowCounts);
    const dowTotal = dowCounts.reduce((a, v) => a + v, 0);
    const dayHeatmap = DAY_LABELS.map((label, i) => ({
      day: label,
      count: dowCounts[i],
      // 0.0 – 1.0 intensity relative to the busiest day
      intensity: dowCounts[i] / dowMax,
      sharePct: dowTotal > 0 ? Math.round((dowCounts[i] / dowTotal) * 1000) / 10 : 0,
    }));
    const peakDay = dayHeatmap.reduce((a, b) => (b.count > a.count ? b : a), dayHeatmap[0]);

    // ── Repeat location detection ─────────────────────────────────────────────
    //
    // A station is flagged when its share of its district's all-time total
    // significantly exceeds the district's fair share (1 / number_of_stations).
    //
    // concentrationRatio = stationShare / fairShare
    //   >= 3.0  → HIGH   (station handles 3x its expected load)
    //   >= 2.0  → MEDIUM
    //   >= 1.5  → LOW
    //   < 1.5   → not flagged
    //
    // Stations with fewer than 3 all-time cases are excluded — a ratio of ∞
    // from a single case in a district with one station would dominate the list.

    // count stations per district
    const stationsPerDistrict = new Map<number, number>();
    for (const [sid] of stationTotals) {
      const did = stationDistrict.get(sid);
      if (did !== undefined) {
        stationsPerDistrict.set(did, (stationsPerDistrict.get(did) ?? 0) + 1);
      }
    }

    const repeatLocations = Array.from(stationTotals.entries())
      .map(([sid, counts]) => {
        const did = stationDistrict.get(sid);
        const districtTotal = did !== undefined ? (districtTotals.get(did)?.total ?? 0) : 0;
        const numStations = did !== undefined ? (stationsPerDistrict.get(did) ?? 1) : 1;
        const fairShare = districtTotal > 0 ? 1 / numStations : 0;
        const stationShare = districtTotal > 0 ? counts.allTime / districtTotal : 0;
        const concentrationRatio = fairShare > 0 ? stationShare / fairShare : 0;
        const flag: "HIGH" | "MEDIUM" | "LOW" | null =
          concentrationRatio >= 3.0 ? "HIGH"
          : concentrationRatio >= 2.0 ? "MEDIUM"
          : concentrationRatio >= 1.5 ? "LOW"
          : null;
        return {
          stationId: sid,
          stationName: stationName.get(sid) ?? `Station ${sid}`,
          districtId: did ?? null,
          districtName: did !== undefined ? (districtMeta.get(did)?.name ?? `District ${did}`) : "Unknown",
          allTimeTotal: counts.allTime,
          last30Total: counts.last30,
          concentrationRatio: Math.round(concentrationRatio * 100) / 100,
          flag,
        };
      })
      .filter((s) => s.flag !== null && s.allTimeTotal >= 3)
      .sort((a, b) => b.concentrationRatio - a.concentrationRatio)
      .slice(0, 10);

    // ── Category breakdown forecast ───────────────────────────────────────────

    // Top 8 categories by total registrations in the last 30 days, each with
    // their own OLS projection. Categories with fewer than 3 days of data are
    // shown with their historical total only (no forecast).
    const MIN_DAYS_FOR_CAT_FORECAST = 3;

    const categoryBreakdown = Array.from(categoryDailyCounts.entries())
      .map(([headId, dayCounts]) => {
        const catSeries: number[] = [];
        for (let i = 29; i >= 0; i--) {
          catSeries.push(dayCounts.get(subtractDays(today, i)) ?? 0);
        }
        const total = catSeries.reduce((a, v) => a + v, 0);
        const daysWithData = catSeries.filter((v) => v > 0).length;
        let forecastedTotal: number | null = null;
        if (daysWithData >= MIN_DAYS_FOR_CAT_FORECAST) {
          const { m, b } = linearRegression(catSeries);
          forecastedTotal = 0;
          for (let i = 0; i < 7; i++) {
            forecastedTotal += Math.max(0, Math.round(m * (30 + i) + b));
          }
        }
        return {
          headId,
          headName: crimeHeadName.get(headId) ?? `Head ${headId}`,
          last30Total: total,
          forecastedWeekTotal: forecastedTotal,
        };
      })
      .filter((c) => c.last30Total > 0)
      .sort((a, b) => b.last30Total - a.last30Total)
      .slice(0, 8);

    // ── Case closure rate trend (last 12 weeks) ───────────────────────────────
    //
    // For each of the last 12 complete weeks (week 1 = most recent ended Sunday),
    // we compute: registeredCount, closedCount, closureRate (closed/registered).
    // CaseStatusID 3 = Closed. Cases with no registration date are excluded.
    // "Closed this week" uses CrimeRegisteredDate as the only date we have
    // (no separate closure-date column), so this measures closure of cases
    // registered in that week, not closure actions taken that week.

    const CLOSED_STATUS_ID = 3;
    const NUM_CLOSURE_WEEKS = 12;
    const closureWeeks: { weekLabel: string; registered: number; closed: number; rate: number }[] = [];

    for (let w = NUM_CLOSURE_WEEKS - 1; w >= 0; w--) {
      // week window: [wkStart, wkEnd] inclusive
      const wkEnd = subtractDays(today, w * 7);
      const wkStart = subtractDays(wkEnd, 6);
      let registered = 0;
      let closed = 0;
      for (const r of caseRows) {
        const c = unwrap(r, "CaseMaster");
        const reg = dayOf(c.CrimeRegisteredDate);
        if (!reg || reg < wkStart || reg > wkEnd) continue;
        registered++;
        if (num(c.CaseStatusID) === CLOSED_STATUS_ID) closed++;
      }
      const rate = registered > 0 ? Math.round((closed / registered) * 1000) / 10 : 0;
      closureWeeks.push({ weekLabel: wkStart, registered, closed, rate });
    }

    // ── Risk indicator ────────────────────────────────────────────────────────

    // Average daily count over the baseline, then scale to a week.
    const baselineTotal = Array.from(baselineDayCounts.values()).reduce((a, v) => a + v, 0);
    const baselineWeekAvg = baselineTotal / baselineWeeks;
    const riskLevel = classifyRisk(currentWeekCount, baselineWeekAvg);

    // ── Hotspots ──────────────────────────────────────────────────────────────

    const hotspots = Array.from(districtTotals.entries())
      .map(([districtId, counts]) => {
        const meta = districtMeta.get(districtId);
        const curWeek = districtCurrentWeek.get(districtId) ?? 0;
        const baselineTotal = districtBaselineCounts.get(districtId) ?? 0;
        const districtBaselineWeekAvg = baselineTotal / baselineWeeks;
        return {
          districtId,
          districtName: meta?.name ?? `District ${districtId}`,
          latitude: meta?.lat ?? null,
          longitude: meta?.lng ?? null,
          total: counts.total,
          heinous: counts.heinous,
          districtRisk: {
            level: classifyRisk(curWeek, districtBaselineWeekAvg),
            currentWeekCount: curWeek,
            baselineWeekAvg: Math.round(districtBaselineWeekAvg * 10) / 10,
          },
        };
      })
      .filter((h) => h.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ── Patrol assignment recommendations ────────────────────────────────────
    //
    // Combines risk level, case volume, heinous count, and repeat-location flags
    // to produce a prioritised patrol allocation list — no new data fetched.
    //
    // Priority scoring (higher = more patrol needed):
    //   CRITICAL risk          → +40
    //   SIGNIFICANT risk       → +25
    //   ELEVATED risk          → +12
    //   Each heinous case      → +5  (capped at +20)
    //   currentWeekCount       → +1 per case (capped at +10)
    //
    // Recommended days come from the global dayHeatmap (top-3 by count).
    // Flagged stations per district come from repeatLocations.

    const RISK_SCORE: Record<RiskLevel, number> = {
      CRITICAL_PATTERN_DETECTED: 40,
      SIGNIFICANT_INCREASE: 25,
      ELEVATED_HISTORICAL_RISK: 12,
      NORMAL: 0,
    };

    // Top-3 global patrol days from dayHeatmap
    const topPatrolDays = [...dayHeatmap]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((d) => d.day);

    const patrolRecommendations = hotspots
      .map((h) => {
        const riskScore = RISK_SCORE[h.districtRisk.level];
        const heinousScore = Math.min(20, h.heinous * 5);
        const weekScore = Math.min(10, h.districtRisk.currentWeekCount);
        const totalScore = riskScore + heinousScore + weekScore;

        const priority: "HIGH" | "MEDIUM" | "LOW" =
          totalScore >= 40 ? "HIGH" : totalScore >= 15 ? "MEDIUM" : "LOW";

        // Flagged stations in this district
        const flaggedStations = repeatLocations
          .filter((r) => r.districtId === h.districtId)
          .map((r) => ({ name: r.stationName, flag: r.flag, ratio: r.concentrationRatio }));

        // Build a one-line rationale
        const reasons: string[] = [];
        if (h.districtRisk.level !== "NORMAL") reasons.push(`${h.districtRisk.level.replace(/_/g, " ").toLowerCase()} risk`);
        if (h.heinous > 0) reasons.push(`${h.heinous} heinous case${h.heinous > 1 ? "s" : ""}`);
        if (h.districtRisk.currentWeekCount > 0) reasons.push(`${h.districtRisk.currentWeekCount} cases this week`);
        if (flaggedStations.length) reasons.push(`${flaggedStations.length} high-concentration station${flaggedStations.length > 1 ? "s" : ""}`);

        return {
          districtId: h.districtId,
          districtName: h.districtName,
          priority,
          score: totalScore,
          riskLevel: h.districtRisk.level,
          currentWeekCount: h.districtRisk.currentWeekCount,
          totalCases: h.total,
          heinousCases: h.heinous,
          recommendedDays: topPatrolDays,
          flaggedStations,
          rationale: reasons.length ? reasons.join("; ") : "baseline monitoring",
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // ── AI summary (optional — failure does not fail the response) ────────────

    const summary = await buildSummary({
      riskLevel,
      currentWeek: currentWeekCount,
      baselineWeek: baselineWeekAvg,
      forecastTotal,
      topHotspots: hotspots.slice(0, 5),
      topCategories: categoryBreakdown.slice(0, 5),
      repeatLocations: repeatLocations.slice(0, 3),
      peakDay: peakDay ?? null,
      today,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      configured: true,
      today,
      forecast: forecastPoints
        ? {
            available: true,
            historicalTrend,
            forecastPoints,
            forecastTotal,
            daysWithData,
            methodology: "OLS linear projection over last 30 days",
          }
        : {
            available: false,
            historicalTrend,
            forecastPoints: null,
            forecastTotal: null,
            daysWithData,
            methodology: null,
          },
      riskIndicator: {
        level: riskLevel,
        currentWeekCount,
        baselineWeekAvg: Math.round(baselineWeekAvg * 10) / 10,
        baselineWeeks,
      },
      hotspots,
      repeatLocations,
      categoryBreakdown,
      dayHeatmap,
      peakDay: peakDay.count > 0 ? peakDay : null,
      closureWeeks,
      patrolRecommendations,
      summary: summary ?? null,
    });
  } catch (error: any) {
    console.error("[analytics/predictive]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to compute predictive analytics." },
      { status: 500 }
    );
  }
}
