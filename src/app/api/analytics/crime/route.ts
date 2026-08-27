import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import {
  threatIndex,
  GRAVITY_HEINOUS,
  STATUS_CHARGE_SHEETED,
  STATUS_CLOSED,
  STATUS_UNDER_INVESTIGATION,
  type ThreatScore,
} from "@/lib/threatIndex";

/**
 * District-level crime statistics for the Crime Analytics screen.
 *
 * GET /api/analytics/crime?district=&category=&gravity=&status=
 *
 * Everything here is counted from `CaseMaster`. The screen this replaces
 * printed four districts of invented figures - 28 cases here, "9.4 Critical"
 * there - none of which came from any table.
 *
 * `CaseMaster` is empty at the time of writing, so this returns every district
 * with a zero count and the UI says so. That is the point: as FIRs are
 * registered through Case Registration, the same query fills in on its own with
 * no further work.
 *
 * A READ FAILURE IS NOT AN EMPTY DISTRICT.
 *
 * Every load below deliberately lets its error escape. They were each wrapped
 * in `.catch(() => [])`, and the result was seen live: while Catalyst was
 * unreachable this screen reported "No cases registered yet" to a Full Command
 * Administrator — with the FIR Live tab beside it, reading the same tables,
 * correctly reporting a token failure. One of those two was a lie about the
 * state of crime in Karnataka.
 *
 * The handler's own catch turns a failure into a stated error, which the
 * component already renders.
 *
 * A case belongs to a district through its station:
 *
 *     CaseMaster.PoliceStationID  ->  Unit.UnitID  ->  Unit.DistrictID  ->  District
 */

const TABLE_CASE = "CaseMaster";
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

/**
 * Karnataka's bounding box, generously padded. A coordinate outside it is a
 * data-entry error, not a district.
 */
const KA_LAT = [11.0, 19.0] as const;
const KA_LNG = [73.5, 79.0] as const;

/**
 * Parse a stored coordinate pair. Returns nulls unless BOTH values are finite
 * numbers inside Karnataka.
 *
 * A typo that lands a district in the Indian Ocean is worse on a map than a
 * district that simply is not drawn: the pin still carries a real case count,
 * so it reads as a finding about the wrong place. Half a pair is rejected for
 * the same reason — a latitude with no longitude cannot be plotted, and
 * defaulting the other half would invent a location.
 */
const coordPair = (
  rawLat: unknown,
  rawLng: unknown
): { latitude: number | null; longitude: number | null } => {
  const lat = Number(String(rawLat ?? "").trim());
  const lng = Number(String(rawLng ?? "").trim());
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= KA_LAT[0] && lat <= KA_LAT[1] &&
    lng >= KA_LNG[0] && lng <= KA_LNG[1];
  return ok ? { latitude: lat, longitude: lng } : { latitude: null, longitude: null };
};

