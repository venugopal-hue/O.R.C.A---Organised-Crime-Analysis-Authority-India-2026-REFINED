import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/bail-remand    — list bail/remand orders
 * POST /api/bail-remand    — create a new order
 *
 * Catalyst table: BailRemand (actual column names)
 *   BRID      BIGINT
 *   BRNo      VARCHAR   — BR-YYYY-NNNNN
 *   ArrestID  BIGINT
 *   ArrestNo  VARCHAR
 *   PersonName VARCHAR
 *   OrderType  VARCHAR   — BAIL | REMAND | TRANSIT_REMAND | JUDICIAL_CUSTODY
 *   CourtName  VARCHAR
 *   JudgeName  VARCHAR
 *   OrderDate  VARCHAR
 *   ExpiryDate VARCHAR
 *   BailAmount VARCHAR
 *   Sureties   VARCHAR
 *   Conditions VARCHAR
 *   Status     VARCHAR   — ACTIVE | EXPIRED | REVOKED
 */

const TABLE = "BailRemand";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};

function mapRow(raw: any, crimeNoByArrestNo: Map<string, string> = new Map()) {
  const r = unwrap(raw);
  const arrestNo = String(r.ArrestNo ?? "");
  return {
    id:            Number(r.BRID ?? r.ROWID ?? 0),
    rowId:         String(r.ROWID ?? ""),
    orderNo:       String(r.BRNo ?? ""),
    linkedCrimeNo: crimeNoByArrestNo.get(arrestNo) || arrestNo,
    accusedName:   String(r.PersonName ?? ""),
    arrestNo,
    orderType:     String(r.OrderType ?? "REMAND"),
    orderDate:     String(r.OrderDate ?? ""),
    expiryDate:    String(r.ExpiryDate ?? ""),
    courtName:     String(r.CourtName ?? ""),
    judgeName:     String(r.JudgeName ?? ""),
    bailAmount:    String(r.BailAmount ?? ""),
    sureties:      String(r.Sureties ?? ""),
    conditions:    String(r.Conditions ?? ""),
    status:        String(r.Status ?? "ACTIVE"),
    createdAt:     String(r.CreatedAt ?? ""),
  };
}

export type BailRemandOrder = ReturnType<typeof mapRow>;

export async function GET(req: NextRequest) {
  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, orders: [] });
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [rows, arrestRows] = await Promise.all([
      getAllRows(TABLE),
      getAllRows("ArrestRecord").catch(() => []),
    ]);
    const crimeByArrestNo = new Map<string, string>();
    for (const r of arrestRows) {
      const a = r.ArrestRecord || r;
      if (a.ArrestNo && a.LinkedCrimeNo) crimeByArrestNo.set(String(a.ArrestNo), String(a.LinkedCrimeNo));
    }
    const orders = rows.map(r => mapRow(r, crimeByArrestNo)).sort((a, b) => b.id - a.id);
    return NextResponse.json({ configured: true, tableReady: true, orders });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("does not exist") || msg.includes("INVALID_TABLE") || msg.includes("table_not_found")) {
      return NextResponse.json({ configured: true, tableReady: false, orders: [] });
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
  const { accusedName, linkedCrimeNo, arrestNo, orderType, orderDate, expiryDate,
          courtName, judgeName, bailAmount, sureties, conditions } = body;

  if (!accusedName?.trim()) return NextResponse.json({ error: "Accused name is required." }, { status: 400 });

  const id      = await nextId(TABLE, "BRID");
  const year    = new Date().getFullYear();
  const brNo    = `BR-${year}-${String(id).padStart(5, "0")}`;
  const now     = new Date().toISOString().replace("T", " ").substring(0, 19);

  const row = {
    BRID:       id,
    BRNo:       brNo,
    PersonName: accusedName.trim(),
    ArrestNo:   arrestNo?.trim() || linkedCrimeNo?.trim() || "",
    OrderType:  orderType || "REMAND",
    OrderDate:  orderDate || now.substring(0, 10),
    ExpiryDate: expiryDate || "",
    CourtName:  courtName?.trim() || "",
    JudgeName:  judgeName?.trim() || "",
    BailAmount: bailAmount?.trim() || "",
    Sureties:   sureties?.trim() || "",
    Conditions: conditions?.trim() || "",
    Status:     "ACTIVE",
    CreatedAt:  now,
    UpdatedAt:  now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ ok: true, orderNo: brNo, id });
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
