import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { GRAVITY_HEINOUS, STATUS_CHARGE_SHEETED, STATUS_CLOSED, STATUS_UNDER_INVESTIGATION } from "@/lib/threatIndex";

/**
 * GET /api/case/deadlines
 *
 * Computes charge-sheet filing deadlines for every open case under
 * CrPC Section 167(2):
 *
 *   60 days  — offences punishable by death or life imprisonment (Heinous gravity)
 *   90 days  — all other offences
 *
 * The deadline runs from CrimeRegisteredDate (the FIR date), which is the
 * standard police reference. If no FIR date is recorded the case is excluded
 * rather than shown with an invented deadline.
 *
 * Status mapping:
 *   OVERDUE    — past deadline, still Under Investigation → case may be dismissed
 *   CRITICAL   — 1–7 days remaining
 *   WARNING    — 8–14 days remaining
 *   ON_TRACK   — >14 days remaining
 *   FILED      — CaseStatusID = 2 (Charge Sheeted) — deadline met
 *   CLOSED     — CaseStatusID = 3 — no action needed
 *
 * Summary counts are returned alongside the per-case array so the UI can
 * render headline cards without iterating client-side.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const n = (v: any): number | null => {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** Days between two dates. Positive = future, negative = overdue. */
function daysFromNow(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  return Math.ceil((d.getTime() - now) / 86_400_000);
}

/** Parse a date string from Catalyst (YYYY-MM-DD, epoch ms, or ISO). */
function parseDate(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw || raw === "null") return null;
  const d = new Date(isNaN(Number(raw)) ? raw : Number(raw));
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type DeadlineStatus = "OVERDUE" | "CRITICAL" | "WARNING" | "ON_TRACK" | "FILED" | "CLOSED";

export interface CaseDeadline {
  caseMasterId: number;
  crimeNo: string;
  registeredDate: string;
  deadlineDate: string;
  deadlineDays: number;          // 60 or 90
  daysRemaining: number | null;  // null when status is FILED or CLOSED
  status: DeadlineStatus;
  isHeinous: boolean;
  caseStatusId: number;
  districtName: string;
  stationName: string;
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  critical: number;
  warning: number;
  onTrack: number;
  filed: number;
  closed: number;
  noDate: number;
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ configured: false, deadlines: [], summary: null });
  }

  const [caseRows, unitRows, districtRows] = await Promise.all([
    getAllRows("CaseMaster"),
    getAllRows("Unit"),
    getAllRows("District"),
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

  const deadlines: CaseDeadline[] = [];
  const summary: DeadlineSummary = { total: 0, overdue: 0, critical: 0, warning: 0, onTrack: 0, filed: 0, closed: 0, noDate: 0 };

  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    const caseId = n(c.CaseMasterID);
    if (!caseId) continue;

    const registeredDate = parseDate(c.CrimeRegisteredDate);
    if (!registeredDate) { summary.noDate++; continue; }

    const caseStatusId = n(c.CaseStatusID) ?? STATUS_UNDER_INVESTIGATION;
    const gravityId = n(c.GravityOffenceID);
    const isHeinous = GRAVITY_HEINOUS.has(gravityId ?? 0);
    const deadlineDays = isHeinous ? 60 : 90;
    const deadlineDate = addDays(registeredDate, deadlineDays);
    const daysRem = daysFromNow(deadlineDate.toISOString());

    const unit = unitById.get(s(c.PoliceStationID));
    const stationName = unit?.name || s(c.PoliceStationID) || "Unknown";
    const districtName = unit ? (districtById.get(unit.districtId) || unit.districtId || "Unknown") : "Unknown";

    let status: DeadlineStatus;
    if (caseStatusId === STATUS_CLOSED) {
      status = "CLOSED";
    } else if (caseStatusId === STATUS_CHARGE_SHEETED) {
      status = "FILED";
    } else {
      // Under investigation — deadline is live.
      if (daysRem === null || daysRem < 0) status = "OVERDUE";
      else if (daysRem <= 7)              status = "CRITICAL";
      else if (daysRem <= 14)             status = "WARNING";
      else                                status = "ON_TRACK";
    }

    const crimeNo = s(c.CrimeNo) || s(c.CaseNo) || String(caseId);

    deadlines.push({
      caseMasterId: caseId,
      crimeNo,
      registeredDate: registeredDate.toISOString(),
      deadlineDate: deadlineDate.toISOString(),
      deadlineDays,
      daysRemaining: status === "FILED" || status === "CLOSED" ? null : (daysRem ?? null),
      status,
      isHeinous,
      caseStatusId,
      districtName,
      stationName,
    });

    summary.total++;
    if (status === "OVERDUE")  summary.overdue++;
    if (status === "CRITICAL") summary.critical++;
    if (status === "WARNING")  summary.warning++;
    if (status === "ON_TRACK") summary.onTrack++;
    if (status === "FILED")    summary.filed++;
    if (status === "CLOSED")   summary.closed++;
  }

  // Sort: OVERDUE → CRITICAL → WARNING → ON_TRACK → FILED → CLOSED.
  const ORDER: Record<DeadlineStatus, number> = {
    OVERDUE: 0, CRITICAL: 1, WARNING: 2, ON_TRACK: 3, FILED: 4, CLOSED: 5,
  };
  deadlines.sort((a, b) => {
    const diff = ORDER[a.status] - ORDER[b.status];
    if (diff !== 0) return diff;
    // Within same status, most urgent first (smallest daysRemaining or most overdue).
    const ar = a.daysRemaining ?? 9999;
    const br = b.daysRemaining ?? 9999;
    return ar - br;
  });

  return NextResponse.json({ configured: true, deadlines, summary, noDate: summary.noDate });
}
