import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, deleteRow, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { catalystNow, toCatalystDateTime } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";
import {
  resolveScope, loadEmployees, loadUnits, canSeeTask, assignableEmployees,
} from "@/lib/jurisdiction";
import {
  validateTask, buildTaskNumber, parseChecklist, parseDeliverables,
  isOverdue, isDueToday, displayStatus, TERMINAL_STATUSES,
  STATUSES, PRIORITIES,
} from "@/lib/tasks";

/**
 * Task & Assignment.
 *
 * GET  /api/tasks                  — every task within the caller's scope
 * GET  /api/tasks?taskNumber=…     — one task, with its audit trail
 * GET  /api/tasks?caseMasterId=…   — the tasks on one case
 * POST /api/tasks                  — create and assign
 *
 * VISIBILITY IS NOT "EVERYTHING THE TAB SHOWS"
 *
 * A task belongs to a place. The scope comes from the organisation — the
 * officer's unit, the units beneath it, their district if they are posted at
 * district level — plus any task addressed to or raised by them personally.
 * Seniority does not widen it; statewide reach is an explicit role grant.
 *
 * Filtering happens on the SERVER. Handing the browser every task and hiding
 * some of them would leave the whole register one devtools tab away.
 */

const TASKS = "Task";
const AUDIT = "TaskAuditLog";

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "");
const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

function mapTask(r: any) {
  const checklist = parseChecklist(r.ChecklistJSON);
  const deliverables = parseDeliverables(r.DeliverablesJSON);
  return {
    rowId: s(r.ROWID),
    taskId: Number(r.TaskID || 0),
    taskNumber: s(r.TaskNumber),
    caseMasterId: n(r.CaseMasterID),
    evidenceId: n(r.EvidenceID),
    title: s(r.Title),
    description: s(r.TaskDescription),
    taskType: s(r.TaskType),
    priority: s(r.TaskPriority) || "NORMAL",
    status: s(r.TaskStatus) || "ASSIGNED",
    assignedByEmployeeId: n(r.AssignedByEmployeeID),
    assignedToEmployeeId: n(r.AssignedToEmployeeID),
    assignedUnitId: n(r.AssignedUnitID),
    dueDate: s(r.DueDate),
    completedAt: s(r.CompletedAt),
    completionNotes: s(r.CompletionNotes),
    // Optional fields. A task written before any of these existed carries
    // nothing, and must still open — hence the safe defaults, never a throw.
    expectedOutcome: s(r.ExpectedOutcome),
    checklist,
    deliverables,
    dependencyTaskNumber: s(r.DependencyTaskNumber),
    sensitivity: s(r.Sensitivity) || "NORMAL",
    estimatedEffort: s(r.EstimatedEffort),
    locationAddress: s(r.LocationAddress),
    locationLatitude: s(r.LocationLatitude),
    locationLongitude: s(r.LocationLongitude),
    createdAt: s(r.CreatedAt || r.CREATEDTIME),
    updatedAt: s(r.UpdatedAt),
  };
}

export type MappedTask = ReturnType<typeof mapTask>;

