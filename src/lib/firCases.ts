import { getAllRows } from "@/lib/catalyst";
import type { Scope } from "@/lib/jurisdiction";
import { GRAVITY_HEINOUS, STATUS_UNDER_INVESTIGATION } from "@/lib/threatIndex";
import { ageBucketOf, dayOf, daysBetween, inRange, isOverdue, type DateRange } from "@/lib/firAnalytics";

/**
 * Loading and filtering FIR rows for the analytics panel.
 *
 * This lived inside `/api/analytics/fir/route.ts` and was imported from the
 * drill-down route next door. A Next route module may only export request
 * handlers and the framework's own config keys, so exporting these failed the
 * production type check — Turbopack never checks it, webpack does, and the
 * failure only appeared when the build was switched to webpack to solve an
 * unrelated bundling problem.
 *
 * Both routes now import from here, which is also what keeps the aggregate and
 * the drill-down from drifting: same loader, same filters, same scope rule.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};


export interface FirCase {
  caseMasterId: string;
  crimeNo: string;
  caseNo: string;
  registered: string;
  stationId: number | null;
  stationName: string;
  districtId: number | null;
  districtName: string;
  categoryId: number | null;
  categoryName: string;
  gravityId: number | null;
  gravityName: string;
  statusId: number | null;
  statusName: string;
  headId: number | null;
  headName: string;
  officerId: number | null;
  officerName: string;
  heinous: boolean;
}

const mapOf = (rows: any[], table: string, id: string, label: string) => {
  const m = new Map<number, string>();
  for (const r of rows) {
    const rec = unwrap(r, table);
    const key = num(rec[id]);
    if (key !== null) m.set(key, s(rec[label]));
  }
  return m;
};

/**
 * Every read lets its error escape — no `.catch(() => [])` anywhere below.
 *
 * Swallowed, a Catalyst outage renders as "no cases registered", which tells a
 * commanding officer their state is quiet when in fact the database is
 * unreachable. The catch at the bottom of the handler turns it into a stated
 * failure instead.
 */
