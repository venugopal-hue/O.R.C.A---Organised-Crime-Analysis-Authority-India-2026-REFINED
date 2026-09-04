import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/accused/profile?name=<accused name>
 *
 * Returns a unified profile for an accused person aggregated from:
 *   Accused + CaseMaster       — all FIRs they appear in
 *   ArrestRecord               — arrest history
 *   BailRemandOrders           — bail / remand status
 *   Accused (same cases)       — known associates
 *
 * Identity is by normalised name (lowercase, collapsed spaces) — the same
 * limitation as the relation graph. There is no person-level PK in the schema.
 */

const unwrap = (row: any, table: string) => (row?.[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ");

const genderLabel = (g: string) =>
  ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" } as Record<string, string>)[g] ?? g ?? "Unknown";

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) return NextResponse.json({ configured: false });

  const rawName = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!rawName) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const key = norm(rawName);

  const [accusedRows, caseRows, unitRows, districtRows, gravityRows, statusRows, arrestRows, bailRows] =
    await Promise.all([
      getAllRows("Accused"),
      getAllRows("CaseMaster"),
      getAllRows("Unit"),
      getAllRows("District"),
      getAllRows("GravityOffence"),
      getAllRows("CaseStatusMaster"),
      getAllRows("ArrestRecord").catch(() => []),
      getAllRows("BailRemand").catch(() => []),
    ]);

  // ── Lookup maps ───────────────────────────────────────────────────────────
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
    if (s(st.CaseStatusID)) statusById.set(s(st.CaseStatusID), s(st.StatusName ?? st.LookupValue));
  }
  const caseById = new Map<string, any>();
  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    if (s(c.CaseMasterID)) caseById.set(s(c.CaseMasterID), c);
  }

  // ── Find all Accused rows that match this name ────────────────────────────
  const matched = accusedRows
    .map(r => unwrap(r, "Accused"))
    .filter(a => norm(a.AccusedName) === key);

  if (!matched.length) return NextResponse.json({ found: false, name: rawName });

  // Use the most recent row for demographic defaults.
  const demo = matched[matched.length - 1];
  const caseMasterIds = [...new Set(matched.map(a => s(a.CaseMasterID)).filter(Boolean))];

  // ── Cases ─────────────────────────────────────────────────────────────────
  const cases = caseMasterIds.map(id => {
    const c = caseById.get(id);
    if (!c) return null;
    const unit = unitById.get(s(c.PoliceStationID));
    const distId = unit?.districtId ?? "";
    return {
      caseMasterId: id,
      crimeNo: s(c.CrimeNo || c.CaseNo),
      gravity: gravityById.get(s(c.GravityOffenceID)) ?? "Unknown",
      status: statusById.get(s(c.CaseStatusID)) ?? "Unknown",
      registeredDate: s(c.CrimeRegisteredDate || c.RegistrationDate),
      station: unit?.name ?? "Unknown",
      district: districtById.get(distId) ?? "Unknown",
      actSections: s(c.ActSections ?? ""),
    };
  }).filter(Boolean) as any[];

  // ── Arrests ───────────────────────────────────────────────────────────────
  const arrests = arrestRows
    .map(r => unwrap(r, "ArrestRecord"))
    .filter(a => norm(a.AccusedName) === key)
    .map(a => ({
      arrestNo: s(a.ArrestNo),
      linkedCrimeNo: s(a.LinkedCrimeNo),
      arrestDate: s(a.ArrestDate),
      arrestLocation: s(a.ArrestLocation),
      sectionsInvoked: s(a.SectionsInvoked),
      status: s(a.Status),
      groundsOfArrest: s(a.GroundsOfArrest),
      custodyLocation: s(a.CustodyLocation),
      fatherName: s(a.FatherName),
      address: s(a.Address),
    }));

  // ── Bail / Remand ─────────────────────────────────────────────────────────
  const bail = bailRows
    .map(r => unwrap(r, "BailRemand"))
    .filter(b => norm(b.PersonName) === key)
    .map(b => ({
      orderNo: s(b.BRNo),
      linkedCrimeNo: s(b.ArrestNo),
      orderType: s(b.OrderType),
      orderDate: s(b.OrderDate),
      courtName: s(b.CourtName),
      remarks: s(b.Conditions),
    }));

  // ── Known associates (other accused in same cases) ────────────────────────
  const associateMap = new Map<string, { name: string; caseCount: number; cases: string[] }>();
  for (const r of accusedRows) {
    const a = unwrap(r, "Accused");
    if (norm(a.AccusedName) === key) continue;
    if (!caseMasterIds.includes(s(a.CaseMasterID))) continue;
    const aKey = norm(a.AccusedName);
    if (!aKey) continue;
    const existing = associateMap.get(aKey);
    const crimeNo = caseById.get(s(a.CaseMasterID))?.CrimeNo ?? s(a.CaseMasterID);
    if (existing) {
      existing.caseCount++;
      if (!existing.cases.includes(crimeNo)) existing.cases.push(crimeNo);
    } else {
      associateMap.set(aKey, { name: s(a.AccusedName), caseCount: 1, cases: [crimeNo] });
    }
  }
  const associates = [...associateMap.values()].sort((a, b) => b.caseCount - a.caseCount);

  return NextResponse.json({
    found: true,
    name: s(demo.AccusedName),
    gender: genderLabel(s(demo.GenderID)),
    age: s(demo.AgeYear),
    fatherName: arrests[0]?.fatherName ?? "",
    address: arrests[0]?.address ?? "",
    totalCases: cases.length,
    activeCases: cases.filter(c => !["Closed", "Disposed", "Charge Sheeted"].includes(c.status)).length,
    cases,
    arrests,
    bail,
    associates,
  });
}