/** Names for the ids a task carries, so the UI never has to look them up. */
function decorate(task: MappedTask, employees: any[], units: any[]) {
  const emp = (id: number | null) => employees.find((e) => e.employeeId === id) || null;
  const unit = units.find((u) => u.unitId === task.assignedUnitId) || null;
  const to = emp(task.assignedToEmployeeId);
  const by = emp(task.assignedByEmployeeId);
  return {
    ...task,
    assignedToName: to?.name || "",
    assignedToKgid: to?.kgid || "",
    assignedByName: by?.name || "",
    unitName: unit?.name || "",
    overdue: isOverdue(task),
    dueToday: isDueToday(task),
    displayStatus: displayStatus(task),
  };
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, tasks: [] });
  }

  const url = new URL(req.url);
  const wantedNumber = (url.searchParams.get("taskNumber") || "").trim().toUpperCase();
  const caseFilter = n(url.searchParams.get("caseMasterId"));
  const evidenceFilter = n(url.searchParams.get("evidenceId"));

  try {
    const [taskRows, employees, units] = await Promise.all([
      getAllRows(TASKS),
      loadEmployees(),
      loadUnits(),
    ]);

    const scope = await resolveScope(
      { employeeId: (officer as any).employeeId ?? null, kgid: (officer as any).badgeId ?? null, dashboardRole: officer.dashboardRole },
      { employees, units }
    );

    // The scope filter runs FIRST, before any query filter, so no parameter
    // can widen what the caller is entitled to.
    const visible = taskRows
      .map((r) => mapTask(unwrap(r, TASKS)))
      .filter((t) => t.taskNumber)
      .filter((t) => canSeeTask(scope, t));

    if (wantedNumber) {
      const one = visible.find((t) => t.taskNumber === wantedNumber);
      if (!one) {
        // Same answer whether it does not exist or is out of scope. Telling a
        // caller "that task exists but is not yours" leaks the register.
        return NextResponse.json({ success: false, error: "No such task." }, { status: 404 });
      }
      const auditRows = await getAllRows(AUDIT);
      const audit = auditRows
        .map((r) => unwrap(r, AUDIT))
        .filter((a) => s(a.TaskNumber) === wantedNumber)
        .map((a) => ({
          auditId: Number(a.AuditID || 0),
          actorEmployeeId: n(a.ActorEmployeeID),
          actorName: s(a.ActorName),
          action: s(a.AuditAction),
          previousState: s(a.PreviousState),
          newState: s(a.NewState),
          remarks: s(a.Remarks),
          occurredAt: s(a.OccurredAt || a.CREATEDTIME),
        }))
        .sort((x, y) => x.occurredAt.localeCompare(y.occurredAt));

      return NextResponse.json({
        success: true,
        configured: true,
        task: decorate(one, employees, units),
        audit,
        scopeBasis: scope.basis,
      });
    }

    let tasks = visible;
    if (caseFilter !== null) tasks = tasks.filter((t) => t.caseMasterId === caseFilter);
    if (evidenceFilter !== null) tasks = tasks.filter((t) => t.evidenceId === evidenceFilter);

    const decorated = tasks
      .map((t) => decorate(t, employees, units))
      .sort((a, b) => b.taskId - a.taskId);

    const me = scope.employee?.employeeId ?? null;
    const open = decorated.filter((t) => !TERMINAL_STATUSES.includes(t.status));

    return NextResponse.json({
      success: true,
      configured: true,
      tasks: decorated,
      // Every figure counted from the SAME authorized list the caller can see,
      // so a KPI can never describe tasks the officer is not shown.
      summary: {
        total: decorated.length,
        mine: decorated.filter((t) => t.assignedToEmployeeId === me).length,
        assigned: decorated.filter((t) => t.status === "ASSIGNED").length,
        inProgress: decorated.filter((t) => t.status === "IN_PROGRESS").length,
        dueToday: open.filter((t) => t.dueToday).length,
        overdue: open.filter((t) => t.overdue).length,
        completed: decorated.filter((t) => t.status === "COMPLETED").length,
      },
      scope: {
        basis: scope.basis,
        statewide: scope.statewide,
        unitCount: scope.unitIds.length,
        employeeId: me,
      },
    });
  } catch (err: any) {
    console.error("[tasks] list failed:", err?.message || err);
    return NextResponse.json({ success: false, error: "Could not load tasks." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, error: "Task store is not configured." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  const checked = validateTask(body);
  if (!checked.ok || !checked.value) {
    return NextResponse.json(
      { success: false, error: checked.error, field: checked.field },
      { status: 400 }
    );
  }
  const v = checked.value;

  try {
    const [employees, units] = await Promise.all([loadEmployees(), loadUnits()]);
    const scope = await resolveScope(
      { employeeId: (officer as any).employeeId ?? null, kgid: (officer as any).badgeId ?? null, dashboardRole: officer.dashboardRole },
      { employees, units }
    );

    /*
     * The assignee must be inside the caller's assignment scope.
     *
     * The form only offers officers within scope, but that is presentation. A
     * request naming any EmployeeID would otherwise let a station officer
     * task a stranger in another district.
     */
    const allowed = assignableEmployees(scope, employees);
    const assignee = allowed.find((e) => e.employeeId === v.assignedToEmployeeId);
    if (!assignee) {
      return NextResponse.json(
        {
          success: false,
          error: "That officer is not within your assignment scope.",
          field: "assignedToEmployeeId",
        },
        { status: 403 }
      );
    }

    // A task cannot depend on itself, and cannot depend on something that does
    // not exist or that the caller cannot see.
    if (v.dependencyTaskNumber) {
      const taskRows = await getAllRows(TASKS);
      const dep = taskRows
        .map((r) => mapTask(unwrap(r, TASKS)))
        .find((t) => t.taskNumber === v.dependencyTaskNumber);
      if (!dep || !canSeeTask(scope, dep)) {
        return NextResponse.json(
          { success: false, error: "The task this depends on was not found in your scope.", field: "dependencyTaskNumber" },
          { status: 400 }
        );
      }
    }

    const serial = await nextId(TASKS, "TaskID");
    const taskNumber = buildTaskNumber(serial);
    const now = catalystNow();
    const due = toCatalystDateTime(v.dueDate);

    const row: Record<string, any> = {
      TaskID: serial,
      TaskNumber: taskNumber,
      Title: v.title,
      TaskDescription: v.description,
      TaskType: v.taskType,
      TaskPriority: v.priority,
      TaskStatus: "ASSIGNED",
      AssignedByEmployeeID: scope.employee?.employeeId ?? null,
      AssignedToEmployeeID: assignee.employeeId,
      AssignedUnitID: assignee.unitId,
      ExpectedOutcome: v.expectedOutcome,
      ChecklistJSON: JSON.stringify(v.checklist),
      DeliverablesJSON: JSON.stringify(v.deliverables),
      DependencyTaskNumber: v.dependencyTaskNumber,
      Sensitivity: v.sensitivity,
      EstimatedEffort: v.estimatedEffort,
      LocationAddress: v.locationAddress,
      LocationLatitude: v.locationLatitude,
      LocationLongitude: v.locationLongitude,
      CompletionNotes: "",
      CreatedAt: now,
      UpdatedAt: now,
    };
    // Datetime columns reject "" outright — an optional date is OMITTED.
    if (due) row.DueDate = due;
    if (v.caseMasterId !== null) row.CaseMasterID = v.caseMasterId;
    if (v.evidenceId !== null) row.EvidenceID = v.evidenceId;

    await insertRows(TASKS, [row]);

    /*
     * The audit event is not optional.
     *
     * Catalyst has no transaction across two tables, so "atomic" here means
     * compensating deletion: if TASK_CREATED cannot be written, the task is
     * removed. A task with no creation record is a task nobody can account
     * for, and the register would be silently missing its own first event.
     */
    try {
      const auditId = await nextId(AUDIT, "AuditID");
      await insertRows(AUDIT, [
        {
          AuditID: auditId,
          TaskNumber: taskNumber,
          ActorEmployeeID: scope.employee?.employeeId ?? null,
          ActorName: `${officer.name} (${officer.email})`,
          AuditAction: "TASK_CREATED",
          PreviousState: "",
          NewState: "ASSIGNED",
          Remarks: `Assigned to ${assignee.name || "officer " + assignee.employeeId}`,
          OccurredAt: now,
        },
      ]);
    } catch (auditErr: any) {
      console.error("[tasks] audit failed, rolling back task:", auditErr?.message || auditErr);
      try {
        const rows = await getAllRows(TASKS);
        const orphan = rows.map((r) => unwrap(r, TASKS)).find((r) => s(r.TaskNumber) === taskNumber);
        if (orphan?.ROWID) await deleteRow(TASKS, s(orphan.ROWID));
      } catch (cleanupErr: any) {
        console.error("[tasks] rollback failed, task left with no creation record:", taskNumber, cleanupErr?.message || cleanupErr);
      }
      return NextResponse.json(
        { success: false, error: "Could not record the task history. The task was not created." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, taskNumber, taskId: serial, createdAt: now });
  } catch (err: any) {
    console.error("[tasks] create failed:", err?.message || err);
    return NextResponse.json({ success: false, error: "Could not create the task." }, { status: 500 });
  }
}
