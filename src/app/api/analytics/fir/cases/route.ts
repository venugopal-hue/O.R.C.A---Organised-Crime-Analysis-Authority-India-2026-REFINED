import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { isCatalystConfigured } from "@/lib/catalyst";
import { resolveScope } from "@/lib/jurisdiction";
import {
  applyFilters,
  loadFirCases,
  openDays,
  readFilters,
  scopeCases,
} from "@/lib/firCases";
import { istDate, resolveRange } from "@/lib/firAnalytics";

/**
 * GET /api/analytics/fir/cases — the list behind a number.
 *
 * Every figure on the FIR Live panel is clickable, and this is what it opens.
 * It takes exactly the same query parameters as the aggregate route, so the
 * drill-down cannot drift from the figure that produced it: same loader, same
 * filters, same range. A list that disagrees with the card above it is worse
 * than no list, because the officer has no way to tell which one is lying.
 *
 * THE ONE DIFFERENCE, AND IT IS DELIBERATE
 *
 * The aggregate route reports statewide totals. This one returns NAMED
 * RECORDS, so it filters through the jurisdiction layer first — a district
 * count is not the same disclosure as an FIR number, a station and an
 * investigating officer. `withheld` reports how many rows the scope removed,
 * so a partial list never looks like a complete one.
 */

const PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, rows: [], total: 0 });
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

    const page = Math.max(0, Number(url.searchParams.get("page") || 0) || 0);
    const size = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("size") || PAGE_SIZE) || PAGE_SIZE)
    );
    const search = String(url.searchParams.get("q") || "").trim().toLowerCase();

    const { cases } = await loadFirCases();
    const scope = await resolveScope({
      employeeId: (officer as any).employeeId ?? null,
      kgid: (officer as any).badgeId ?? null,
      dashboardRole: officer.dashboardRole,
    });

    const matched = applyFilters(cases, range, filters, today);
    const visible = scopeCases(matched, scope);
    const withheld = matched.length - visible.length;

    // Free-text search WITHIN the slice, never across it — this cannot be used
    // to reach a record the filters and the scope already excluded.
    const searched = search
      ? visible.filter((c) =>
          [c.crimeNo, c.caseNo, c.stationName, c.districtName, c.headName, c.officerName, c.statusName]
            .join(" ")
            .toLowerCase()
            .includes(search)
        )
      : visible;

    const sorted = [...searched].sort(
      (a, b) =>
        b.registered.localeCompare(a.registered) ||
        b.caseMasterId.localeCompare(a.caseMasterId)
    );

    const start = page * size;
    const slice = sorted.slice(start, start + size);

    return NextResponse.json({
      success: true,
      configured: true,
      total: sorted.length,
      page,
      size,
      hasMore: start + size < sorted.length,
      withheld,
      scopeBasis: scope.basis,
      rows: slice.map((c) => ({
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
      })),
    });
  } catch (error: any) {
    console.error("[analytics/fir/cases]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not read the case list." },
      { status: 500 }
    );
  }
}
