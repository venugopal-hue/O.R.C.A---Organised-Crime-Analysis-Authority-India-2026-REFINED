import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { catalystNow } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";
import { resolveScope, loadEmployees, loadUnits, canSeeTask } from "@/lib/jurisdiction";
import {
  canTransition, STATUS_AUDIT_ACTION, STATUSES, LIMITS,
  parseChecklist, parseDeliverables, deliverableProgress,
} from "@/lib/tasks";

/**
 * Move a task through its lifecycle, and record why.
 *
 * POST /api/tasks/status
 *   { taskNumber, status, remarks?, completionNotes?, checklist?, deliverables? }
 *
 * Every transition writes a TaskAuditLog row. The task carries no second copy
 * of its own history, so the trail and the task can never disagree.
 *
 * OVERDUE is not settable. It is read from the due date against the clock —
 * see `isOverdue`. Accepting it here would let a task be marked overdue while
 * its deadline is still days away.
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
  const next = s(body.status).toUpperCase();
  const remarks = s(body.remarks).trim().slice(0, LIMITS.remarks);
  const completionNotes = s(body.completionNotes).trim().slice(0, LIMITS.completionNotes);

  if (!taskNumber) {
    return NextResponse.json({ success: false, error: "A task number is required." }, { status: 400 });
  }
  if (!STATUSES.includes(next as any)) {
    return NextResponse.json({ success: false, error: "Unknown status." }, { status: 400 });
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
    // Out of scope is answered as "no such task", the same as not existing.
    if (!canSeeTask(scope, current)) {
      return NextResponse.json({ success: false, error: "No such task." }, { status: 404 });
    }

    const from = s(raw.TaskStatus) || "ASSIGNED";
    if (from === next) {
      return NextResponse.json({ success: true, taskNumber, unchanged: true });
    }
    if (!canTransition(from, next)) {
      return NextResponse.json(
        {
          success: false,
          error: `A task cannot go from ${from} to ${next}.`,
          from,
          to: next,
        },
        { status: 400 }
      );
    }

    const me = scope.employee?.employeeId ?? null;

    /*
     * Only the assignee acknowledges or starts their own work.
     *
     * Acknowledging on someone else's behalf records that an officer picked up
     * a task they never saw. Completing and cancelling stay open to the
     * assigner and to supervisors in scope, because work does get closed off
     * from above.
     */
    if ((next === "ACKNOWLEDGED" || next === "IN_PROGRESS") && me !== current.assignedToEmployeeId) {
      return NextResponse.json(
        { success: false, error: "Only the officer this task is assigned to can acknowledge or start it." },
        { status: 403 }
      );
    }

    // Ending a task needs a reason on the record.
    if (next === "COMPLETED" && !completionNotes) {
      return NextResponse.json(
        { success: false, error: "Completion notes are required to complete a task.", field: "completionNotes" },
        { status: 400 }
      );
    }
    if (next === "CANCELLED" && !remarks) {
      return NextResponse.json(
        { success: false, error: "State why this task is being cancelled.", field: "remarks" },
        { status: 400 }
      );
    }

    const now = catalystNow();
    const patch: Record<string, any> = {
      ROWID: s(raw.ROWID),
      TaskStatus: next,
      UpdatedAt: now,
    };

    /*
     * Checklist and deliverables may be submitted alongside completion.
     *
     * A required deliverable left unsubmitted does NOT block completion — it
     * is recorded in the notes and the trail instead. Blocking would strand
     * tasks whose deliverables were added after the work was already done, and
     * a task nobody can close is worse than one closed with a stated gap.
     */
    let progressRemark = "";
    if (body.checklist !== undefined) {
      const items = parseChecklist(body.checklist);
      patch.ChecklistJSON = JSON.stringify(items);
      const done = items.filter((i) => i.completed).length;
      if (items.length) progressRemark += ` Checklist ${done}/${items.length}.`;
    }
    if (body.deliverables !== undefined) {
      const items = parseDeliverables(body.deliverables);
      patch.DeliverablesJSON = JSON.stringify(items);
      const p = deliverableProgress(items);
      if (items.length) progressRemark += ` Deliverables ${p.done}/${p.total}.`;
      if (p.requiredOpen > 0) progressRemark += ` ${p.requiredOpen} required deliverable(s) not submitted.`;
    }

    if (next === "COMPLETED") {
      patch.CompletedAt = now;
      patch.CompletionNotes = completionNotes;
    }

    await updateRows(TASKS, [patch]);

    const auditId = await nextId(AUDIT, "AuditID");
    await insertRows(AUDIT, [
      {
        AuditID: auditId,
        TaskNumber: taskNumber,
        ActorEmployeeID: me,
        ActorName: `${officer.name} (${officer.email})`,
        AuditAction: STATUS_AUDIT_ACTION[next] || "TASK_UPDATED",
        PreviousState: from,
        NewState: next,
        Remarks: ((next === "COMPLETED" ? completionNotes : remarks) + progressRemark).trim().slice(0, 4000),
        OccurredAt: now,
      },
    ]);

    return NextResponse.json({ success: true, taskNumber, from, to: next, updatedAt: now });
  } catch (err: any) {
    console.error("[tasks/status] failed:", err?.message || err);
    return NextResponse.json({ success: false, error: "Could not update the task." }, { status: 500 });
  }
}
