import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { GRAVITY_HEINOUS, STATUS_CLOSED, STATUS_CHARGE_SHEETED } from "@/lib/threatIndex";

/**
 * GET /api/accused/repeat?threshold=3
 *
 * Finds accused persons named on multiple registered cases.
 * Identity is by normalised name — same limitation as the relation graph.
 *
 * Returns a list sorted by case count descending, then by gravity weight
 * (more heinous cases rank higher at equal count).
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const normName = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ");

const genderLabel = (g: string) =>
  ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" } as Record<string, string>)[g] || g || "Unknown";

export interface RepeatAccused {
  name: string;
  normalisedKey: string;
  caseCount: number;
  heinousCount: number;
  activeCount: number;  // under investigation
  gender: string;
  age: string;
  cases: {
    caseMasterId: string;
    crimeNo: string;
    gravity: string;
    isHeinous: boolean;
    statusId: number;
    statusLabel: string;
    registeredDate: string;
    district: string;
    station: string;
  }[];
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) {
    return NextResponse.json({ configured: false, accused: [] });
  }

  const thresholdParam = req.nextUrl.searchParams.get("threshold");
  const threshold = Math.max(2, Number(thresholdParam) || 3);

  const [accusedRows, caseRows, unitRows, districtRows, gravityRows, statusRows] = await Promise.all([
    getAllRows("Accused"),
    getAllRows("CaseMaster"),
    getAllRows("Unit"),
    getAllRows("District"),
    getAllRows("GravityOffence"),
    getAllRows("CaseStatusMaster"),
  ]);

  // Build lookup maps.
  const unitById = new Map<string, { name: string; districtId: string }>();
  for (const r of unitRows) {
    const u = unwrap(r, "Unit");
    if (s(u.UnitID)) unitById.set(s(u.UnitID), { name: s(u.UnitName), districtId: s(u.DistrictID) });
  }
  const districtById = new Map<string, string>();
  for (const r of districtRows) {
    const d = unwrap(r, "District");
    if (s(d.DistrictID)) districtById.set(s(d.DistrictID), s(d.DistrictName));
  }
  const gravityById = new Map<string, string>();
  for (const r of gravityRows) {
    const g = unwrap(r, "GravityOffence");
    if (s(g.GravityOffenceID)) gravityById.set(s(g.GravityOffenceID), s(g.LookupValue));
  }
  const statusById = new Map<string, string>();
  for (const r of statusRows) {
    const st = unwrap(r, "CaseStatusMaster");
    if (s(st.CaseStatusID)) statusById.set(s(st.CaseStatusID), s(st.CaseStatusName));
  }
  const caseById = new Map<string, any>();
  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    if (s(c.CaseMasterID)) caseById.set(s(c.CaseMasterID), c);
  }

  // Group accused rows by normalised name.
  interface AccEntry {
    name: string;
    gender: string;
    age: string;
    caseIds: Set<string>;
    rowData: any[];
  }
  const byName = new Map<string, AccEntry>();

  for (const r of accusedRows) {
    const a = unwrap(r, "Accused");
    const key = normName(a.AccusedName);
    if (!key) continue;
    if (!byName.has(key)) {
      byName.set(key, {
        name: s(a.AccusedName),
        gender: genderLabel(s(a.GenderID)),
        age: s(a.AgeYear) || "",
        caseIds: new Set(),
        rowData: [],
      });
    }
    const entry = byName.get(key)!;
    const cid = s(a.CaseMasterID);
    if (cid) entry.caseIds.add(cid);
    entry.rowData.push(a);
    // Use the most recently seen gender/age.
    if (!entry.age && s(a.AgeYear)) entry.age = s(a.AgeYear);
    if (entry.gender === "Unknown" && s(a.GenderID)) entry.gender = genderLabel(s(a.GenderID));
  }

  const result: RepeatAccused[] = [];

  for (const [key, entry] of byName) {
    if (entry.caseIds.size < threshold) continue;

    const cases = [...entry.caseIds].map((cid) => {
      const c = caseById.get(cid);
      if (!c) return null;
      const gravityId = s(c.GravityOffenceID);
      const statusId  = Number(c.CaseStatusID) || 1;
      const unit      = unitById.get(s(c.PoliceStationID));
      const district  = unit ? (districtById.get(unit.districtId) || unit.districtId) : "";
      return {
        caseMasterId: cid,
        crimeNo: s(c.CrimeNo) || s(c.CaseNo) || cid,
        gravity: gravityById.get(gravityId) || "Unknown",
        isHeinous: GRAVITY_HEINOUS.has(Number(gravityId)),
        statusId,
        statusLabel: statusById.get(s(c.CaseStatusID)) || "Unknown",
        registeredDate: s(c.CrimeRegisteredDate) || "",
        district,
        station: unit?.name || "",
      };
    }).filter(Boolean) as RepeatAccused["cases"];

    const heinousCount = cases.filter((c) => c.isHeinous).length;
    const activeCount  = cases.filter((c) => c.statusId !== STATUS_CLOSED && c.statusId !== STATUS_CHARGE_SHEETED).length;

    result.push({
      name: entry.name,
      normalisedKey: key,
      caseCount: cases.length,
      heinousCount,
      activeCount,
      gender: entry.gender,
      age: entry.age,
      cases: cases.sort((a, b) => (b.isHeinous ? 1 : 0) - (a.isHeinous ? 1 : 0)),
    });
  }

  // Sort: highest case count first; at equal count, most heinous first.
  result.sort((a, b) => {
    if (b.caseCount !== a.caseCount) return b.caseCount - a.caseCount;
    return b.heinousCount - a.heinousCount;
  });

  return NextResponse.json({ configured: true, accused: result, threshold });
}