export interface DistrictStat {
  districtId: number;
  districtName: string;
  /**
   * District headquarters position, or null when the row has no coordinate.
   *
   * Null is a real answer, not a gap to paper over: the map draws only the
   * districts it can actually place, and says how many it could not. Guessing
   * a position would put a case count on the wrong town.
   */
  latitude: number | null;
  longitude: number | null;
  total: number;
  heinous: number;
  underInvestigation: number;
  chargeSheeted: number;
  closed: number;
  threat: ThreatScore;
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, rows: [], filters: null });
  }

  try {
    const url = new URL(req.url);
    const fDistrict = num(url.searchParams.get("district"));
    const fCategory = num(url.searchParams.get("category"));
    const fGravity = num(url.searchParams.get("gravity"));
    const fStatus = num(url.searchParams.get("status"));

    // All cached by catalyst.ts, and the reference tables carry a long TTL, so
    // repeated visits to this screen do not re-scan them.
    const [caseRows, unitRows, districtRows, categoryRows, gravityRows, statusRows] =
      await Promise.all([
        getAllRows(TABLE_CASE),
        getAllRows("Unit"),
        getAllRows("District"),
        getAllRows("CaseCategory"),
        getAllRows("GravityOffence"),
        getAllRows("CaseStatusMaster"),
      ]);

    // station -> district
    const stationDistrict = new Map<number, number>();
    for (const r of unitRows) {
      const u = unwrap(r, "Unit");
      const id = num(u.UnitID);
      const d = num(u.DistrictID);
      if (id !== null && d !== null) stationDistrict.set(id, d);
    }

    const districts = districtRows
      .map((r) => unwrap(r, "District"))
      .filter((d) => num(d.DistrictID) !== null)
      .map((d) => ({
        id: Number(d.DistrictID),
        name: String(d.DistrictName || `District ${d.DistrictID}`),
        ...coordPair(d.Latitude, d.Longitude),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const blank = () => ({ total: 0, heinous: 0, underInvestigation: 0, chargeSheeted: 0, closed: 0 });
    const counts = new Map<number, ReturnType<typeof blank>>();
    for (const d of districts) counts.set(d.id, blank());

    /**
     * Cases whose station maps to no district. Reported rather than folded into
     * a district at random - a miscounted district is worse than a stated gap.
     */
    let unassigned = 0;

    for (const r of caseRows) {
      const c = unwrap(r, TABLE_CASE);

      if (fCategory !== null && num(c.CaseCategoryID) !== fCategory) continue;
      if (fGravity !== null && num(c.GravityOffenceID) !== fGravity) continue;
      if (fStatus !== null && num(c.CaseStatusID) !== fStatus) continue;

      const station = num(c.PoliceStationID);
      const districtId = station !== null ? stationDistrict.get(station) ?? null : null;
      if (districtId === null || !counts.has(districtId)) {
        unassigned++;
        continue;
      }
      if (fDistrict !== null && districtId !== fDistrict) continue;

      const bucket = counts.get(districtId)!;
      bucket.total++;
      if (num(c.GravityOffenceID) === GRAVITY_HEINOUS) bucket.heinous++;
      const status = num(c.CaseStatusID);
      if (status === STATUS_UNDER_INVESTIGATION) bucket.underInvestigation++;
      else if (status === STATUS_CHARGE_SHEETED) bucket.chargeSheeted++;
      else if (status === STATUS_CLOSED) bucket.closed++;
    }

    const visible = fDistrict !== null ? districts.filter((d) => d.id === fDistrict) : districts;

    // volumeRatio is relative to the busiest district in THIS result set, so a
    // filtered view is scored against what it actually shows.
    const maxTotal = Math.max(0, ...visible.map((d) => counts.get(d.id)?.total ?? 0));

    const rows: DistrictStat[] = visible.map((d) => {
      const b = counts.get(d.id) ?? blank();
      return {
        districtId: d.id,
        districtName: d.name,
        latitude: d.latitude,
        longitude: d.longitude,
        ...b,
        threat: threatIndex({ total: b.total, heinous: b.heinous, closed: b.closed }, maxTotal),
      };
    });

    const lookup = (list: any[], table: string, idKey: string, nameKey: string) =>
      list
        .map((r) => unwrap(r, table))
        .filter((x) => num(x[idKey]) !== null)
        .map((x) => ({ id: Number(x[idKey]), name: String(x[nameKey] ?? "") }))
        .sort((a, b) => a.id - b.id);

    const totals = rows.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        heinous: acc.heinous + r.heinous,
        underInvestigation: acc.underInvestigation + r.underInvestigation,
        chargeSheeted: acc.chargeSheeted + r.chargeSheeted,
        closed: acc.closed + r.closed,
      }),
      { total: 0, heinous: 0, underInvestigation: 0, chargeSheeted: 0, closed: 0 }
    );

    return NextResponse.json({
      success: true,
      configured: true,
      rows,
      totals,
      unassigned,
      // Every case in the table, before filters - so the UI can tell "no cases
      // registered yet" apart from "no cases match this filter".
      casesInSystem: caseRows.length,
      filters: {
        districts,
        categories: lookup(categoryRows, "CaseCategory", "CaseCategoryID", "LookupValue"),
        gravities: lookup(gravityRows, "GravityOffence", "GravityOffenceID", "LookupValue"),
        statuses: lookup(statusRows, "CaseStatusMaster", "CaseStatusID", "CaseStatusName"),
      },
    });
  } catch (error: any) {
    console.error("[analytics/crime]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read crime statistics." },
      { status: 500 }
    );
  }
}
