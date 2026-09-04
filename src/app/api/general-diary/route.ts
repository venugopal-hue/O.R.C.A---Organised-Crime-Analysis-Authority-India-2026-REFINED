import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/general-diary          — list entries (optional ?stationId=&category=&date=)
 * POST /api/general-diary          — create a new GD entry
 *
 * Catalyst table: GeneralDiary
 *   GDID              BIGINT
 *   EntryNo           VARCHAR(50)   — GD-YYYY-NNNN
 *   StationID         BIGINT
 *   StationName       VARCHAR(255)
 *   Category          VARCHAR(50)   — COMPLAINT | INCIDENT | PATROL | VISITOR | INFORMATION | OTHER
 *   Description       VARCHAR(255)
 *   ReportedBy        VARCHAR(255)  — name of person who walked in (optional)
 *   ReportedByContact VARCHAR(100)
 *   OfficerID         BIGINT
 *   LinkedCrimeNo     VARCHAR(100)
 *   Status            VARCHAR(20)   — OPEN | CLOSED | CONVERTED_TO_FIR
 *   EntryDate         VARCHAR(20)   — YYYY-MM-DD
 *   CreatedAt         DATETIME
 *   UpdatedAt         DATETIME
 */

const TABLE = "GeneralDiary";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};

function mapRow(raw: any) {
  const r = unwrap(raw);
  return {
    id:                 Number(r.GDID ?? r.ROWID ?? 0),
    entryNo:            String(r.EntryNo ?? ""),
    stationId:          Number(r.StationID ?? 0),
    stationName:        String(r.StationName ?? ""),
    category:           String(r.Category ?? "OTHER"),
    description:        String(r.Description ?? ""),
    reportedBy:         String(r.ReportedBy ?? ""),
    reportedByContact:  String(r.ReportedByContact ?? ""),
    officerId:          Number(r.OfficerID ?? 0),
    linkedCrimeNo:      String(r.LinkedCrimeNo ?? ""),
    status:             String(r.Status ?? "OPEN"),
    entryDate:          String(r.EntryDate ?? ""),
    createdAt:          String(r.CreatedAt ?? ""),
  };
}

export async function GET(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, entries: [] });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category  = searchParams.get("category") || "";
  const dateParam = searchParams.get("date") || "";

  try {
    const rows = await getAllRows(TABLE);
    let entries = rows.map(mapRow);

    if (category && category !== "ALL") entries = entries.filter((e) => e.category === category);
    if (dateParam) entries = entries.filter((e) => e.entryDate === dateParam);

    entries.sort((a, b) => b.id - a.id);
    return NextResponse.json({ configured: true, tableReady: true, entries });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("does not exist") || msg.includes("INVALID_TABLE") || msg.includes("table_not_found")) {
      return NextResponse.json({ configured: true, tableReady: false, entries: [] });
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
  const { category, description, reportedBy, reportedByContact, linkedCrimeNo, entryDate, stationName } = body;

  if (!description?.trim()) return NextResponse.json({ error: "Description is required." }, { status: 400 });

  const id     = await nextId(TABLE, "GDID");
  const year   = new Date().getFullYear();
  const entryNo = `GD-${year}-${String(id).padStart(5, "0")}`;
  const now    = new Date().toISOString().replace("T", " ").substring(0, 19);
  const today  = entryDate || new Date().toISOString().substring(0, 10);

  const row = {
    GDID:              id,
    EntryNo:           entryNo,
    StationID:         0,
    StationName:       stationName || officer.station || "",
    Category:          category || "OTHER",
    Description:       description.trim(),
    ReportedBy:        reportedBy?.trim() || "",
    ReportedByContact: reportedByContact?.trim() || "",
    OfficerID:         officer.uid ?? 0,
    LinkedCrimeNo:     linkedCrimeNo?.trim() || "",
    Status:            "OPEN",
    EntryDate:         today,
    CreatedAt:         now,
    UpdatedAt:         now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ ok: true, entryNo });
}
