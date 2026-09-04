import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { STATUS_CLOSED, STATUS_CHARGE_SHEETED } from "@/lib/threatIndex";

/**
 * GET /api/analytics/stations
 *
 * Per-station performance metrics computed from CaseMaster:
 *   total        — all registered cases
 *   closed       — CaseStatusID = 3
 *   chargesheeted — CaseStatusID = 2
 *   active       — still under investigation
 *   closureRate  — closed / total (%)
 *   csRate       — chargesheeted / total (%)
 *   avgDaysOpen  — mean days from CrimeRegisteredDate to today for ACTIVE cases
 *   oldestActive — days since the oldest still-open case was registered
 *
 * Sorted by total cases descending.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();

function parseDate(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  if (!raw || raw === "null") return null;
  const d = new Date(isNaN(Number(raw)) ? raw : Number(raw));
  return isNaN(d.getTime()) ? null : d;
}

const daysBetween = (a: Date, b: Date) =>
  Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);

export interface StationMetrics {
  stationId: string;
  stationName: string;
  districtId: string;
  districtName: string;
  total: number;
  closed: number;
  chargesheeted: number;
  active: number;
  closureRate: number;   // 0–100
  csRate: number;        // 0–100
  avgDaysOpen: number | null;
  oldestActiveDays: number | null;
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) {
    return NextResponse.json({ configured: false, stations: [] });
  }

  const [caseRows, unitRows, districtRows] = await Promise.all([
    getAllRows("CaseMaster"),
    getAllRows("Unit"),
    getAllRows("District"),
  ]);

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

  // Accumulate per station.
  interface Acc {
    stationId: string;
    total: number;
    closed: number;
    chargesheeted: number;
    activeDaysOpen: number[];
  }
  const acc = new Map<string, Acc>();
  const now = new Date();

  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    const stId = s(c.PoliceStationID);
    if (!stId) continue;

    if (!acc.has(stId)) acc.set(stId, { stationId: stId, total: 0, closed: 0, chargesheeted: 0, activeDaysOpen: [] });
    const a = acc.get(stId)!;
    a.total++;

    const statusId = Number(c.CaseStatusID);
    if (statusId === STATUS_CLOSED)         a.closed++;
    else if (statusId === STATUS_CHARGE_SHEETED) a.chargesheeted++;
    else {
      const reg = parseDate(c.CrimeRegisteredDate);
      if (reg) a.activeDaysOpen.push(daysBetween(reg, now));
    }
  }

  const stations: StationMetrics[] = [];

  for (const [stId, a] of acc) {
    const unit      = unitById.get(stId);
    const distId    = unit?.districtId || "";
    const avgDays   = a.activeDaysOpen.length
      ? Math.round(a.activeDaysOpen.reduce((s, v) => s + v, 0) / a.activeDaysOpen.length)
      : null;
    const oldestDays = a.activeDaysOpen.length ? Math.max(...a.activeDaysOpen) : null;

    stations.push({
      stationId: stId,
      stationName: unit?.name || stId,
      districtId: distId,
      districtName: districtById.get(distId) || distId || "Unknown",
      total: a.total,
      closed: a.closed,
      chargesheeted: a.chargesheeted,
      active: a.total - a.closed - a.chargesheeted,
      closureRate: a.total ? Math.round((a.closed / a.total) * 100) : 0,
      csRate:      a.total ? Math.round((a.chargesheeted / a.total) * 100) : 0,
      avgDaysOpen: avgDays,
      oldestActiveDays: oldestDays,
    });
  }

  stations.sort((a, b) => b.total - a.total);

  // Summary across all stations.
  const summary = {
    totalStations: stations.length,
    totalCases:    stations.reduce((s, st) => s + st.total, 0),
    totalClosed:   stations.reduce((s, st) => s + st.closed, 0),
    totalCS:       stations.reduce((s, st) => s + st.chargesheeted, 0),
    totalActive:   stations.reduce((s, st) => s + st.active, 0),
  };

  return NextResponse.json({ configured: true, stations, summary });
}
