import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/arrest          — list arrest records
 * POST /api/arrest          — create a new arrest record
 *
 * Catalyst table: ArrestRecord (actual column names)
 *   ArrestID             BIGINT
 *   ArrestNo             VARCHAR
 *   PersonName           VARCHAR
 *   PersonDOB            VARCHAR
 *   PersonAddress        VARCHAR
 *   PersonContact        VARCHAR
 *   FIRNo                VARCHAR
 *   Sections             VARCHAR
 *   ArrestDate           VARCHAR   — YYYY-MM-DD
 *   ArrestLocation       VARCHAR
 *   ArrestingOfficerID   BIGINT
 *   ArrestingOfficerName VARCHAR
 *   NextHearingDate      VARCHAR
 *   StationID            BIGINT
 *   CourtName            VARCHAR
 *   Status               VARCHAR   — IN_CUSTODY | BAILED | REMANDED | RELEASED
 *   MedicalExamination   VARCHAR   — YES / NO
 *   GroundsOfArrest      VARCHAR
 *   StationName          VARCHAR
 *   Remarks              VARCHAR
 */

const TABLE = "ArrestRecord";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};

function mapRow(raw: any) {
  const r = unwrap(raw);
  return {
    id:                   Number(r.ArrestID ?? r.ROWID ?? 0),
    rowId:                String(r.ROWID ?? ""),
    arrestNo:             String(r.ArrestNo ?? ""),
    accusedName:          String(r.PersonName ?? ""),
    age:                  String(r.PersonDOB ?? ""),
    gender:               "",
    fatherName:           "",
    address:              String(r.PersonAddress ?? ""),
    contact:              String(r.PersonContact ?? ""),
    linkedCrimeNo:        String(r.FIRNo ?? ""),
    sectionsInvoked:      String(r.Sections ?? ""),
    arrestDate:           String(r.ArrestDate ?? ""),
    arrestTime:           "",
    arrestLocation:       String(r.ArrestLocation ?? ""),
    groundsOfArrest:      String(r.GroundsOfArrest ?? ""),
    medicalExamDone:      String(r.MedicalExamination ?? "NO"),
    medicalOfficer:       "",
    custodyLocation:      "",
    courtName:            String(r.CourtName ?? ""),
    nextHearingDate:      String(r.NextHearingDate ?? ""),
    stationName:          String(r.StationName ?? ""),
    remarks:              String(r.Remarks ?? ""),
    arrestingOfficerName: String(r.ArrestingOfficerName ?? ""),
    status:               String(r.Status ?? "IN_CUSTODY"),
    createdAt:            String(r.CreatedAt ?? ""),
  };
}

export type ArrestRecord = ReturnType<typeof mapRow>;

export async function GET(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, records: [] });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await getAllRows(TABLE);
    const records = rows.map(mapRow).sort((a, b) => b.id - a.id);
    return NextResponse.json({ configured: true, tableReady: true, records });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("does not exist") || msg.includes("INVALID_TABLE") || msg.includes("table_not_found")) {
      return NextResponse.json({ configured: true, tableReady: false, records: [] });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  const body = await req.json();
  const { accusedName, age, address, contact, linkedCrimeNo, sectionsInvoked,
          arrestDate, arrestLocation, groundsOfArrest, medicalExamDone,
          courtName, nextHearingDate, stationName, remarks } = body;

  if (!accusedName?.trim()) return NextResponse.json({ error: "Accused name is required." }, { status: 400 });
  if (!linkedCrimeNo?.trim()) return NextResponse.json({ error: "Linked crime number is required." }, { status: 400 });

  const id       = await nextId(TABLE, "ArrestID");
  const year     = new Date().getFullYear();
  const arrestNo = `AR-${year}-${String(id).padStart(5, "0")}`;
  const now      = new Date().toISOString().replace("T", " ").substring(0, 19);

  const row = {
    ArrestID:             id,
    ArrestNo:             arrestNo,
    PersonName:           accusedName.trim(),
    PersonDOB:            age?.trim() || "",
    PersonAddress:        address?.trim() || "",
    PersonContact:        contact?.trim() || "",
    FIRNo:                linkedCrimeNo.trim(),
    Sections:             sectionsInvoked?.trim() || "",
    ArrestDate:           arrestDate || now.substring(0, 10),
    ArrestLocation:       arrestLocation?.trim() || "",
    GroundsOfArrest:      groundsOfArrest?.trim() || "",
    MedicalExamination:   medicalExamDone || "NO",
    CourtName:            courtName?.trim() || "",
    NextHearingDate:      nextHearingDate?.trim() || "",
    StationName:          stationName || officer.station || "",
    Remarks:              remarks?.trim() || "",
    ArrestingOfficerID:   0,
    ArrestingOfficerName: officer.name || "",
    Status:               "IN_CUSTODY",
    CreatedAt:            now,
    UpdatedAt:            now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ ok: true, arrestNo, id });
}

export async function PATCH(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  const body = await req.json();
  const { rowId, status } = body;
  if (!rowId || !status) return NextResponse.json({ error: "rowId and status are required." }, { status: 400 });

  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  await updateRows(TABLE, [{ ROWID: rowId, Status: status, UpdatedAt: now }]);
  return NextResponse.json({ ok: true });
}
