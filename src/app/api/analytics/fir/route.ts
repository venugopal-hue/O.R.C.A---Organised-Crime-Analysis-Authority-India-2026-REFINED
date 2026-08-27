import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { resolveScope } from "@/lib/jurisdiction";
import {
  applyFilters,
  loadFirCases,
  openDays,
  readFilters,
  scopeCases,
  type FirCase,
} from "@/lib/firCases";
import {
  GRAVITY_HEINOUS,
  STATUS_CHARGE_SHEETED,
  STATUS_CLOSED,
  STATUS_UNDER_INVESTIGATION,
} from "@/lib/threatIndex";
import {
  AGE_BUCKETS,
  DAY_NAMES,
  ageBucketOf,
  bucketOf,
  bucketSeries,
  dayOf,
  dayOfWeekIndex,
  daysBetween,
  deltaPct,
  granularityFor,
  inRange,
  isOverdue,
  istDate,
  mean,
  previousRange,
  ratePct,
  resolveRange,
  toSlices,
  type DateRange,
} from "@/lib/firAnalytics";

/**
 * GET /api/analytics/fir — the FIR Live Analytics panel's whole payload.
 *
 * WHAT IS NEW HERE
 *
 * Crime Analytics could already count cases per district. It had no concept of
 * WHEN, so it could not answer "is this getting worse", "what is about to
 * breach the statutory window", or "how long are we taking to charge-sheet".
 * All three are operational questions; none of them were on the console.
 *
 * TWO TABLES NOTHING IN THIS PLATFORM HAD EVER READ
 *
 * `ChargesheetDetails.csdate` and `ArrestSurrender.ArrestSurrenderDate` exist
 * and were unused. They are what make disposal speed and arrest rate real
 * measurements rather than estimates, so they are joined here.
 *
 * WHERE JURISDICTION APPLIES, AND WHERE IT DELIBERATELY DOES NOT
 *
 * Aggregates are STATEWIDE, matching /api/analytics/crime — every officer
 * holding the Crime Analytics tab already sees statewide district totals, and
 * splitting that would leave two screens disagreeing about the same number.
 * Record-level output — the recent activity stream, and the drill-down list in
 * ./cases — is filtered through the jurisdiction layer, because a district
 * total is not the same disclosure as the names on a particular FIR.
 *
 * `scopeNote` states which rule produced what is on screen; it is never left
 * for the officer to infer.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();

/** Enough to render a stream, not enough to be a bulk export. */
const RECENT_LIMIT = 15;
/** Beyond this the bar chart is a wall of slivers. */
const TOP_N = 12;

