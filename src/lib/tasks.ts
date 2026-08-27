/**
 * Task & Assignment — shared vocabulary and rules.
 *
 * WHAT A TASK ANSWERS
 *
 *   who has to do what, for which case or exhibit, by when, at what priority,
 *   and where has it got to.
 *
 * Tasks reference existing records by their EXISTING identifiers —
 * `CaseMasterID`, `EvidenceID`, `EmployeeID`, `UnitID` — and copy none of
 * their data. A task that duplicated a case number would be a second copy free
 * to drift from the first.
 */

export const TASK_TYPES = [
  "Investigation",
  "Evidence Collection",
  "Evidence Review",
  "Forensic Follow-up",
  "Witness Follow-up",
  "Accused Verification",
  "Arrest / Surrender Follow-up",
  "Court Preparation",
  "Chargesheet Preparation",
  "Report Preparation",
  "Field Verification",
  "Administrative Work",
  "Other",
] as const;

export const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

/**
 * Stored lifecycle.
 *
 * OVERDUE is deliberately NOT here. It is derived from `dueDate` against the
 * clock, never written — a stored OVERDUE would need something to run and set
 * it, and would be wrong for every minute between the deadline passing and
 * that job firing. No officer should have to mark their own work overdue.
 */
export const STATUSES = [
  "ASSIGNED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "Assigned",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
};

/** A task that has stopped moving. Nothing further is expected of the assignee. */
export const TERMINAL_STATUSES: readonly string[] = ["COMPLETED", "CANCELLED"];

/**
 * Which transitions are legal.
 *
 * Enforced on the server. The UI hides impossible actions as a courtesy; this
 * is what stops a hand-written request jumping a task straight from ASSIGNED
 * to COMPLETED without anyone ever having picked it up.
 */
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  ASSIGNED: ["ACKNOWLEDGED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "ACKNOWLEDGED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

export const AUDIT_ACTIONS = [
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_ACKNOWLEDGED",
  "TASK_STARTED",
  "TASK_REASSIGNED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "TASK_CANCELLED",
  "TASK_ON_HOLD",
  "TASK_CHECKLIST_ITEM_COMPLETED",
  "TASK_DELIVERABLE_UPDATED",
  "TASK_DEPENDENCY_SET",
  "TASK_DEPENDENCY_REMOVED",
  "TASK_CLASSIFICATION_CHANGED",
] as const;

/** The audit action a status change should be recorded under. */
export const STATUS_AUDIT_ACTION: Record<string, string> = {
  ACKNOWLEDGED: "TASK_ACKNOWLEDGED",
  IN_PROGRESS: "TASK_STARTED",
  COMPLETED: "TASK_COMPLETED",
  CANCELLED: "TASK_CANCELLED",
  ON_HOLD: "TASK_ON_HOLD",
};

/**
 * Sensitivity is RECORDED and DISPLAYED. It is not a second access system.
 *
 * Who may see a task is decided by the jurisdiction scope and RBAC that
 * already exist. Inventing "level 3 and above can see sensitive tasks" here
 * would be a parallel security model, unreviewed and disagreeing with the real
 * one the first time they diverge.
 */
export const SENSITIVITIES = ["NORMAL", "RESTRICTED", "HIGHLY_SENSITIVE"] as const;

export const SENSITIVITY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  RESTRICTED: "Restricted",
  HIGHLY_SENSITIVE: "Highly Sensitive",
};

export const EFFORTS = [
  "30 Minutes",
  "1 Hour",
  "2 Hours",
  "Half Day",
  "Full Day",
  "Multiple Days",
] as const;

export const LIMITS = {
  title: 300,
  description: 8000,
  expectedOutcome: 2000,
  completionNotes: 4000,
  remarks: 1000,
  address: 400,
  checklistTitle: 200,
  deliverableName: 200,
  checklistItems: 50,
  deliverables: 30,
} as const;

// ── Optional structures ────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string;
  completedBy: string;
}

export interface Deliverable {
  id: string;
  name: string;
  required: boolean;
  submitted: boolean;
  submittedAt: string;
}

/**
 * Read a JSON column defensively.
 *
 * Tasks written before a field existed carry nothing at all, and a task saved
 * by an older build must still open. Anything unparseable degrades to an empty
 * list rather than throwing — a task is not lost because one optional column
 * is malformed.
 */
export function parseChecklist(raw: unknown): ChecklistItem[] {
  const arr = safeArray(raw);
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x: any) => ({
      id: String(x.id ?? "").slice(0, 40) || rid(),
      title: String(x.title ?? "").slice(0, LIMITS.checklistTitle),
      completed: x.completed === true,
      completedAt: String(x.completedAt ?? ""),
      completedBy: String(x.completedBy ?? ""),
    }))
    .filter((x) => x.title)
    .slice(0, LIMITS.checklistItems);
}

export function parseDeliverables(raw: unknown): Deliverable[] {
  const arr = safeArray(raw);
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x: any) => ({
      id: String(x.id ?? "").slice(0, 40) || rid(),
      name: String(x.name ?? "").slice(0, LIMITS.deliverableName),
      required: x.required !== false,
      submitted: x.submitted === true,
      submittedAt: String(x.submittedAt ?? ""),
    }))
    .filter((x) => x.name)
    .slice(0, LIMITS.deliverables);
}

function safeArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  const s = String(raw ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Derived state ──────────────────────────────────────────────────────────

/**
 * Overdue is a reading of the clock, not a stored fact.
 *
 * A completed or cancelled task is never overdue however long it sat — the
 * deadline stopped mattering when the work stopped.
 */
export function isOverdue(task: { status: string; dueDate: string }, now: Date = new Date()): boolean {
  if (TERMINAL_STATUSES.includes(task.status)) return false;
  const due = parseDate(task.dueDate);
  return due !== null && due.getTime() < now.getTime();
}

export function isDueToday(task: { status: string; dueDate: string }, now: Date = new Date()): boolean {
  if (TERMINAL_STATUSES.includes(task.status)) return false;
  const due = parseDate(task.dueDate);
  if (!due) return false;
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

/** The status to SHOW, which may be OVERDUE even though nothing stored it. */
export function displayStatus(task: { status: string; dueDate: string }, now: Date = new Date()): string {
  return isOverdue(task, now) ? "OVERDUE" : task.status;
}

export function parseDate(value: string): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(t) ? null : new Date(t);
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.completed).length, total: items.length };
}

export function deliverableProgress(items: Deliverable[]): { done: number; total: number; requiredOpen: number } {
  return {
    done: items.filter((i) => i.submitted).length,
    total: items.length,
    requiredOpen: items.filter((i) => i.required && !i.submitted).length,
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface TaskInput {
  caseMasterId: number | null;
  evidenceId: number | null;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  assignedToEmployeeId: number;
  dueDate: string;
  expectedOutcome: string;
  checklist: ChecklistItem[];
  deliverables: Deliverable[];
  dependencyTaskNumber: string;
  sensitivity: string;
  estimatedEffort: string;
  locationAddress: string;
  locationLatitude: string;
  locationLongitude: string;
}

export interface Validation {
  ok: boolean;
  error?: string;
  field?: string;
  value?: TaskInput;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanMulti = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Server-side validation.
 *
 * The form checks the same rules step by step, but that is a courtesy to the
 * person filling it in. This is the one that counts: a request built by hand
 * never sees the form. Whitespace-only strings are rejected as empty, which is
 * the difference between "required" and "required unless you press space".
 */
export function validateTask(body: Record<string, unknown>): Validation {
  const title = clean(body.title, LIMITS.title);
  const description = cleanMulti(body.description, LIMITS.description);
  const taskType = clean(body.taskType, 60);
  const priority = String(body.priority ?? "").toUpperCase();
  const dueDate = clean(body.dueDate, 32);
  const assignedToEmployeeId = numOrNull(body.assignedToEmployeeId);

  if (!taskType) return { ok: false, error: "Select a task type.", field: "taskType" };
  if (!TASK_TYPES.includes(taskType as any)) {
    return { ok: false, error: "Unknown task type.", field: "taskType" };
  }
  if (title.length < 4) {
    return { ok: false, error: "Give the task a title of at least 4 characters.", field: "title" };
  }
  if (description.length < 10) {
    return { ok: false, error: "Describe the task in at least 10 characters.", field: "description" };
  }
  if (assignedToEmployeeId === null) {
    return { ok: false, error: "Select an officer to assign this task to.", field: "assignedToEmployeeId" };
  }
  if (!PRIORITIES.includes(priority as any)) {
    return { ok: false, error: "Select a priority.", field: "priority" };
  }
  if (!dueDate) return { ok: false, error: "Set a due date.", field: "dueDate" };
  if (!parseDate(dueDate)) {
    return { ok: false, error: "The due date is not a valid date.", field: "dueDate" };
  }

  let sensitivity = String(body.sensitivity ?? "").toUpperCase();
  if (!SENSITIVITIES.includes(sensitivity as any)) sensitivity = "NORMAL";

  let estimatedEffort = clean(body.estimatedEffort, 30);
  if (estimatedEffort && !EFFORTS.includes(estimatedEffort as any)) estimatedEffort = "";

  const dependencyTaskNumber = clean(body.dependencyTaskNumber, 40).toUpperCase();

  const lat = clean(body.locationLatitude, 24);
  const lng = clean(body.locationLongitude, 24);
  // Half a coordinate cannot be plotted, and defaulting the other half would
  // invent a location. Either both or neither.
  if ((lat && !lng) || (lng && !lat)) {
    return {
      ok: false,
      error: "A task location needs both a latitude and a longitude.",
      field: "location",
    };
  }

  return {
    ok: true,
    value: {
      caseMasterId: numOrNull(body.caseMasterId),
      evidenceId: numOrNull(body.evidenceId),
      title,
      description,
      taskType,
      priority,
      assignedToEmployeeId,
      dueDate,
      expectedOutcome: cleanMulti(body.expectedOutcome, LIMITS.expectedOutcome),
      checklist: parseChecklist(body.checklist),
      deliverables: parseDeliverables(body.deliverables),
      dependencyTaskNumber,
      sensitivity,
      estimatedEffort,
      locationAddress: clean(body.locationAddress, LIMITS.address),
      locationLatitude: lat,
      locationLongitude: lng,
    },
  };
}

/** `TASK-2026-00001`. Generated server-side; a client never proposes one. */
export function buildTaskNumber(serial: number, when: Date = new Date()): string {
  return `TASK-${when.getFullYear()}-${String(serial).padStart(5, "0")}`;
}
