import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { insertRows, deleteRow, getAllRows, isCatalystConfigured, invalidateTable } from "@/lib/catalyst";
function isAdmin(role: string): boolean {
  return ["admin_full", "command_admin", "scrb_officer", "admin_scrb", "admin_verification", "verification_admin", "it_admin", "orca_owner", "orca_engineer"].includes(role);
}

/**
 * POST /api/admin/seed/missing-tables
 *
 * Creates the 6 Catalyst tables that have no rows yet by inserting a sentinel
 * row then immediately deleting it. Catalyst creates a table on first insert;
 * the delete leaves it empty and ready. Already-populated tables are skipped.
 */

const SENTINELS: { table: string; idCol: string; row: Record<string, unknown> }[] = [
  {
    table: "ArrestRecord",
    idCol: "ArrestID",
    row: {
      ArrestID: 1, ArrestNo: "__INIT__", PersonName: "__INIT__", PersonDOB: "",
      PersonAddress: "", PersonContact: "", FIRNo: "__INIT__",
      Sections: "", ArrestDate: "2000-01-01", ArrestLocation: "",
      GroundsOfArrest: "", MedicalExamination: "NO",
      CourtName: "", NextHearingDate: "",
      ArrestingOfficerID: 0, ArrestingOfficerName: "__INIT__",
      StationID: 0, StationName: "__INIT__", Remarks: "",
      Status: "IN_CUSTODY", CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
  {
    table: "BailRemand",
    idCol: "BRID",
    row: {
      BRID: 1, BRNo: "__INIT__", ArrestID: 0, ArrestNo: "", PersonName: "__INIT__",
      OrderType: "REMAND", OrderDate: "2000-01-01", ExpiryDate: "",
      CourtName: "", JudgeName: "", BailAmount: "", Sureties: "", Conditions: "", Status: "ACTIVE",
      CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
  {
    table: "GeneralDiary",
    idCol: "GDID",
    row: {
      GDID: 1, EntryNo: "__INIT__", StationID: 0, StationName: "__INIT__",
      Category: "OTHER", Description: "__INIT__", ReportedBy: "", ReportedByContact: "",
      OfficerID: 0, LinkedCrimeNo: "", Status: "OPEN", EntryDate: "2000-01-01",
      CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
  {
    table: "MissingPerson",
    idCol: "MissingPersonID",
    row: {
      MissingPersonID: 1, FullName: "__INIT__", Age: "0", Gender: "Unknown",
      LastSeenDate: "2000-01-01", LastSeenLocation: "", Description: "",
      ReporterName: "", ReporterContact: "", LinkedCrimeNo: "", Status: "MISSING",
      ReportingOfficerID: 0,
      CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
  {
    table: "WantedPerson",
    idCol: "WantedID",
    row: {
      WantedID: 1, WantedNo: "__INIT__", PersonName: "__INIT__", PersonDOB: "",
      PersonDescription: "", LastKnownAddress: "", Offences: "", FIRNos: "",
      IssuedDate: "2000-01-01", IssuedByStation: "", IssuedByOfficer: "__INIT__",
      ThreatLevel: "LOW", RewardAmount: "", Status: "WANTED",
      CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
  {
    table: "WatchList",
    idCol: "WatchID",
    row: {
      WatchID: 1, WatchNo: "__INIT__", PersonName: "__INIT__", PersonDOB: "",
      PersonAddress: "", ThreatLevel: "LOW", Category: "", Reason: "__INIT__",
      LinkedCases: "", AssignedOfficerID: 0, AssignedOfficerName: "__INIT__",
      StationID: 0, StationName: "__INIT__", Status: "ACTIVE", LastVerified: "2000-01-01",
      CreatedAt: "2000-01-01 00:00:00", UpdatedAt: "2000-01-01 00:00:00",
    },
  },
];

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(officer.dashboardRole))
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (!isCatalystConfigured())
    return NextResponse.json({ error: "Catalyst not configured" }, { status: 503 });

  const results: { table: string; status: "created" | "existed" | "error"; detail?: string }[] = [];

  for (const { table, idCol, row } of SENTINELS) {
    try {
      // Check if table already exists and has rows
      const existing = await getAllRows(table).catch(() => null);
      if (existing !== null && existing.length > 0) {
        results.push({ table, status: "existed" });
        continue;
      }

      // Insert sentinel to create the table
      const inserted = await insertRows(table, [row]);
      // Delete the sentinel row using the ROWID Catalyst returns
      const rowId = inserted?.[0]?.[table]?.ROWID ?? inserted?.[0]?.ROWID;
      if (rowId) await deleteRow(table, rowId);
      invalidateTable(table);
      results.push({ table, status: "created" });
    } catch (err: any) {
      results.push({ table, status: "error", detail: String(err?.message ?? err) });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const existed = results.filter((r) => r.status === "existed").length;
  const errors  = results.filter((r) => r.status === "error");

  return NextResponse.json({
    success: errors.length === 0,
    created,
    existed,
    errors: errors.map((e) => `${e.table}: ${e.detail}`),
    results,
  });
}
