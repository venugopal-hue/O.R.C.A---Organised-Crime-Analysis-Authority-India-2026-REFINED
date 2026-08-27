import { getAllRows } from "@/lib/catalyst";

/**
 * Who an officer may see and assign to.
 *
 * WHY THIS EXISTS
 *
 * Until now nothing in this platform asked "is this officer's *area* any of
 * their business". Access was decided entirely by role: hold the tab, see
 * everything the tab shows. That is workable for a console where every screen
 * is statewide reference data, and wrong the moment records belong to a place.
 *
 * A task belongs to a place. Returning every task in Karnataka to anyone
 * holding the tab would make the module a statewide read of who is doing what,
 * which is not what a station officer is entitled to.
 *
 * THE RULE
 *
 * Scope is derived from the ORGANISATION, not from a clearance number. An
 * officer's reach is their own unit, plus every unit beneath it in the
 * `Unit.ParentUnit` tree, plus — for a district-level posting — the units in
 * their district.
 *
 * Rank is deliberately NOT the axis. A high ISD level says how sensitive the
 * material may be, not which stations report to you; the two are different
 * questions and conflating them is how "senior" quietly becomes "statewide".
 * Statewide reach comes from an explicit role grant (see `hasStatewideScope`),
 * never from seniority.
 *
 * FAIL CLOSED
 *
 * An officer with no Employee record, or an Employee row with no unit, gets an
 * EMPTY scope — they see their own tasks and nothing else. An unknown officer
 * must never inherit a wide default.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface EmployeeRecord {
  employeeId: number;
  kgid: string;
  name: string;
  districtId: number | null;
  unitId: number | null;
  rankId: number | null;
  designationId: number | null;
}

export interface UnitRecord {
  unitId: number;
  name: string;
  parentUnitId: number | null;
  districtId: number | null;
}

export interface Scope {
  /** The Employee row behind the signed-in officer, or null if there is none. */
  employee: EmployeeRecord | null;
  /** Units this officer supervises, including their own. Empty when unknown. */
  unitIds: number[];
  /** Districts covered by those units. */
  districtIds: number[];
  /** True only by explicit role grant, never by rank. */
  statewide: boolean;
  /** Plain-language description of how the scope was reached, for the UI. */
  basis: string;
}

/**
 * Roles that legitimately need to see the whole state.
 *
 * Command administration and the O.R.C.A. engineering roles run the platform
 * itself; a station officer, however senior, does not appear here.
 */
const STATEWIDE_ROLES: ReadonlySet<string> = new Set([
  "admin_full",
  "command_admin_l1",
  "command_admin_l2",
  "orca_owner",
  "orca_engineer",
  "orca_support",
  "orca_demo",
]);

export function hasStatewideScope(role: string | null | undefined): boolean {
  return STATEWIDE_ROLES.has(String(role ?? ""));
}

export async function loadEmployees(): Promise<EmployeeRecord[]> {
  const rows = await getAllRows("Employee").catch(() => [] as any[]);
  return rows
    .map((r) => unwrap(r, "Employee"))
    .filter((e) => num(e.EmployeeID) !== null)
    .map((e) => ({
      employeeId: Number(e.EmployeeID),
      kgid: String(e.KGID || ""),
      name: String(e.FirstName || "").trim(),
      districtId: num(e.DistrictID),
      unitId: num(e.UnitID),
      rankId: num(e.RankID),
      designationId: num(e.DesignationID),
    }));
}

export async function loadUnits(): Promise<UnitRecord[]> {
  const rows = await getAllRows("Unit").catch(() => [] as any[]);
  return rows
    .map((r) => unwrap(r, "Unit"))
    .filter((u) => num(u.UnitID) !== null)
    .map((u) => ({
      unitId: Number(u.UnitID),
      name: String(u.UnitName || ""),
      parentUnitId: num(u.ParentUnit),
      districtId: num(u.DistrictID),
    }));
}

/**
 * Every unit at or beneath `rootUnitId` in the ParentUnit tree.
 *
 * Iterative with a visited set rather than recursive: OSM-style reference data
 * is edited by hand, and one row whose ParentUnit points back up its own chain
 * would spin a recursive walk forever. A cycle here must degrade to "the units
 * I already found", not hang the request.
 */
