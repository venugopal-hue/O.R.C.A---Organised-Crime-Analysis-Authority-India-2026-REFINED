import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * GET  /api/missing-persons          — list all records
 * POST /api/missing-persons          — register a new missing person
 *
 * Requires a `MissingPerson` table in Catalyst with these columns:
 *   MissingPersonID   BIGINT  (auto-allocated)
 *   FullName          VARCHAR
 *   Age               VARCHAR
 *   Gender            VARCHAR  (Male / Female / Transgender / Unknown)
 *   LastSeenDate      VARCHAR  (YYYY-MM-DD)
 *   LastSeenLocation  VARCHAR
 *   Description       VARCHAR  (clothing, marks, etc.)
 *   ReporterName      VARCHAR
 *   ReporterContact   VARCHAR
 *   LinkedCrimeNo     VARCHAR  (optional — link to a registered FIR)
 *   Status            VARCHAR  (MISSING | FOUND | CLOSED)
 *   ReportingOfficerID BIGINT
 *   CreatedAt         DATETIME
 *   UpdatedAt         DATETIME
 *
 * If the table does not exist, every read returns tableReady:false and
 * the UI renders a setup message instead of crashing.
 */

const TABLE = "MissingPerson";
const unwrap = (row: any) => (row && row[TABLE]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) {
    return NextResponse.json({ configured: false, tableReady: false, records: [] });
  }

  try {
    const rows = await getAllRows(TABLE);
    const records = rows
      .map((r) => unwrap(r))
      .filter((r) => r.MissingPersonID)
      .map((r) => ({
        id:               Number(r.MissingPersonID),
        fullName:         s(r.FullName),
        age:              s(r.Age),
        gender:           s(r.Gender) || "Unknown",
        lastSeenDate:     s(r.LastSeenDate),
        lastSeenLocation: s(r.LastSeenLocation),
        description:      s(r.Description),
        reporterName:     s(r.ReporterName),
        reporterContact:  s(r.ReporterContact),
        linkedCrimeNo:    s(r.LinkedCrimeNo),
        status:           (s(r.Status) || "MISSING") as "MISSING" | "FOUND" | "CLOSED",
        reportingOfficerId: Number(r.ReportingOfficerID) || null,
        createdAt:        s(r.CreatedAt || r.CREATEDTIME),
        updatedAt:        s(r.UpdatedAt),
      }))
      .sort((a, b) => {
        // MISSING first, then FOUND, then CLOSED; within status newest first.
        const order = { MISSING: 0, FOUND: 1, CLOSED: 2 };
        const diff = order[a.status] - order[b.status];
        if (diff !== 0) return diff;
        return b.createdAt.localeCompare(a.createdAt);
      });

    return NextResponse.json({ configured: true, tableReady: true, records });
  } catch (err: any) {
    // Table does not exist yet — return tableReady:false so the UI can explain.
    if (err?.message?.toLowerCase().includes("table") || err?.status === 404) {
      return NextResponse.json({ configured: true, tableReady: false, records: [] });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json({ error: "Records store not connected." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const fullName = s(body.fullName);
  if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const id  = await nextId(TABLE, "MissingPersonID");

  const row = {
    MissingPersonID:   id,
    FullName:          fullName,
    Age:               s(body.age),
    Gender:            s(body.gender) || "Unknown",
    LastSeenDate:      s(body.lastSeenDate),
    LastSeenLocation:  s(body.lastSeenLocation),
    Description:       s(body.description),
    ReporterName:      s(body.reporterName),
    ReporterContact:   s(body.reporterContact),
    LinkedCrimeNo:     s(body.linkedCrimeNo),
    Status:            "MISSING",
    ReportingOfficerID: officer.employeeId || null,
    CreatedAt:         now,
    UpdatedAt:         now,
  };

  await insertRows(TABLE, [row]);
  return NextResponse.json({ success: true, id });
}

export async function PATCH(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;
  if (!isCatalystConfigured()) return NextResponse.json({ error: "Records store not connected." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { rowId, status } = body;
  if (!rowId || !status) return NextResponse.json({ error: "rowId and status are required." }, { status: 400 });

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await updateRows(TABLE, [{ ROWID: rowId, Status: status, UpdatedAt: now }]);
  return NextResponse.json({ success: true });
}
