import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/watch-list    — list watch entries
 * POST /api/watch-list    — add a new subject to the watch list
 *
 * Catalyst table: WatchList (actual column names)
 *   WatchID             BIGINT
 *   WatchNo             VARCHAR
 *   PersonName          VARCHAR
 *   PersonDOB           VARCHAR
 *   PersonAddress       VARCHAR
 *   ThreatLevel         VARCHAR   — HIGH | MEDIUM | LOW
 *   Category            VARCHAR
 *   LinkedCases         VARCHAR
 *   Reason              VARCHAR
 *   AssignedOfficerID   BIGINT
 *   AssignedOfficerName VARCHAR
 *   StationID           BIGINT
 *   StationName         VARCHAR
 *   Status              VARCHAR   — ACTIVE | CLOSED | ESCALATED
 *   LastVerified        VARCHAR
 */

const TABLE = "WatchList";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};

function mapRow(raw: any) {
  const r = unwrap(raw);
  return {
    id:                   Number(r.WatchID ?? r.ROWID ?? 0),
    rowId:                String(r.ROWID ?? ""),
    watchNo:              String(r.WatchNo ?? ""),
    personName:           String(r.PersonName ?? ""),
    age:                  String(r.PersonDOB ?? ""),
    gender:               "",
    address:              String(r.PersonAddress ?? ""),
    threatLevel:          String(r.ThreatLevel ?? "MEDIUM"),
    category:             String(r.Category ?? ""),
    reason:               String(r.Reason ?? ""),
    linkedCrimeNo:        String(r.LinkedCases ?? ""),
    assignedOfficerName:  String(r.AssignedOfficerName ?? ""),
    stationName:          String(r.StationName ?? ""),
    startDate:            String(r.LastVerified ?? ""),
    reviewDate:           "",
    lastVerified:         String(r.LastVerified ?? ""),
    status:               String(r.Status ?? "ACTIVE"),
    createdAt:            String(r.CreatedAt ?? ""),
  };
}

export type WatchEntry = ReturnType<typeof mapRow>;

export async function GET(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, entries: [] });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await getAllRows(TABLE);
    const entries = rows.map(mapRow).sort((a, b) => {
      const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.threatLevel] ?? 3) - (order[b.threatLevel] ?? 3);
    });
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
  const { personName, age, gender, address, threatLevel, category, reason, linkedCrimeNo, stationName, startDate, reviewDate } = body;

  if (!personName?.trim()) return NextResponse.json({ error: "Person name is required." }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: "Reason for watch is required." }, { status: 400 });

  const id      = await nextId(TABLE, "WatchID");
  const year    = new Date().getFullYear();
  const watchNo = `WL-${year}-${String(id).padStart(5, "0")}`;
  const now     = new Date().toISOString().replace("T", " ").substring(0, 19);

  const row = {
    WatchID:             id,
    WatchNo:             watchNo,
    PersonName:          personName.trim(),
    PersonDOB:           age?.trim() || "",
    PersonAddress:       address?.trim() || "",
    ThreatLevel:         threatLevel || "MEDIUM",
    Category:            category?.trim() || "",
    Reason:              reason.trim(),
    LinkedCases:         linkedCrimeNo?.trim() || "",
    AssignedOfficerID:   0,
    AssignedOfficerName: officer.name || "",
    StationID:           0,
    StationName:         stationName || officer.station || "",
    Status:              "ACTIVE",
    LastVerified:        now.substring(0, 10),
    CreatedAt:           now,
    UpdatedAt:           now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ ok: true, watchNo, id });
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

  await updateRows(TABLE, [{ ROWID: rowId, Status: status }]);
  return NextResponse.json({ ok: true });
}
