import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/wanted-persons    — list wanted/absconder records
 * POST /api/wanted-persons    — add a new wanted person
 *
 * Catalyst table: WantedPerson (actual column names)
 *   WantedID          BIGINT
 *   WantedNo          VARCHAR
 *   PersonName        VARCHAR
 *   PersonDOB         VARCHAR
 *   PersonDescription VARCHAR
 *   LastKnownAddress  VARCHAR
 *   Offences          VARCHAR
 *   FIRNos            VARCHAR
 *   ThreatLevel       VARCHAR   — HIGH | MEDIUM | LOW
 *   RewardAmount      VARCHAR
 *   IssuedByStation   VARCHAR
 *   IssuedByOfficer   VARCHAR
 *   IssuedDate        VARCHAR
 *   Status            VARCHAR   — WANTED | APPREHENDED | CANCELLED
 */

const TABLE = "WantedPerson";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};

function mapRow(raw: any) {
  const r = unwrap(raw);
  return {
    id:               Number(r.WantedID ?? r.ROWID ?? 0),
    rowId:            String(r.ROWID ?? ""),
    wantedNo:         String(r.WantedNo ?? ""),
    personName:       String(r.PersonName ?? ""),
    age:              String(r.PersonDOB ?? ""),
    gender:           "",
    personDescription: String(r.PersonDescription ?? ""),
    lastKnownAddress: String(r.LastKnownAddress ?? ""),
    offences:         String(r.Offences ?? ""),
    linkedCrimeNo:    String(r.FIRNos ?? ""),
    warrantNo:        "",
    courtName:        "",
    abscondedSince:   String(r.IssuedDate ?? ""),
    issuedByStation:  String(r.IssuedByStation ?? ""),
    issuedByOfficer:  String(r.IssuedByOfficer ?? ""),
    threatLevel:      String(r.ThreatLevel ?? "MEDIUM"),
    reward:           String(r.RewardAmount ?? ""),
    status:           String(r.Status ?? "WANTED"),
    createdAt:        String(r.CreatedAt ?? ""),
  };
}

export type WantedRecord = ReturnType<typeof mapRow>;

export async function GET(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, records: [] });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await getAllRows(TABLE);
    const records = rows.map(mapRow).sort((a, b) => {
      if (a.status === "WANTED" && b.status !== "WANTED") return -1;
      if (b.status === "WANTED" && a.status !== "WANTED") return 1;
      const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.threatLevel] ?? 3) - (order[b.threatLevel] ?? 3);
    });
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
  const { personName, personDob, personDescription, lastKnownAddress, linkedCrimeNo,
          offences, issuedDate, issuedByStation, threatLevel, reward } = body;

  if (!personName?.trim()) return NextResponse.json({ error: "Person name is required." }, { status: 400 });

  const id       = await nextId(TABLE, "WantedID");
  const year     = new Date().getFullYear();
  const wantedNo = `WP-${year}-${String(id).padStart(5, "0")}`;
  const now      = new Date().toISOString().replace("T", " ").substring(0, 19);

  const row = {
    WantedID:          id,
    WantedNo:          wantedNo,
    PersonName:        personName.trim(),
    PersonDOB:         personDob?.trim() || "",
    PersonDescription: personDescription?.trim() || "",
    LastKnownAddress:  lastKnownAddress?.trim() || "",
    Offences:          offences?.trim() || "",
    FIRNos:            linkedCrimeNo?.trim() || "",
    IssuedDate:        issuedDate || now.substring(0, 10),
    IssuedByStation:   issuedByStation?.trim() || officer.station || "",
    IssuedByOfficer:   officer.name || "",
    ThreatLevel:       threatLevel || "MEDIUM",
    RewardAmount:      reward?.trim() || "",
    Status:            "WANTED",
    CreatedAt:         now,
    UpdatedAt:         now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ ok: true, wantedNo, id });
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
