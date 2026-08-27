"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Inbox,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Download,
  Printer,
  Search,
} from "lucide-react";
import { SearchableSelect, type SelectOption } from "@/components/dynamic/SearchableSelect";
import { BarChart, ColumnChart, DonutChart, WaveformChart } from "@/components/dynamic/AnalyticsCharts";
import { RANGE_OPTIONS } from "@/lib/firAnalytics";
import { buildOrcaPrintDocument } from "@/lib/printDocument";
import { useCatalystProfile } from "@/lib/useCatalystProfile";

/**
 * FIR Live Analytics — the time-aware half of Crime Analytics.
 *
 * WHY IT LIVES INSIDE THIS TAB RATHER THAN BESIDE IT
 *
 * Both this and the district view count `CaseMaster`. Two screens counting the
 * same table independently drift, and when they drift an officer has no way to
 * tell which is right — the same failure that produced `useDistrictStats`. So
 * this is a view of Crime Analytics, not a rival to it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *
 * No hourly registration curve and no six-hour surge alert.
 * `CrimeRegisteredDate` is a Catalyst `date`; nothing in this schema records
 * the time of day an FIR was registered. Charting it would mean inventing
 * midnight for every case. The day-of-week column chart is the honest version
 * of the same question.
 *
 * No live push either. Catalyst has no change feed, so an "SSE" channel would
 * be a poll wearing a badge — and the polling itself is the risk, since Zoho's
 * token refresh is rate limited and has taken this platform offline before. A
 * true "last synced" timestamp and a refresh button say the same thing without
 * pretending.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const RED = "#b91c1c";
const GREEN = "#047857";
const MONO = "JetBrains Mono, monospace";

interface Option { id: number; name: string }
interface Slice { label: string; count: number; share: number }

interface Payload {
  configured: boolean;
  generatedAt: string;
  today: string;
  range: { key: string; from: string | null; to: string | null; label: string };
  granularity: "day" | "week" | "month";
  totals: Record<string, number>;
  rates: {
    disposalPct: number | null;
    gravePct: number | null;
    arrestPct: number | null;
    meanDaysToChargesheet: number | null;
    chargesheetSample: number;
    meanAgeOpen: number | null;
  };
  comparison: {
    previousLabel: string | null;
    previousTotal: number;
    delta: { value: number | null; label: string; direction: "up" | "down" | "flat" } | null;
  };
  ageing: { id: string; label: string; note: string; count: number }[];
  byStatus: Slice[];
  byGravity: Slice[];
  byCategory: Slice[];
  byHead: Slice[];
  byDistrict: Slice[];
  byStation: Slice[];
  trend: { bucket: string; count: number }[];
  dayOfWeek: { label: string; count: number }[];
  recent: any[];
  options: {
    districts: Option[];
    stations: { id: number; name: string; districtId: number | null }[];
    categories: Option[];
    gravities: Option[];
    statuses: Option[];
    heads: Option[];
  };
  scope: { statewide: boolean; basis: string; withheldFromRecords: number; note: string };
  caveats: string[];
}

const asOptions = (list: { id: number; name: string }[] | undefined): SelectOption[] =>
  (list || []).map((o) => ({ id: String(o.id), label: o.name }));

const fmtDate = (d: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(m) - 1] || m} ${y}`;
};

/** Charts get short labels; the tooltip carries the full date. */
const shortBucket = (granularity: string) => (bucket: string) => {
  if (!bucket) return "";
  const [y, m, d] = bucket.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (granularity === "month") return `${months[Number(m) - 1] || m} ${y.slice(2)}`;
  return `${d} ${months[Number(m) - 1] || m}`;
};