export function descendantUnits(units: UnitRecord[], rootUnitId: number): number[] {
  const children = new Map<number, number[]>();
  for (const u of units) {
    if (u.parentUnitId === null) continue;
    if (!children.has(u.parentUnitId)) children.set(u.parentUnitId, []);
    children.get(u.parentUnitId)!.push(u.unitId);
  }

  const seen = new Set<number>([rootUnitId]);
  const queue = [rootUnitId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of children.get(current) || []) {
      if (seen.has(child)) continue;      // cycle guard
      seen.add(child);
      queue.push(child);
    }
  }
  return [...seen];
}

/**
 * Resolve what a signed-in officer may reach.
 *
 * `kgid` is how a Firebase account is tied to an Employee row — the officer
 * account carries it, and it is the only link between the two systems.
 */
export async function resolveScope(
  officer: { kgid?: string | null; employeeId?: number | null; dashboardRole?: string | null },
  preloaded?: { employees?: EmployeeRecord[]; units?: UnitRecord[] }
): Promise<Scope> {
  const employees = preloaded?.employees ?? (await loadEmployees());
  const units = preloaded?.units ?? (await loadUnits());

  const kgid = String(officer.kgid ?? "").trim();
  const employee =
    employees.find((e) => officer.employeeId != null && e.employeeId === officer.employeeId) ||
    (kgid ? employees.find((e) => e.kgid && e.kgid === kgid) : undefined) ||
    null;

  const statewide = hasStatewideScope(officer.dashboardRole);

  if (statewide) {
    return {
      employee,
      unitIds: units.map((u) => u.unitId),
      districtIds: [...new Set(units.map((u) => u.districtId).filter((d): d is number => d !== null))],
      statewide: true,
      basis: "Statewide — command administration role.",
    };
  }

  // No Employee record means no place in the organisation, so no scope beyond
  // the officer's own tasks. Deliberately not a wide default.
  if (!employee || employee.unitId === null) {
    return {
      employee,
      unitIds: [],
      districtIds: [],
      statewide: false,
      basis: employee
        ? "No unit recorded against this officer — own tasks only."
        : "No personnel record matched this account — own tasks only.",
    };
  }

  const unitIds = descendantUnits(units, employee.unitId);
  const own = units.find((u) => u.unitId === employee.unitId);

  /*
   * A district-level posting reaches the whole district.
   *
   * The signal is structural, not a rank: a unit with no parent is a top of
   * its own tree, so an officer posted there supervises the district rather
   * than one station inside it.
   */
  const isDistrictLevel = !!own && own.parentUnitId === null && own.districtId !== null;
  if (isDistrictLevel) {
    for (const u of units) {
      if (u.districtId === own!.districtId && !unitIds.includes(u.unitId)) unitIds.push(u.unitId);
    }
  }

  const districtIds = [
    ...new Set(
      units
        .filter((u) => unitIds.includes(u.unitId))
        .map((u) => u.districtId)
        .filter((d): d is number => d !== null)
    ),
  ];

  return {
    employee,
    unitIds,
    districtIds,
    statewide: false,
    basis: isDistrictLevel
      ? `District posting at ${own!.name} — ${unitIds.length} units in this district.`
      : unitIds.length > 1
      ? `${own?.name || "Unit"} and ${unitIds.length - 1} subordinate unit(s).`
      : `${own?.name || "Unit"} only.`,
  };
}

/**
 * May this officer see this task?
 *
 * Assignee and assigner always can — a task addressed to you is yours to read
 * regardless of where you sit. Beyond that it is the unit scope, and nothing
 * else. There is no "senior enough to see everything" branch.
 */
export function canSeeTask(
  scope: Scope,
  task: { assignedToEmployeeId: number | null; assignedByEmployeeId: number | null; assignedUnitId: number | null }
): boolean {
  const me = scope.employee?.employeeId ?? null;
  if (me !== null && (task.assignedToEmployeeId === me || task.assignedByEmployeeId === me)) return true;
  if (task.assignedUnitId !== null && scope.unitIds.includes(task.assignedUnitId)) return true;
  return false;
}

/**
 * Who this officer may assign work to.
 *
 * Officers posted to any unit within scope — themselves included, because
 * recording your own follow-up is ordinary. An officer with no scope can
 * assign only to themselves, which keeps the feature usable without handing
 * out a directory of the whole force.
 */
export function assignableEmployees(scope: Scope, employees: EmployeeRecord[]): EmployeeRecord[] {
  const me = scope.employee?.employeeId ?? null;
  return employees.filter(
    (e) =>
      (e.unitId !== null && scope.unitIds.includes(e.unitId)) ||
      (me !== null && e.employeeId === me)
  );
}