export async function loadFirCases(): Promise<{ cases: FirCase[]; filters: any }> {
  const [caseRows, units, districts, categories, gravities, statuses, heads, employees] =
    await Promise.all([
      getAllRows("CaseMaster"),
      getAllRows("Unit"),
      getAllRows("District"),
      getAllRows("CaseCategory"),
      getAllRows("GravityOffence"),
      getAllRows("CaseStatusMaster"),
      getAllRows("CrimeHead"),
      getAllRows("Employee"),
    ]);

  const unitName = mapOf(units, "Unit", "UnitID", "UnitName");
  const districtName = mapOf(districts, "District", "DistrictID", "DistrictName");
  const categoryName = mapOf(categories, "CaseCategory", "CaseCategoryID", "LookupValue");
  const gravityName = mapOf(gravities, "GravityOffence", "GravityOffenceID", "LookupValue");
  const statusName = mapOf(statuses, "CaseStatusMaster", "CaseStatusID", "CaseStatusName");
  const headName = mapOf(heads, "CrimeHead", "CrimeHeadID", "CrimeGroupName");
  const employeeName = mapOf(employees, "Employee", "EmployeeID", "FirstName");

  const unitDistrict = new Map<number, number | null>();
  for (const r of units) {
    const u = unwrap(r, "Unit");
    const id = num(u.UnitID);
    if (id !== null) unitDistrict.set(id, num(u.DistrictID));
  }

  const cases: FirCase[] = caseRows.map((r) => {
    const c = unwrap(r, "CaseMaster");
    const stationId = num(c.PoliceStationID);
    const districtId = stationId !== null ? unitDistrict.get(stationId) ?? null : null;
    const gravityId = num(c.GravityOffenceID);
    const officerId = num(c.PolicePersonID);

    return {
      caseMasterId: s(c.CaseMasterID),
      crimeNo: s(c.CrimeNo),
      caseNo: s(c.CaseNo),
      /*
       * A case with no registration date is not dropped. It would vanish from
       * every total on the panel while still sitting in the register, so the
       * creation timestamp stands in and the row is still counted.
       */
      registered: dayOf(c.CrimeRegisteredDate) || dayOf(c.CREATEDTIME),
      stationId,
      stationName: stationId !== null ? unitName.get(stationId) || `Unit ${stationId}` : "",
      districtId,
      districtName: districtId !== null ? districtName.get(districtId) || "" : "",
      categoryId: num(c.CaseCategoryID),
      categoryName: categoryName.get(num(c.CaseCategoryID) ?? -1) || "",
      gravityId,
      gravityName: gravityName.get(gravityId ?? -1) || "",
      statusId: num(c.CaseStatusID),
      statusName: statusName.get(num(c.CaseStatusID) ?? -1) || "",
      headId: num(c.CrimeMajorHeadID),
      headName: headName.get(num(c.CrimeMajorHeadID) ?? -1) || "",
      officerId,
      officerName: officerId !== null ? employeeName.get(officerId) || "" : "",
      heinous: GRAVITY_HEINOUS.has(gravityId ?? 0),
    };
  });

  const asOptions = (m: Map<number, string>) =>
    [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return {
    cases,
    filters: {
      districts: asOptions(districtName),
      // Stations carry their district so the UI can cascade without a round trip.
      stations: [...unitName]
        .map(([id, name]) => ({ id, name, districtId: unitDistrict.get(id) ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      categories: asOptions(categoryName),
      gravities: asOptions(gravityName),
      statuses: asOptions(statusName),
      heads: asOptions(headName),
    },
  };
}

export interface FirFilters {
  district: number | null;
  station: number | null;
  category: number | null;
  gravity: number | null;
  status: number | null;
  head: number | null;
  /** One of AGE_BUCKETS ids, or "overdue". */
  bucket: string | null;
}

export function readFilters(url: URL): FirFilters {
  return {
    district: num(url.searchParams.get("district")),
    station: num(url.searchParams.get("station")),
    category: num(url.searchParams.get("category")),
    gravity: num(url.searchParams.get("gravity")),
    status: num(url.searchParams.get("status")),
    head: num(url.searchParams.get("head")),
    bucket: s(url.searchParams.get("bucket")) || null,
  };
}

/** Days a case has been open, as of today. Null when it is not open. */
export const openDays = (c: FirCase, today: string): number | null =>
  c.statusId === STATUS_UNDER_INVESTIGATION && c.registered
    ? Math.max(0, daysBetween(c.registered, today))
    : null;

export function applyFilters(
  cases: FirCase[],
  range: DateRange,
  f: FirFilters,
  today: string
): FirCase[] {
  return cases.filter((c) => {
    if (!inRange(c.registered, range)) return false;
    if (f.district !== null && c.districtId !== f.district) return false;
    if (f.station !== null && c.stationId !== f.station) return false;
    if (f.category !== null && c.categoryId !== f.category) return false;
    if (f.gravity !== null && c.gravityId !== f.gravity) return false;
    if (f.status !== null && c.statusId !== f.status) return false;
    if (f.head !== null && c.headId !== f.head) return false;

    if (f.bucket) {
      const days = openDays(c, today);
      if (days === null) return false;
      if (f.bucket === "overdue") return isOverdue(days, c.heinous);
      if (ageBucketOf(days).id !== f.bucket) return false;
    }
    return true;
  });
}

export function scopeCases(cases: FirCase[], scope: Scope): FirCase[] {
  if (scope.statewide) return cases;
  const allowed = new Set(scope.unitIds);
  // A case with no station cannot be placed in any jurisdiction — withheld
  // rather than shown to everyone. Fail closed, as elsewhere.
  return cases.filter((c) => c.stationId !== null && allowed.has(c.stationId));
}
