import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { resolveScope, loadEmployees, loadUnits, assignableEmployees } from "@/lib/jurisdiction";
import { TASK_TYPES, PRIORITIES, SENSITIVITIES, EFFORTS } from "@/lib/tasks";

/**
 * Who this officer may assign work to, plus the lists the form needs.
 *
 * GET /api/tasks/assignable
 *
 * The assignee list is DERIVED from the organisation — the caller's unit, the
 * units beneath it, their district if posted at district level. It is never
 * the whole Employee table, and no officer name or station name is hardcoded
 * anywhere in this module.
 *
 * The same scope is enforced again when a task is created. This route exists
 * so the form can offer the right people; it is not what stops the wrong ones
 * being named.
 */

const unwrap = (r: any, t: string) => r?.[t] || r || {};

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  const constants = {
    taskTypes: TASK_TYPES,
    priorities: PRIORITIES,
    sensitivities: SENSITIVITIES,
    efforts: EFFORTS,
  };

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, officers: [], cases: [], ...constants });
  }

  try {
    const [employees, units, rankRows, caseRows] = await Promise.all([
      loadEmployees(),
      loadUnits(),
      getAllRows("Rank").catch(() => [] as any[]),
      getAllRows("CaseMaster").catch(() => [] as any[]),
    ]);

    const scope = await resolveScope(
      { employeeId: (officer as any).employeeId ?? null, kgid: (officer as any).badgeId ?? null, dashboardRole: officer.dashboardRole },
      { employees, units }
    );

    const rankName = new Map<number, string>();
    for (const r of rankRows) {
      const row = unwrap(r, "Rank");
      if (row.RankID != null) rankName.set(Number(row.RankID), String(row.RankName || ""));
    }
    const unitName = new Map<number, string>();
    for (const u of units) unitName.set(u.unitId, u.name);

    const officers = assignableEmployees(scope, employees)
      .map((e) => ({
        employeeId: e.employeeId,
        name: e.name || `Officer ${e.employeeId}`,
        kgid: e.kgid,
        rank: e.rankId !== null ? rankName.get(e.rankId) || "" : "",
        unitId: e.unitId,
        unitName: e.unitId !== null ? unitName.get(e.unitId) || "" : "",
        isSelf: e.employeeId === scope.employee?.employeeId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    /*
     * Cases the caller can attach a task to — limited to the same unit scope.
     * A case belongs to a station through `PoliceStationID`, so a task may only
     * be raised against a case in a station the officer actually covers.
     */
    const cases = caseRows
      .map((r) => unwrap(r, "CaseMaster"))
      .filter((c) => c.CaseMasterID != null)
      .filter((c) => {
        if (scope.statewide) return true;
        const station = c.PoliceStationID != null ? Number(c.PoliceStationID) : null;
        return station !== null && scope.unitIds.includes(station);
      })
      .map((c) => ({
        caseMasterId: Number(c.CaseMasterID),
        crimeNumber: String(c.CrimeNo || c.CrimeNumber || `Case ${c.CaseMasterID}`),
        registeredOn: String(c.CrimeRegisteredDate || ""),
        stationId: c.PoliceStationID != null ? Number(c.PoliceStationID) : null,
      }))
      .sort((a, b) => b.caseMasterId - a.caseMasterId);

    return NextResponse.json({
      success: true,
      configured: true,
      officers,
      cases,
      scope: {
        basis: scope.basis,
        statewide: scope.statewide,
        unitCount: scope.unitIds.length,
        employeeId: scope.employee?.employeeId ?? null,
        hasPersonnelRecord: scope.employee !== null,
      },
      ...constants,
    });
  } catch (err: any) {
    console.error("[tasks/assignable] failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not load the assignment scope.", ...constants },
      { status: 500 }
    );
  }
}