export const FirLiveAnalytics: React.FC = () => {
  const { profile: catalystProfile } = useCatalystProfile();

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const [range, setRange] = useState("last30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [district, setDistrict] = useState("");
  const [station, setStation] = useState("");
  const [category, setCategory] = useState("");
  const [gravity, setGravity] = useState("");
  const [status, setStatus] = useState("");
  const [head, setHead] = useState("");

  const [drill, setDrill] = useState<{ title: string; bucket?: string; status?: string } | null>(null);

  /**
   * Filters are read back from the URL once, on mount.
   *
   * This is what makes a command-centre link shareable: a DySP can send an SP
   * the exact slice they are looking at rather than a description of it.
   */
  const hydrated = useRef(false);
  /*
   * The first fetch WAITS for the URL to be read.
   *
   * Without this there are two fetches on mount — one with the default filters
   * and one with the hydrated ones — and whichever resolves last wins. Seen
   * live: the picker read "All time" while the figures and the freshness line
   * were last-30-days, because the default request came back second.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const p = new URLSearchParams(window.location.search);
    if (p.get("range")) setRange(p.get("range")!);
    if (p.get("from")) setFrom(p.get("from")!);
    if (p.get("to")) setTo(p.get("to")!);
    if (p.get("district")) setDistrict(p.get("district")!);
    if (p.get("station")) setStation(p.get("station")!);
    if (p.get("category")) setCategory(p.get("category")!);
    if (p.get("gravity")) setGravity(p.get("gravity")!);
    if (p.get("status")) setStatus(p.get("status")!);
    if (p.get("head")) setHead(p.get("head")!);
    setReady(true);
  }, []);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("range", range);
    if (range === "custom") {
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
    }
    if (district) qs.set("district", district);
    if (station) qs.set("station", station);
    if (category) qs.set("category", category);
    if (gravity) qs.set("gravity", gravity);
    if (status) qs.set("status", status);
    if (head) qs.set("head", head);
    return qs;
  }, [range, from, to, district, station, category, gravity, status, head]);

  // replaceState, not router.replace: this is a tab inside /dashboard, and a
  // Next navigation here would remount the whole dashboard on every filter tap.
  useEffect(() => {
    if (!hydrated.current) return;
    const url = `${window.location.pathname}?${query.toString()}`;
    window.history.replaceState(null, "", url);
  }, [query]);

  /*
   * Every request carries a sequence number and only the newest one is allowed
   * to write state. Filters change faster than Catalyst answers — a full-table
   * scan behind each one — so without this an earlier, slower response can land
   * after a later one and leave the charts describing a filter the officer has
   * already moved off.
   */
  const requestSeq = useRef(0);

  const load = useCallback(
    async (isRefresh = false) => {
      const seq = ++requestSeq.current;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/fir?${query.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (seq !== requestSeq.current) return;
        if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
        setData(json);
        setSyncedAt(new Date());
      } catch (e: any) {
        if (seq !== requestSeq.current) return;
        // The panel keeps whatever it had and says the figures are stale,
        // rather than blanking to zeroes that look like "no crime".
        setError(e?.message || "Could not load FIR analytics.");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query]
  );

  useEffect(() => { if (ready) load(); }, [load, ready]);

  // Stations cascade off the selected district, so the list stays answerable.
  const stationOptions = useMemo(() => {
    const all = data?.options?.stations || [];
    const scoped = district ? all.filter((u) => String(u.districtId) === district) : all;
    return scoped.map((u) => ({ id: String(u.id), label: u.name }));
  }, [data, district]);

  useEffect(() => {
    if (!station) return;
    if (stationOptions.some((o) => o.id === station)) return;
    // The chosen station is not in the chosen district — clear it rather than
    // filter on something the officer can no longer see.
    setStation("");
  }, [stationOptions, station]);

  const anyFilter = Boolean(district || station || category || gravity || status || head);
  const resetAll = () => {
    setDistrict(""); setStation(""); setCategory(""); setGravity(""); setStatus(""); setHead("");
    setRange("last30"); setFrom(""); setTo("");
  };

  const t = data?.totals || {};
  const kpis = [
    { key: "total", label: "Total FIRs", value: t.total, tone: NAVY, drill: {} as any },
    { key: "today", label: "Registered today", value: t.registeredToday, tone: NAVY },
    { key: "week", label: "This week", value: t.registeredThisWeek, tone: NAVY },
    { key: "month", label: "This month", value: t.registeredThisMonth, tone: NAVY },
    { key: "open", label: "Under investigation", value: t.underInvestigation, tone: "#1E3A8A", drill: { status: "Under Investigation" } },
    { key: "overdue", label: "Overdue", value: t.overdue, tone: RED, drill: { bucket: "overdue" } },
    { key: "cs", label: "Charge-sheeted", value: t.chargeSheeted, tone: GREEN, drill: { status: "Charge Sheeted" } },
    { key: "heinous", label: "Heinous", value: t.heinous, tone: SAFFRON },
  ];

  const exportPdf = async () => {
    if (!data) return;
    await buildOrcaPrintDocument({
      documentTitle: "FIR Live Analytics Summary",
      headerTitle: "O.R.C.A. FIR LIVE ANALYTICS",
      classification: "RESTRICTED — OFFICIAL USE",
      metadata: [
        ["Reporting period", data.range.label],
        ["From", data.range.from ? fmtDate(data.range.from) : "Earliest record"],
        ["To", data.range.to ? fmtDate(data.range.to) : "Latest record"],
        ["Filters applied", describeFilters(data, { district, station, category, gravity, status, head })],
        ["Jurisdiction basis", data.scope.basis],
        ["Generated for", catalystProfile?.name || "Officer"],
        ["KGID", catalystProfile?.kgid || "Not on record"],
        ["Generated at", new Date().toLocaleString() + " IST"],
      ],
      tables: [
        {
          heading: "Headline figures",
          headers: ["Measure", "Value"],
          rows: [
            ["Total FIRs in period", t.total ?? 0],
            ["Under investigation", t.underInvestigation ?? 0],
            ["Overdue (past statutory window)", t.overdue ?? 0],
            ["Charge-sheeted", t.chargeSheeted ?? 0],
            ["Closed", t.closed ?? 0],
            ["Heinous", t.heinous ?? 0],
            ["Disposal rate", data.rates.disposalPct === null ? "Not computable" : `${data.rates.disposalPct}%`],
            [
              "Mean days to charge sheet",
              data.rates.meanDaysToChargesheet === null
                ? "No charge sheets recorded in period"
                : `${data.rates.meanDaysToChargesheet} (n=${data.rates.chargesheetSample})`,
            ],
            ["Arrest recorded", data.rates.arrestPct === null ? "Not computable" : `${data.rates.arrestPct}%`],
          ],
        },
        {
          heading: "Investigation ageing (open cases)",
          headers: ["Bucket", "Cases"],
          rows: data.ageing.map((a) => [a.label, a.count]),
        },
        {
          heading: "By status",
          headers: ["Status", "Cases", "Share"],
          rows: data.byStatus.map((r) => [r.label, r.count, `${r.share}%`]),
        },
        {
          heading: "By district",
          headers: ["District", "Cases", "Share"],
          rows: data.byDistrict.map((r) => [r.label, r.count, `${r.share}%`]),
        },
      ],
      narrative: {
        heading: "Basis and limitations",
        body: [data.scope.note, ...data.caveats].join("\n\n"),
      },
      authority: "Organised Crime Analysis Authority — Karnataka State Police",
    });
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: GRAY }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: SAFFRON }} />
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 11, letterSpacing: 0.6 }}>
          LOADING FIR TELEMETRY…
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <AlertTriangle size={24} color={RED} />
        <div style={{ marginTop: 10, color: RED, fontSize: 13.5 }}>{error}</div>
        <button onClick={() => load()} style={btnPrimary}>Retry</button>
      </div>
    );
  }

  if (data && !data.configured) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: GRAY, fontSize: 13.5 }}>
        Catalyst is not connected, so no FIR statistics can be read.
      </div>
    );
  }

  const noCases = data && data.totals.total === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "visible" }}>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "flex-end",
          padding: "14px 16px",
          background: "rgba(0,0,0,0.02)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ minWidth: 170, flex: "1 1 170px", maxWidth: 200 }}>
          <SearchableSelect
            label="Reporting Period"
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS.map((r) => ({ id: r.key, label: r.label }))}
            placeholder="Last 30 days"
            emptyMessage="—"
          />
        </div>

        {range === "custom" && (
          <>
            <Field label="From">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={dateInput} />
            </Field>
          </>
        )}

        <div style={{ minWidth: 190, flex: "1 1 190px", maxWidth: 230 }}>
          <SearchableSelect
            label="District"
            value={district}
            onChange={setDistrict}
            options={asOptions(data?.options?.districts)}
            placeholder="All Districts"
            emptyMessage="No districts loaded"
          />
        </div>

        <div style={{ minWidth: 190, flex: "1 1 190px", maxWidth: 230 }}>
          <SearchableSelect
            label="Police Station"
            value={station}
            onChange={setStation}
            options={stationOptions}
            placeholder={district ? "All stations in district" : "All Stations"}
            emptyMessage="No stations loaded"
          />
        </div>

        <div style={{ minWidth: 150, flex: "1 1 150px", maxWidth: 180 }}>
          <SearchableSelect
            label="Gravity"
            value={gravity}
            onChange={setGravity}
            options={asOptions(data?.options?.gravities)}
            placeholder="All"
            emptyMessage="—"
          />
        </div>

        <div style={{ minWidth: 175, flex: "1 1 175px", maxWidth: 205 }}>
          <SearchableSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={asOptions(data?.options?.statuses)}
            placeholder="All Statuses"
            emptyMessage="—"
          />
        </div>

        <div style={{ minWidth: 175, flex: "1 1 175px", maxWidth: 210 }}>
          <SearchableSelect
            label="Crime Head"
            value={head}
            onChange={setHead}
            options={asOptions(data?.options?.heads)}
            placeholder="All Crime Heads"
            emptyMessage="—"
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {anyFilter && (
            <button onClick={resetAll} style={btnGhost}>Reset filters</button>
          )}
          <button onClick={() => load(true)} style={btnGhost} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : undefined }} />
            Refresh
          </button>
          <button onClick={exportPdf} style={btnGhost} disabled={!data}>
            <Printer size={13} /> PDF
          </button>
        </div>
      </div>

      {/* ── Freshness ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 11.5,
          color: error ? "#92400e" : GRAY,
          background: error ? "#fffbeb" : "transparent",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: error ? "#d97706" : GREEN, flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5 }}>
          {error ? "STALE" : "SYNCED"}
        </span>
        <span>
          {error
            ? `Live sync interrupted — showing the last good snapshot from ${syncedAt?.toLocaleTimeString() || "earlier"}. ${error}`
            : `Updated ${syncedAt ? syncedAt.toLocaleTimeString() : "—"} · ${data?.range.label}${
                data?.range.from ? ` (${fmtDate(data.range.from)} – ${fmtDate(data.range.to || "")})` : ""
              }`}
        </span>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
        {/*
          The empty state centres by LAYOUT, not by `textAlign: center`.

          Lucide renders its icons as `display: block` svgs, so text alignment
          never reached the icon — it sat hard against the left edge of a block
          the width of the panel while the words were centred beside nothing.
          The padding is sized for a short message too: an empty state is a
          sentence, not a section.
        */}
        {noCases ? (
          <div
            style={{
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              textAlign: "center",
              color: GRAY,
            }}
          >
            <Inbox size={22} color={MUTED} />
            <div style={{ fontWeight: 600, color: NAVY }}>
              {anyFilter || range !== "all"
                ? "No FIRs match this period and filter."
                : "No FIRs registered yet."}
            </div>
            <div style={{ fontSize: 12.5, maxWidth: 460, lineHeight: 1.55 }}>
              Every figure on this panel is counted from registered FIRs. As cases are entered
              through Case Registration, these charts fill in on their own.
            </div>
            {(anyFilter || range !== "all") && (
              <button onClick={resetAll} style={{ ...btnPrimary, marginTop: 8 }}>Clear filters</button>
            )}
          </div>
        ) : (
          <>
            {/* ── KPI cards ───────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {kpis.map((k) => {
                const clickable = !!k.drill;
                return (
                  <div
                    key={k.key}
                    onClick={clickable ? () => setDrill({ title: k.label, ...(k.drill as any) }) : undefined}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderTop: `3px solid ${k.tone}`,
                      borderRadius: 8,
                      padding: "14px 16px",
                      background: "#fff",
                      cursor: clickable ? "pointer" : "default",
                    }}
                  >
                    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6, color: MUTED, textTransform: "uppercase" }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: k.tone, marginTop: 4, lineHeight: 1 }}>
                      {k.value ?? 0}
                    </div>
                    {clickable && (
                      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 6 }}>Click to list</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Comparison + rates ──────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              <Metric
                label="vs previous period"
                value={data!.comparison.delta?.label || "—"}
                sub={data!.comparison.previousLabel ? `${data!.comparison.previousTotal} in ${data!.comparison.previousLabel}` : "No comparable period"}
                icon={
                  data!.comparison.delta?.direction === "up" ? <ArrowUpRight size={14} color={RED} /> :
                  data!.comparison.delta?.direction === "down" ? <ArrowDownRight size={14} color={GREEN} /> :
                  <Minus size={14} color={MUTED} />
                }
              />
              <Metric
                label="Disposal rate"
                value={data!.rates.disposalPct === null ? "—" : `${data!.rates.disposalPct}%`}
                sub="Charge-sheeted or closed, of all FIRs in period"
              />
              <Metric
                label="Mean days to charge sheet"
                value={data!.rates.meanDaysToChargesheet === null ? "—" : String(data!.rates.meanDaysToChargesheet)}
                sub={
                  data!.rates.chargesheetSample
                    ? `From ${data!.rates.chargesheetSample} charge sheet(s) on record`
                    : "No charge sheets recorded in this period"
                }
              />
              <Metric
                label="Arrest recorded"
                value={data!.rates.arrestPct === null ? "—" : `${data!.rates.arrestPct}%`}
                sub="FIRs with an arrest or surrender entry"
              />
              <Metric
                label="Mean age of open cases"
                value={data!.rates.meanAgeOpen === null ? "—" : `${data!.rates.meanAgeOpen} d`}
                sub="Days since registration, still under investigation"
              />
            </div>

            {/* ── Waveform ────────────────────────────────────────────── */}
            <Card title="Registration trend" subtitle={`Grouped by ${data!.granularity}`}>
              <WaveformChart
                data={data!.trend}
                formatLabel={shortBucket(data!.granularity)}
                emptyMessage="No registrations in this period."
              />
            </Card>

            {/* ── Pies ────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
              <Card title="By investigation status">
                <DonutChart data={data!.byStatus} centreLabel="CASES" />
              </Card>
              <Card title="By gravity">
                <DonutChart data={data!.byGravity} centreLabel="CASES" />
              </Card>
            </div>

            {/* ── Ageing ──────────────────────────────────────────────── */}
            <Card
              title="Investigation ageing"
              subtitle="Open cases only, by days since registration"
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {data!.ageing.map((a) => {
                  const critical = a.id === "91-180" || a.id === "180+";
                  return (
                    <div
                      key={a.id}
                      title={a.note}
                      onClick={() => setDrill({ title: `Open cases — ${a.label}`, bucket: a.id })}
                      style={{
                        border: `1px solid ${BORDER}`,
                        borderLeft: `3px solid ${critical ? RED : a.id === "61-90" ? SAFFRON : "#1E3A8A"}`,
                        borderRadius: 6,
                        padding: "10px 12px",
                        cursor: "pointer",
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontFamily: MONO, fontSize: 9.5, color: MUTED, letterSpacing: 0.5 }}>
                        {a.label.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 21, fontWeight: 800, color: critical ? RED : NAVY, marginTop: 3 }}>
                        {a.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ── Bars ────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
              <Card title="By crime head" subtitle="Top categories in this period">
                <BarChart data={data!.byHead} emptyMessage="No crime heads recorded." />
              </Card>
              <Card title="By district" subtitle="Highest volume first">
                <BarChart data={data!.byDistrict} emptyMessage="No district could be resolved." />
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
              <Card title="By police station" subtitle="Top stations in this period">
                <BarChart data={data!.byStation} colour="#0E7490" emptyMessage="No station recorded." />
              </Card>
              <Card
                title="Registrations by day of week"
                subtitle="Registration date carries no time of day, so hourly patterns cannot be shown"
              >
                <ColumnChart data={data!.dayOfWeek} />
              </Card>
            </div>

            {/* ── Recent ──────────────────────────────────────────────── */}
            <Card
              title="Recent FIR activity"
              subtitle={
                data!.scope.withheldFromRecords > 0
                  ? `${data!.scope.withheldFromRecords} record(s) outside your jurisdiction are not listed`
                  : data!.scope.basis
              }
            >
              {data!.recent.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 12.5, padding: "16px 0" }}>
                  No FIRs within your jurisdiction in this period.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                    <thead>
                      <tr>
                        {["Crime No", "Registered", "Station", "District", "Crime head", "Gravity", "Status", "Age"].map((h) => (
                          <th key={h} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data!.recent.map((r) => (
                        <tr key={r.caseMasterId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ ...td, fontFamily: MONO, color: NAVY, fontWeight: 700 }}>{r.crimeNo || "—"}</td>
                          <td style={td}>{fmtDate(r.registered)}</td>
                          <td style={td}>{r.station || "—"}</td>
                          <td style={td}>{r.district || "—"}</td>
                          <td style={td}>{r.head || "—"}</td>
                          <td style={td}>
                            <span style={{ color: r.heinous ? RED : GRAY, fontWeight: r.heinous ? 700 : 400 }}>
                              {r.gravity || "—"}
                            </span>
                          </td>
                          <td style={td}>{r.status || "—"}</td>
                          <td style={{ ...td, fontFamily: MONO }}>{r.ageDays === null ? "—" : `${r.ageDays} d`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Basis ───────────────────────────────────────────────── */}
            <div
              style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", background: "#fbfcfd",
              }}
            >
              <Info size={14} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11.5, color: GRAY, lineHeight: 1.65 }}>
                <div style={{ marginBottom: 6 }}>{data!.scope.note}</div>
                {data!.caveats.map((c, i) => (
                  <div key={i} style={{ marginBottom: i === data!.caveats.length - 1 ? 0 : 5 }}>{c}</div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {drill && (
        <DrillDown
          title={drill.title}
          query={query}
          bucket={drill.bucket}
          statusName={drill.status}
          statuses={data?.options?.statuses || []}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
};

/* ── Drill-down ──────────────────────────────────────────────────────────── */

/**
 * The list behind a number.
 *
 * It re-sends the panel's own query string, so the slice on screen and the
 * slice in the drawer are produced by the same filters. Building the list from
 * anything else is how a drawer ends up disagreeing with the card that opened
 * it.
 */
const DrillDown: React.FC<{
  title: string;
  query: URLSearchParams;
  bucket?: string;
  statusName?: string;
  statuses: Option[];
  onClose: () => void;
}> = ({ title, query, bucket, statusName, statuses, onClose }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [withheld, setWithheld] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const statusId = useMemo(
    () => statuses.find((s) => s.name === statusName)?.id ?? null,
    [statuses, statusName]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setErr(null);
      try {
        const qs = new URLSearchParams(query);
        if (bucket) qs.set("bucket", bucket);
        if (statusId !== null) qs.set("status", String(statusId));
        qs.set("page", String(page));
        if (search.trim()) qs.set("q", search.trim());

        const res = await fetch(`/api/analytics/fir/cases?${qs.toString()}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
        if (cancelled) return;
        setRows(json.rows || []);
        setTotal(json.total || 0);
        setWithheld(json.withheld || 0);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Could not load the list.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query, bucket, statusId, page, search]);

  const exportCsv = () => {
    const header = ["Crime No", "Case No", "Registered", "Station", "District", "Crime head", "Gravity", "Status", "IO", "Age (days)"];
    const body = rows.map((r) => [
      r.crimeNo, r.caseNo, r.registered, r.station, r.district, r.head, r.gravity, r.status, r.officer,
      r.ageDays === null ? "" : r.ageDays,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orca-fir-slice-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,15,35,0.45)",
        display: "flex", justifyContent: "flex-end", zIndex: 1200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)", background: "#fff", height: "100%",
          display: "flex", flexDirection: "column", boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: NAVY, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.7, opacity: 0.75 }}>DRILL-DOWN</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{title}</div>
            </div>
            <button onClick={exportCsv} disabled={!rows.length} style={btnOnNavy}>
              <Download size={13} /> CSV
            </button>
            <button onClick={onClose} style={{ ...btnOnNavy, padding: "7px 9px" }} aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "center" }}>
          <Search size={14} color={MUTED} />
          <input
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
            placeholder="Search within this slice — crime no, station, officer…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: TEXT, background: "transparent" }}
          />
          <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{total} record(s)</span>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
          {busy ? (
            <div style={{ padding: 40, textAlign: "center", color: GRAY }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: SAFFRON }} />
            </div>
          ) : err ? (
            <div style={{ padding: 30, color: RED, fontSize: 13 }}>{err}</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: GRAY, fontSize: 13 }}>
              No records in this slice{withheld > 0 ? " that fall within your jurisdiction" : ""}.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr>
                  {["Crime No", "Registered", "Station", "Crime head", "Gravity", "Status", "IO", "Age"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.caseMasterId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ ...td, fontFamily: MONO, color: NAVY, fontWeight: 700 }}>{r.crimeNo || "—"}</td>
                    <td style={td}>{fmtDate(r.registered)}</td>
                    <td style={td}>{r.station || "—"}</td>
                    <td style={td}>{r.head || "—"}</td>
                    <td style={{ ...td, color: r.heinous ? RED : GRAY, fontWeight: r.heinous ? 700 : 400 }}>{r.gravity || "—"}</td>
                    <td style={td}>{r.status || "—"}</td>
                    <td style={td}>{r.officer || "—"}</td>
                    <td style={{ ...td, fontFamily: MONO }}>{r.ageDays === null ? "—" : `${r.ageDays} d`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
          {withheld > 0 && (
            <span style={{ fontSize: 11.5, color: "#92400e" }}>
              {withheld} matching record(s) are outside your jurisdiction and are not listed.
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || busy} style={btnGhost}>
              Previous
            </button>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: GRAY }}>
              {total === 0 ? "0" : `${page * 25 + 1}–${Math.min((page + 1) * 25, total)} of ${total}`}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={busy || (page + 1) * 25 >= total}
              style={btnGhost}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Small pieces ────────────────────────────────────────────────────────── */

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", padding: "14px 16px" }}>
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Metric: React.FC<{ label: string; value: string; sub: string; icon?: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px", background: "#fff" }}>
    <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6, color: MUTED, textTransform: "uppercase" }}>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
      {icon}
      <span style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{value}</span>
    </div>
    <div style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 0.6, color: GRAY, textTransform: "uppercase" }}>
      {label}
    </label>
    {children}
  </div>
);

function describeFilters(
  data: Payload,
  f: { district: string; station: string; category: string; gravity: string; status: string; head: string }
): string {
  const name = (list: { id: number; name: string }[] | undefined, id: string) =>
    (list || []).find((o) => String(o.id) === id)?.name;
  const parts = [
    f.district && `District: ${name(data.options.districts, f.district) || f.district}`,
    f.station && `Station: ${name(data.options.stations as any, f.station) || f.station}`,
    f.category && `Category: ${name(data.options.categories, f.category) || f.category}`,
    f.gravity && `Gravity: ${name(data.options.gravities, f.gravity) || f.gravity}`,
    f.status && `Status: ${name(data.options.statuses, f.status) || f.status}`,
    f.head && `Crime head: ${name(data.options.heads, f.head) || f.head}`,
  ].filter(Boolean);
  return parts.length ? parts.join("  ·  ") : "None — all records in period";
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "10px 12px", fontSize: 10.5, fontWeight: 700, color: GRAY,
  textTransform: "uppercase", borderBottom: `2px solid ${BORDER}`, whiteSpace: "nowrap",
  fontFamily: MONO, letterSpacing: 0.4,
};
const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, color: TEXT, whiteSpace: "nowrap" };

const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
  border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 6,
  fontSize: 12, color: GRAY, cursor: "pointer", fontWeight: 600,
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 18px", background: NAVY, color: "#fff", border: "none",
  borderRadius: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginTop: 12,
};
const btnOnNavy: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)",
  borderRadius: 6, fontSize: 12, color: "#fff", cursor: "pointer", fontWeight: 600,
};
const dateInput: React.CSSProperties = {
  padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 6,
  fontSize: 12.5, color: TEXT, background: "#fff", fontFamily: MONO,
};

export default FirLiveAnalytics;