const countBy = (cases: FirCase[], key: (c: FirCase) => string) => {
  const m = new Map<string, number>();
  for (const c of cases) {
    const k = key(c) || "(not recorded)";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, cases: 0 });
  }

  try {
    const url = req.nextUrl;
    const today = istDate();
    const range = resolveRange(
      url.searchParams.get("range") || "last30",
      url.searchParams.get("from"),
      url.searchParams.get("to")
    );
    const filters = readFilters(url);

    const { cases, filters: options } = await loadFirCases();
    const scope = await resolveScope({
      employeeId: (officer as any).employeeId ?? null,
      kgid: (officer as any).badgeId ?? null,
      dashboardRole: officer.dashboardRole,
    });

    const rows = applyFilters(cases, range, filters, today);
    const total = rows.length;

    /* ── Headline counts ─────────────────────────────────────────────── */
    const openCases = rows.filter((c) => c.statusId === STATUS_UNDER_INVESTIGATION);
    const overdue = openCases.filter((c) => {
      const d = openDays(c, today);
      return d !== null && isOverdue(d, c.heinous);
    });

    // Deliberately NOT range-filtered: "registered today" means today, whatever
    // window the officer happens to be looking at.
    const allInScopeOfFilters = applyFilters(cases, resolveRange("all"), filters, today);
    const since = (from: string) => allInScopeOfFilters.filter((c) => c.registered >= from).length;
    const weekStartDay = (() => {
      const dow = dayOfWeekIndex(today);
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - dow);
      return d.toISOString().slice(0, 10);
    })();

    /* ── Disposal speed, from tables nothing else reads ──────────────── */
    const [chargesheets, arrests] = await Promise.all([
      getAllRows("ChargesheetDetails"),
      getAllRows("ArrestSurrender"),
    ]);

    const csDateByCase = new Map<string, string>();
    for (const r of chargesheets) {
      const cs = unwrap(r, "ChargesheetDetails");
      const id = s(cs.CaseMasterID);
      const d = dayOf(cs.csdate);
      // Earliest charge sheet is the one that stopped the investigation clock.
      if (id && d && (!csDateByCase.has(id) || d < csDateByCase.get(id)!)) csDateByCase.set(id, d);
    }
    const arrestedCases = new Set<string>();
    for (const r of arrests) {
      const a = unwrap(r, "ArrestSurrender");
      const id = s(a.CaseMasterID);
      if (id) arrestedCases.add(id);
    }

    const rowIds = new Set(rows.map((c) => c.caseMasterId));
    const daysToChargesheet: number[] = [];
    for (const c of rows) {
      const cs = csDateByCase.get(c.caseMasterId);
      if (cs && c.registered) daysToChargesheet.push(Math.max(0, daysBetween(c.registered, cs)));
    }
    const disposed = rows.filter(
      (c) => c.statusId === STATUS_CHARGE_SHEETED || c.statusId === STATUS_CLOSED
    ).length;
    const withArrest = [...rowIds].filter((id) => arrestedCases.has(id)).length;

    /* ── Trend ───────────────────────────────────────────────────────── */
    const granularity = granularityFor(range);
    const trendCounts = new Map<string, number>();
    for (const c of rows) {
      const b = bucketOf(c.registered, granularity);
      if (b) trendCounts.set(b, (trendCounts.get(b) || 0) + 1);
    }
    // Empty buckets are included, or a quiet fortnight becomes a straight line
    // between two peaks and reads as steady activity.
    const spine = bucketSeries(range, granularity);
    const trend = (spine.length ? spine : [...trendCounts.keys()].sort()).map((bucket) => ({
      bucket,
      count: trendCounts.get(bucket) || 0,
    }));

    const dayOfWeek = DAY_NAMES.map((label, i) => ({
      label,
      count: rows.filter((c) => c.registered && dayOfWeekIndex(c.registered) === i).length,
    }));

    /* ── Comparison ──────────────────────────────────────────────────── */
    const prev = previousRange(range);
    const previousTotal = prev ? applyFilters(cases, prev, filters, today).length : 0;

    /* ── Ageing ──────────────────────────────────────────────────────── */
    const ageing = AGE_BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      note: b.note,
      count: openCases.filter((c) => {
        const d = openDays(c, today);
        return d !== null && ageBucketOf(d).id === b.id;
      }).length,
    }));

    /* ── Record-level output is scoped ───────────────────────────────── */
    const visible = scopeCases(rows, scope);
    const withheld = rows.length - visible.length;
    const recent = [...visible]
      .sort((a, b) => b.registered.localeCompare(a.registered) || b.caseMasterId.localeCompare(a.caseMasterId))
      .slice(0, RECENT_LIMIT)
      .map((c) => ({
        caseMasterId: c.caseMasterId,
        crimeNo: c.crimeNo,
        caseNo: c.caseNo,
        registered: c.registered,
        station: c.stationName,
        district: c.districtName,
        status: c.statusName,
        gravity: c.gravityName,
        heinous: c.heinous,
        head: c.headName,
        officer: c.officerName,
        ageDays: openDays(c, today),
      }));

    return NextResponse.json({
      success: true,
      configured: true,
      generatedAt: new Date().toISOString(),
      today,
      range,
      granularity,
      totals: {
        total,
        registeredToday: since(today),
        registeredThisWeek: since(weekStartDay),
        registeredThisMonth: since(`${today.slice(0, 7)}-01`),
        underInvestigation: openCases.length,
        chargeSheeted: rows.filter((c) => c.statusId === STATUS_CHARGE_SHEETED).length,
        closed: rows.filter((c) => c.statusId === STATUS_CLOSED).length,
        heinous: rows.filter((c) => c.heinous).length,
        overdue: overdue.length,
      },
      rates: {
        disposalPct: ratePct(disposed, total),
        gravePct: ratePct(rows.filter((c) => c.heinous).length, total),
        arrestPct: ratePct(withArrest, total),
        meanDaysToChargesheet: mean(daysToChargesheet),
        chargesheetSample: daysToChargesheet.length,
        meanAgeOpen: mean(
          openCases.map((c) => openDays(c, today)).filter((d): d is number => d !== null)
        ),
      },
      comparison: {
        previousLabel: prev ? `${prev.from} to ${prev.to}` : null,
        previousTotal,
        delta: prev ? deltaPct(total, previousTotal) : null,
      },
      ageing,
      byStatus: toSlices(countBy(rows, (c) => c.statusName), total),
      byGravity: toSlices(countBy(rows, (c) => c.gravityName), total),
      byCategory: toSlices(countBy(rows, (c) => c.categoryName), total),
      byHead: toSlices(countBy(rows, (c) => c.headName), total).slice(0, TOP_N),
      byDistrict: toSlices(countBy(rows, (c) => c.districtName), total).slice(0, TOP_N),
      byStation: toSlices(countBy(rows, (c) => c.stationName), total).slice(0, TOP_N),
      trend,
      dayOfWeek,
      recent,
      options,
      scope: {
        statewide: scope.statewide,
        basis: scope.basis,
        withheldFromRecords: withheld,
        note:
          "Totals and charts are statewide, matching the district figures on this screen. " +
          "The activity stream and drill-down lists show only records within this officer's jurisdiction.",
      },
      /*
       * Said out loud rather than left to the reader. The overdue count leans on
       * gravity because the schema records gravity, not the sentence the offence
       * carries — which is what BNSS s.187(3) actually turns on.
       */
      caveats: [
        `Overdue means an open case past ${90} days (heinous) or ${60} days (other) since registration. Gravity stands in for the statutory test, which turns on the punishment the offence carries — this is an operational flag, not a legal finding on default bail.`,
        "Registration dates carry no time of day in this schema, so hourly patterns cannot be shown.",
      ],
    });
  } catch (error: any) {
    console.error("[analytics/fir]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not read FIR analytics." },
      { status: 500 }
    );
  }
}
