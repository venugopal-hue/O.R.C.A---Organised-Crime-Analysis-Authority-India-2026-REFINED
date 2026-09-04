import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, isCatalystConfigured } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Reference-data loader for the Case Registration masters.
 *
 * GET  /api/fir/reference          — which tables are loadable, their columns, current row counts
 * POST /api/fir/reference          — { table, rows: [...] } bulk insert
 *
 * Restricted to administrators: reference data defines the legal and
 * geographic vocabulary every FIR is filed against, so it is not something a
 * field officer should be able to rewrite.
 */

// table -> [required id column, ...other columns]
const REFERENCE_TABLES: Record<string, { id: string; columns: string[]; numeric: string[] }> = {
  District: { id: "DistrictID", columns: ["DistrictID", "DistrictName", "StateID", "Active"], numeric: ["DistrictID", "StateID"] },
  State: { id: "StateID", columns: ["StateID", "StateName", "NationalityID", "Active"], numeric: ["StateID", "NationalityID"] },
  Unit: { id: "UnitID", columns: ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"], numeric: ["UnitID", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID"] },
  UnitType: { id: "UnitTypeID", columns: ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"], numeric: ["UnitTypeID", "Hierarchy"] },
  Court: { id: "CourtID", columns: ["CourtID", "CourtName", "DistrictID", "StateID", "Active"], numeric: ["CourtID", "DistrictID", "StateID"] },
  Act: { id: "ActCode", columns: ["ActCode", "ActDescription", "ShortName", "Active"], numeric: [] },
  Section: { id: "SectionCode", columns: ["ActCode", "SectionCode", "SectionDescription", "Active"], numeric: [] },
  CrimeHead: { id: "CrimeHeadID", columns: ["CrimeHeadID", "CrimeGroupName", "Active"], numeric: ["CrimeHeadID"] },
  CrimeSubHead: { id: "CrimeSubHeadID", columns: ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"], numeric: ["CrimeSubHeadID", "CrimeHeadID", "SeqID"] },
  Employee: { id: "EmployeeID", columns: ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "KGID", "FirstName", "EmployeeDOB", "GenderID", "BloodGroupID", "PhysicallyChallenged", "AppointmentDate"], numeric: ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "GenderID", "BloodGroupID"] },
  OccupationMaster: { id: "OccupationID", columns: ["OccupationID", "OccupationName"], numeric: ["OccupationID"] },
  ReligionMaster: { id: "ReligionID", columns: ["ReligionID", "ReligionName"], numeric: ["ReligionID"] },
  CasteMaster: { id: "caste_master_id", columns: ["caste_master_id", "caste_master_name"], numeric: ["caste_master_id"] },
  // Operational tables — listed for status monitoring; CSV import not applicable
  ArrestRecord:  { id: "ArrestID",         columns: ["ArrestID"],         numeric: ["ArrestID"] },
  BailRemand:    { id: "BRID",             columns: ["BRID"],             numeric: ["BRID"] },
  GeneralDiary:  { id: "GDID",            columns: ["GDID"],             numeric: ["GDID"] },
  MissingPerson: { id: "MissingPersonID", columns: ["MissingPersonID"],  numeric: ["MissingPersonID"] },
  WantedPerson:  { id: "WantedID",        columns: ["WantedID"],         numeric: ["WantedID"] },
  WatchList:     { id: "WatchID",         columns: ["WatchID"],          numeric: ["WatchID"] },
};

function isAdmin(role: string): boolean {
  return ["orca_owner", "orca_engineer", "orca_support", "admin_full", "command_admin_l1", "command_admin_l2", "scrb_officer", "admin_scrb", "admin_verification", "it_admin"].includes(role);
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "ACCESS DENIED: Officer authentication required." }, { status: 403 });
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, configured: false, tables: [] });
  }

  const tables = await Promise.all(
    Object.entries(REFERENCE_TABLES).map(async ([name, def]) => {
      try {
        const rows = await getAllRows(name);
        return { name, idColumn: def.id, columns: def.columns, count: rows.length };
      } catch (e: any) {
        return { name, idColumn: def.id, columns: def.columns, count: -1, error: e.message };
      }
    })
  );

  return NextResponse.json({ success: true, configured: true, canEdit: isAdmin(officer.dashboardRole), tables });
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "ACCESS DENIED: Officer authentication required." }, { status: 403 });
  }
  const denied = denyWrite(officer, "config");
  if (denied) return denied;

  if (!isAdmin(officer.dashboardRole)) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Only administrators may load reference data." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, error: "Catalyst is not connected." }, { status: 503 });
  }

  try {
    const { table, rows } = await req.json();
    const def = REFERENCE_TABLES[table];
    if (!def) {
      return NextResponse.json(
        { success: false, error: `"${table}" is not a loadable reference table.` },
        { status: 400 }
      );
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: "No rows supplied." }, { status: 400 });
    }

    // Reject unknown columns rather than silently dropping them — a typo in a
    // header should be visible, not quietly discarded.
    const unknown = new Set<string>();
    rows.forEach((r: any) => Object.keys(r).forEach((k) => { if (!def.columns.includes(k)) unknown.add(k); }));
    if (unknown.size) {
      return NextResponse.json(
        { success: false, error: `Unknown column(s) for ${table}: ${[...unknown].join(", ")}. Valid: ${def.columns.join(", ")}` },
        { status: 400 }
      );
    }

    const missingId = rows.filter((r: any) => r[def.id] === undefined || r[def.id] === "").length;
    if (missingId) {
      return NextResponse.json(
        { success: false, error: `${missingId} row(s) are missing the required "${def.id}" value.` },
        { status: 400 }
      );
    }

    // Skip IDs already present so a re-import tops up rather than duplicating.
    const existing = new Set((await getAllRows(table)).map((r: any) => String(r[def.id])));
    const fresh = rows.filter((r: any) => !existing.has(String(r[def.id])));
    const skipped = rows.length - fresh.length;

    const coerced = fresh.map((r: any) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v === "" || v === null || v === undefined) continue;
        if (def.numeric.includes(k)) {
          const n = Number(v);
          if (Number.isFinite(n)) out[k] = n;
        } else if (k === "Active" || k === "PhysicallyChallenged") {
          out[k] = ["1", "true", "yes", "y", "TRUE"].includes(String(v).toLowerCase()) || v === true;
        } else {
          out[k] = String(v);
        }
      }
      return out;
    });

    if (coerced.length) await insertRows(table, coerced);
    const total = (await getAllRows(table)).length;

    return NextResponse.json({
      success: true,
      table,
      inserted: coerced.length,
      skippedExisting: skipped,
      totalRows: total,
      message: `${table}: inserted ${coerced.length}, skipped ${skipped} already present. Table now holds ${total} rows.`,
    });
  } catch (error: any) {
    console.error("[Reference Import Error]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
