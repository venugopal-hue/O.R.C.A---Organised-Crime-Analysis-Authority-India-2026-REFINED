import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { catalystNow } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";
import { resolveScope, loadEmployees, loadUnits, canSeeTask, assignableEmployees } from "@/lib/jurisdiction";
import { TERMINAL_STATUSES, LIMITS } from "@/lib/tasks";

/**
 * Hand a task to a different officer.
 *
 * POST /api/tasks/reassign  { taskNumber, assignedToEmployeeId, remarks }
 *
 * Reassignment moves accountability, so it is recorded as its own audit event
 * naming both officers. The unit moves with the assignee — a task follows the
 * person doing it, which is what keeps it inside the right supervisor's scope
 * afterwards.
 */

const TASKS = "Task";
const AUDIT = "TaskAuditLog";
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "");

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

  const taskNumber = s(body.taskNumber).trim().toUpperCase();
  const toId = body.assignedToEmployeeId === null || body.assignedToEmployeeId === undefined
    ? null
    : Number(body.assignedToEmployeeId);
  const remarks = s(body.remarks).trim().slice(0, LIMITS.remarks);

  if (!taskNumber) {
    return NextResponse.json({ success: false, error: "A task number is required." }, { status: 400 });
  }
  if (toId === null || !Number.isFinite(toId)) {
    return NextResponse.json({ success: false, error: "Select an officer to reassign to." }, { status: 400 });
  }
  // Moving accountability without saying why leaves no record of the decision.
  if (!remarks) {
    return NextResponse.json(
      { success: false, error: "State why this task is being reassigned.", field: "remarks" },
      { status: 400 }
    );
  }

  try {
    const [taskRows, employees, units] = await Promise.all([
      getAllRows(TASKS), loadEmployees(), loadUnits(),
    ]);
    const scope = await resolveScope(
      { employeeId: (officer as any).employeeId ?? null, kgid: (officer as any).badgeId ?? null, dashboardRole: officer.dashboardRole },
      { employees, units }
    );

    const raw = taskRows.map((r) => unwrap(r, TASKS)).find((r) => s(r.TaskNumber) === taskNumber);
    if (!raw?.ROWID) {
      return NextResponse.json({ success: false, error: "No such task." }, { status: 404 });
    }

    const current = {
      assignedToEmployeeId: raw.AssignedToEmployeeID != null ? Number(raw.AssignedToEmployeeID) : null,
      assignedByEmployeeId: raw.AssignedByEmployeeID != null ? Number(raw.AssignedByEmployeeID) : null,
      assignedUnitId: raw.AssignedUnitID != null ? Number(raw.AssignedUnitID) : null,
    };
    if (!canSeeTask(scope, current)) {
      return NextResponse.json({ success: false, error: "No such task." }, { status: 404 });
    }

    const status = s(raw.TaskStatus) || "ASSIGNED";
    if (TERMINAL_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `A ${status.toLowerCase()} task cannot be reassigned.` },
        { status: 400 }
      );
    }

    // The new assignee must be within the CALLER'S scope, not the task's.
    // Otherwise a task could be walked out of one district and into another by
    // whoever happens to hold it.
    const allowed = assignableEmployees(scope, employees);
    const assignee = allowed.find((e) => e.employeeId === toId);
    if (!assignee) {
      return NextResponse.json(
        { success: false, error: "That officer is not within your assignment scope.", field: "assignedToEmployeeId" },
        { status: 403 }
      );
    }
    if (assignee.employeeId === current.assignedToEmployeeId) {
      return NextResponse.json(
        { success: false, error: "This task is already assigned to that officer." },
        { status: 400 }
      );
    }

    const previous = employees.find((e) => e.employeeId === current.assignedToEmployeeId);
    const now = catalystNow();

    await updateRows(TASKS, [
      {
        ROWID: s(raw.ROWID),
        AssignedToEmployeeID: assignee.employeeId,
        AssignedUnitID: assignee.unitId,
        /*
         * Back to ASSIGNED. Acknowledgement is personal — it says the officer
         * holding the task has seen it — so it cannot carry over to someone
         * who has not.
         */
        TaskStatus: "ASSIGNED",
        UpdatedAt: now,
      },
    ]);

    const auditId = await nextId(AUDIT, "AuditID");
    await insertRows(AUDIT, [
      {
        AuditID: auditId,
        TaskNumber: taskNumber,
        ActorEmployeeID: scope.employee?.employeeId ?? null,
        ActorName: `${officer.name} (${officer.email})`,
        AuditAction: "TASK_REASSIGNED",
        PreviousState: previous ? `${previous.name} (#${previous.employeeId})` : String(current.assignedToEmployeeId ?? ""),
        NewState: `${assignee.name} (#${assignee.employeeId})`,
        Remarks: remarks,
        OccurredAt: now,
      },
    ]);

    return NextResponse.json({
      success: true,
      taskNumber,
      assignedToEmployeeId: assignee.employeeId,
      assignedToName: assignee.name,
      updatedAt: now,
    });
  } catch (err: any) {
    console.error("[tasks/reassign] failed:", err?.message || err);
    return NextResponse.json({ success: false, error: "Could not reassign the task." }, { status: 500 });
  }
}
