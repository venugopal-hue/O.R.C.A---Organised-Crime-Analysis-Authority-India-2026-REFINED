"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList, Plus, RefreshCw, Search, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Inbox, UserCog, Trash2, X,
} from "lucide-react";
import { ORCA_TOKENS, ORCA_MONO } from "@/lib/theme";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useUnsavedWarning } from "@/lib/useUnsavedWarning";
import { useIntelligence } from "@/context/IntelligenceContext";
import {
  STATUS_LABELS, PRIORITY_LABELS, SENSITIVITY_LABELS, LIMITS,
  checklistProgress, deliverableProgress, rid,
  type ChecklistItem, type Deliverable,
} from "@/lib/tasks";

/**
 * Task & Assignment.
 *
 * WHAT IT ANSWERS: who has to do what, for which case or exhibit, by when, at
 * what priority, and where it has got to.
 *
 * Everything on this screen is drawn from tasks the SERVER decided the officer
 * may see. No count is hardcoded, no officer or station name is written into
 * the source, and the assignee list is whatever the jurisdiction layer returns
 * for whoever is signed in.
 *
 * Mounted bare, not inside a Panel — Panel sets overflow:hidden and clips the
 * SearchableSelect dropdowns. Same rule as CaseRegistration.
 */

const T = ORCA_TOKENS;

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#b91c1c",
  HIGH: "#ea580c",
  NORMAL: "#0369a1",
  LOW: "#64748b",
};

const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: "#b45309",
  ACKNOWLEDGED: "#0369a1",
  IN_PROGRESS: "#7c3aed",
  COMPLETED: "#059669",
  ON_HOLD: "#64748b",
  CANCELLED: "#64748b",
  OVERDUE: "#b91c1c",
};

interface Task {
  taskNumber: string;
  taskId: number;
  caseMasterId: number | null;
  evidenceId: number | null;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  status: string;
  displayStatus: string;
  assignedToEmployeeId: number | null;
  assignedByEmployeeId: number | null;
  assignedToName: string;
  assignedByName: string;
  unitName: string;
  dueDate: string;
  completedAt: string;
  completionNotes: string;
  expectedOutcome: string;
  checklist: ChecklistItem[];
  deliverables: Deliverable[];
  dependencyTaskNumber: string;
  sensitivity: string;
  estimatedEffort: string;
  locationAddress: string;
  overdue: boolean;
  dueToday: boolean;
  createdAt: string;
}

interface Summary {
  total: number; mine: number; assigned: number; inProgress: number;
  dueToday: number; overdue: number; completed: number;
}

interface AssignableOfficer {
  employeeId: number; name: string; kgid: string; rank: string;
  unitId: number | null; unitName: string; isSelf: boolean;
}

interface Ref {
  officers: AssignableOfficer[];
  cases: { caseMasterId: number; crimeNumber: string; registeredOn: string }[];
  taskTypes: string[];
  priorities: string[];
  sensitivities: string[];
  efforts: string[];
  scope: { basis: string; statewide: boolean; unitCount: number; employeeId: number | null; hasPersonnelRecord: boolean };
}

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: T.textGray,
  fontFamily: ORCA_MONO, letterSpacing: "0.03em",
};
const input: React.CSSProperties = {
  padding: "8px 11px", fontSize: 13, borderRadius: 6,
  border: `1px solid ${T.border}`, outline: "none", background: "#fff",
  color: T.navy, fontFamily: "inherit", width: "100%",
};
const hint: React.CSSProperties = { fontSize: 10.5, color: T.textMuted, lineHeight: 1.45 };
const card: React.CSSProperties = {
  background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8,
  padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const fld = (children: React.ReactNode) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
);

const pretty = (v: string) => {
  if (!v) return "—";
  const t = Date.parse(v.includes("T") ? v : v.replace(" ", "T"));
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const STEPS = ["CASE", "TASK", "ASSIGNEE", "PRIORITY", "DUE DATE", "REVIEW"];

const EMPTY_FORM = {
  caseMasterId: "",
  noCase: false,
  evidenceId: "",
  taskType: "",
  title: "",
  description: "",
  expectedOutcome: "",
  assignedToEmployeeId: "",
  priority: "",
  sensitivity: "NORMAL",
  estimatedEffort: "",
  dueDate: "",
  dependencyTaskNumber: "",
  locationAddress: "",
  locationLatitude: "",
  locationLongitude: "",
};

export const TaskAssignment: React.FC = () => {
  // Set when the officer came here from a case or an exhibit.
  const { taskPreset, setTaskPreset } = useIntelligence();
  const presetCaseId = taskPreset?.caseMasterId ?? null;
  const presetEvidenceId = taskPreset?.evidenceId ?? null;

  const [tab, setTab] = useState<"all" | "mine" | "new">("all");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scopeBasis, setScopeBasis] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [reference, setReference] = useState<Ref | null>(null);
  const [refError, setRefError] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [officerFilter, setOfficerFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const [openTask, setOpenTask] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<{ task: Task; audit: any[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [actionRemarks, setActionRemarks] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [workChecklist, setWorkChecklist] = useState<ChecklistItem[]>([]);
  const [workDeliverables, setWorkDeliverables] = useState<Deliverable[]>([]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<string>("");

  const pristine = useRef(JSON.stringify({ form: EMPTY_FORM, checklist: [], deliverables: [] }));
  const draftDirty =
    tab === "new" && !created &&
    JSON.stringify({ form, checklist, deliverables }) !== pristine.current;
  useUnsavedWarning(draftDirty);

  // ── Data ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/tasks");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setTasks(j.tasks || []);
      setSummary(j.summary || null);
      setScopeBasis(j.scope?.basis || "");
    } catch (e: any) {
      setLoadError(e?.message || "Could not load tasks.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tasks/assignable");
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.success) throw new Error(j.error || "Assignment scope unavailable.");
        setReference(j);
      } catch (e: any) {
        if (!cancelled) setRefError(e?.message || "Could not load the assignment scope.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A task raised from a case or an exhibit arrives with its identifiers
  // already set. The officer never retypes them.
  useEffect(() => {
    if (presetCaseId === null && presetEvidenceId === null) return;
    setTab("new");
    setForm((f) => ({
      ...f,
      caseMasterId: presetCaseId !== null ? String(presetCaseId) : f.caseMasterId,
      evidenceId: presetEvidenceId !== null ? String(presetEvidenceId) : f.evidenceId,
      // Arriving from a case means step 1 is already answered.
      noCase: presetCaseId === null && presetEvidenceId !== null ? f.noCase : false,
    }));
    setStep(1);
    // Cleared once consumed, or every later visit to the module would jump
    // back into a half-filled form for a case the officer has moved on from.
    setTaskPreset(null);
  }, [presetCaseId, presetEvidenceId, setTaskPreset]);

  const myEmployeeId = reference?.scope.employeeId ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === "mine" ? tasks.filter((t) => t.assignedToEmployeeId === myEmployeeId) : tasks;
    return base.filter((t) => {
      if (statusFilter !== "ALL" && t.displayStatus !== statusFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "ALL" && t.taskType !== typeFilter) return false;
      if (officerFilter !== "ALL" && String(t.assignedToEmployeeId) !== officerFilter) return false;
      if (dueFilter === "OVERDUE" && !t.overdue) return false;
      if (dueFilter === "TODAY" && !t.dueToday) return false;
      if (!q) return true;
      return (
        t.taskNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.assignedToName.toLowerCase().includes(q) ||
        (t.caseMasterId !== null && String(t.caseMasterId).includes(q))
      );
    });
  }, [tasks, tab, myEmployeeId, statusFilter, priorityFilter, typeFilter, officerFilter, dueFilter, query]);

  const expand = useCallback(async (taskNumber: string) => {
    if (openTask === taskNumber && modalOpen) { setModalOpen(false); setOpenTask(""); setDetail(null); return; }
    setOpenTask(taskNumber);
    setModalOpen(true);
    setDetail(null);
    setActionError("");
    setCompletionNotes("");
    setActionRemarks("");
    setReassignTo("");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tasks?taskNumber=${encodeURIComponent(taskNumber)}`);
      const j = await res.json();
      if (res.ok && j.success) {
        setDetail({ task: j.task, audit: j.audit || [] });
        setWorkChecklist(j.task.checklist || []);
        setWorkDeliverables(j.task.deliverables || []);
      }
    } catch {
      /* the row is already on screen; the trail is supplementary */
    } finally {
      setDetailLoading(false);
    }
  }, [openTask]);

  async function act(status: string) {
    if (!detail || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskNumber: detail.task.taskNumber,
          status,
          remarks: actionRemarks,
          completionNotes,
          checklist: workChecklist,
          deliverables: workDeliverables,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { setActionError(j.error || "Action failed."); return; }
      setLoaded(false);
      const ref = detail.task.taskNumber;
      setOpenTask("");
      setDetail(null);
      await load();
      await expand(ref);
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setActionBusy(false);
    }
  }

  async function doReassign() {
    if (!detail || actionBusy) return;
    setActionBusy(true);
    setActionError("");
    try {
      const res = await fetch("/api/tasks/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskNumber: detail.task.taskNumber,
          assignedToEmployeeId: Number(reassignTo),
          remarks: actionRemarks,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { setActionError(j.error || "Reassignment failed."); return; }
      setLoaded(false);
      const ref = detail.task.taskNumber;
      setOpenTask("");
      setDetail(null);
      await load();
      await expand(ref);
    } catch {
      setActionError("Could not reach the server.");
    } finally {
      setActionBusy(false);
    }
  }

  // ── Assignment wizard ────────────────────────────────────────────────────
  const stepValid = (i: number): string => {
    if (i === 0) return form.caseMasterId || form.noCase ? "" : "Select a case, or mark this as an administrative task.";
    if (i === 1) {
      if (!form.taskType) return "Select a task type.";
      if (form.title.trim().length < 4) return "Give the task a title of at least 4 characters.";
      if (form.description.trim().length < 10) return "Describe the task in at least 10 characters.";
      return "";
    }
    if (i === 2) return form.assignedToEmployeeId ? "" : "Select the officer this task is for.";
    if (i === 3) return form.priority ? "" : "Select a priority.";
    if (i === 4) return form.dueDate ? "" : "Set a due date.";
    return "";
  };

  function nextStep() {
    const err = stepValid(step);
    if (err) { setFormError(err); return; }
    setFormError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (saving) return;
    for (let i = 0; i < STEPS.length - 1; i++) {
      const err = stepValid(i);
      if (err) { setStep(i); setFormError(err); return; }
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseMasterId: form.noCase ? null : Number(form.caseMasterId) || null,
          evidenceId: Number(form.evidenceId) || null,
          taskType: form.taskType,
          title: form.title,
          description: form.description,
          expectedOutcome: form.expectedOutcome,
          assignedToEmployeeId: Number(form.assignedToEmployeeId),
          priority: form.priority,
          sensitivity: form.sensitivity,
          estimatedEffort: form.estimatedEffort,
          dueDate: form.dueDate,
          dependencyTaskNumber: form.dependencyTaskNumber,
          locationAddress: form.locationAddress,
          locationLatitude: form.locationLatitude,
          locationLongitude: form.locationLongitude,
          checklist,
          deliverables,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) { setFormError(j.error || "Could not create the task."); return; }
      setCreated(j.taskNumber);
      setLoaded(false);
    } catch {
      setFormError("Could not reach the server. The task was not created.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setChecklist([]);
    setDeliverables([]);
    setStep(0);
    setCreated("");
    setFormError("");
  }

  const officerOptions = useMemo(
    () => (reference?.officers || []).map((o) => ({
      id: String(o.employeeId),
      label: `${o.name}${o.isSelf ? " (you)" : ""}`,
      hint: [o.rank, o.unitName].filter(Boolean).join(" · "),
    })),
    [reference]
  );

  const caseOptions = useMemo(
    () => (reference?.cases || []).map((c) => ({
      id: String(c.caseMasterId),
      label: c.crimeNumber,
      hint: c.registeredOn ? `Registered ${c.registeredOn}` : "",
    })),
    [reference]
  );

  const tabBtn = (id: typeof tab, text: string) => (
    <button key={id} onClick={() => setTab(id)} style={{
      background: tab === id ? T.navy : "transparent",
      color: tab === id ? "#fff" : T.textGray,
      border: `1px solid ${tab === id ? T.navy : T.border}`,
      borderRadius: 6, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    }}>{text}</button>
  );

  const kpi = (t: string, v: number | string, c: string, active?: boolean, onClick?: () => void) => (
    <button key={t} onClick={onClick} disabled={!onClick} style={{
      ...card, padding: 14, textAlign: "left",
      cursor: onClick ? "pointer" : "default",
      borderColor: active ? T.gold : T.border,
      borderWidth: active ? 2 : 1, borderStyle: "solid",
      background: active ? "rgba(255,153,51,0.10)" : "#fff",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textGray, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color: c, marginTop: 5 }}>{loaded ? v : "—"}</div>
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.navy, margin: 0 }}>Task &amp; Assignment</h1>
          <p style={{ fontSize: 12.5, color: T.textGray, margin: "4px 0 0", maxWidth: 760, lineHeight: 1.55 }}>
            Who has to do what, for which case or exhibit, by when — and where it has got to.
            {scopeBasis && <> <strong style={{ color: T.navy }}>Your scope:</strong> {scopeBasis}</>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("all", "All Tasks")}
          {tabBtn("mine", "My Tasks")}
          {tabBtn("new", "Assign Task")}
        </div>
      </div>

      {refError && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: T.red }}>
          {refError}
        </div>
      )}

      {reference && !reference.scope.hasPersonnelRecord && (
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.45)", borderRadius: 6, padding: "10px 12px" }}>
          <AlertTriangle style={{ width: 15, height: 15, color: T.gold, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.textGray, lineHeight: 1.55 }}>
            <strong style={{ color: T.navy }}>No personnel record is linked to this account.</strong> Scope is
            derived from the Employee record behind your login, so tasks assigned to you will not appear and
            you cannot assign to anyone but yourself. An administrator can link the account to its Employee ID.
          </div>
        </div>
      )}

      {/* ══ LISTS ═══════════════════════════════════════════════════════════ */}
      {(tab === "all" || tab === "mine") && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {kpi("My Tasks", summary?.mine ?? 0, T.navy, tab === "mine", () => setTab("mine"))}
            {kpi("Assigned", summary?.assigned ?? 0, T.navy)}
            {kpi("In Progress", summary?.inProgress ?? 0, "#7c3aed")}
            {kpi("Due Today", summary?.dueToday ?? 0, (summary?.dueToday ?? 0) ? T.gold : T.green,
              dueFilter === "TODAY", () => setDueFilter((d) => (d === "TODAY" ? "ALL" : "TODAY")))}
            {kpi("Overdue", summary?.overdue ?? 0, (summary?.overdue ?? 0) ? T.red : T.green,
              dueFilter === "OVERDUE", () => setDueFilter((d) => (d === "OVERDUE" ? "ALL" : "OVERDUE")))}
            {kpi("Completed", summary?.completed ?? 0, T.green)}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All statuses</option>
              {["ASSIGNED", "ACKNOWLEDGED", "IN_PROGRESS", "ON_HOLD", "OVERDUE", "COMPLETED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All priorities</option>
              {(reference?.priorities || []).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p] || p}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All task types</option>
              {(reference?.taskTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All officers</option>
              {(reference?.officers || []).map((o) => (
                <option key={o.employeeId} value={String(o.employeeId)}>{o.name}</option>
              ))}
            </select>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search task number, title, officer, case…"
              style={{ ...input, flex: "1 1 220px", minWidth: 180, width: "auto" }} />
            <button onClick={() => void load()} disabled={loading} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "#fff",
              border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 14px",
              fontSize: 12.5, fontWeight: 600, color: T.navy, cursor: loading ? "default" : "pointer",
            }}>
              <RefreshCw style={{ width: 14, height: 14 }} />{loading ? "Reading…" : "Refresh"}
            </button>
          </div>

          {/*
            An API failure and an empty result are different things and must not
            look the same. A connection problem offers Retry; an empty scope
            says so plainly.
          */}
          {loadError ? (
            <div style={{ ...card, textAlign: "center", padding: 40 }}>
              <AlertTriangle style={{ width: 34, height: 34, color: T.red, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T.navy }}>Unable to load tasks</div>
              <div style={{ fontSize: 12.5, color: T.textGray, margin: "5px 0 14px" }}>{loadError}</div>
              <button onClick={() => void load()} style={{
                background: T.navy, color: "#fff", border: "none", borderRadius: 6,
                padding: "9px 20px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}>Retry</button>
            </div>
          ) : (
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {visible.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <Inbox style={{ width: 34, height: 34, color: T.textMuted, margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: T.navy }}>
                    {!loaded ? "Reading tasks…" : tasks.length === 0 ? "No tasks found" : "No task matches these filters"}
                  </div>
                  {loaded && tasks.length === 0 && (
                    <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 5, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
                      No tasks are currently available within your authorized scope.
                    </div>
                  )}
                </div>
              ) : (
                visible.map((t) => {
                  const isOpen = openTask === t.taskNumber;
                  const st = t.displayStatus;
                  return (
                    <div key={t.taskNumber} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <button onClick={() => void expand(t.taskNumber)} style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                        background: isOpen ? "rgba(0,31,63,0.03)" : "none", border: "none", textAlign: "left", cursor: "pointer",
                      }}>
                        <span style={{
                          background: PRIORITY_COLOR[t.priority] || T.textMuted, color: "#fff", fontSize: 9,
                          fontWeight: 800, padding: "3px 8px", borderRadius: 10, fontFamily: ORCA_MONO, flexShrink: 0,
                        }}>{t.priority}</span>
                        <span style={{ fontFamily: ORCA_MONO, fontSize: 11.5, color: T.textGray, flexShrink: 0 }}>{t.taskNumber}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.navy, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.title}
                        </span>
                        {t.caseMasterId !== null && (
                          <span style={{ fontSize: 10.5, fontFamily: ORCA_MONO, color: T.textMuted, flexShrink: 0 }}>CASE #{t.caseMasterId}</span>
                        )}
                        <span style={{ fontSize: 11.5, color: T.textGray, flexShrink: 0, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.assignedToName || "—"}
                        </span>
                        <span style={{ fontSize: 11, color: t.overdue ? T.red : T.textMuted, flexShrink: 0, fontWeight: t.overdue ? 700 : 400 }}>
                          {t.dueDate ? pretty(t.dueDate).split(",")[0] : "no due date"}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 800, fontFamily: ORCA_MONO,
                          color: STATUS_COLOR[st] || T.textMuted,
                          border: `1px solid ${STATUS_COLOR[st] || T.border}`,
                          borderRadius: 10, padding: "2px 8px", flexShrink: 0,
                        }}>{STATUS_LABELS[st] || st}</span>
                        <ChevronDown style={{ width: 15, height: 15, color: T.textMuted }} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* ══ TASK DETAIL MODAL ══════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          onClick={() => { setModalOpen(false); setOpenTask(""); setDetail(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,15,31,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680,
              maxHeight: "88vh", overflowY: "auto",
              boxShadow: "0 24px 80px rgba(0,0,0,0.32)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 22px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, fontFamily: ORCA_MONO, color: T.textMuted, letterSpacing: "0.06em", marginBottom: 2 }}>TASK DETAILS</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.navy }}>
                  {detail?.task.title ?? openTask}
                </div>
              </div>
              <button
                onClick={() => { setModalOpen(false); setOpenTask(""); setDetail(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal body — reuse TaskProfile */}
            <div style={{ flex: 1 }}>
              <TaskProfile
                detail={detail}
                loading={detailLoading}
                myEmployeeId={myEmployeeId}
                officers={reference?.officers || []}
                busy={actionBusy}
                error={actionError}
                completionNotes={completionNotes}
                setCompletionNotes={setCompletionNotes}
                remarks={actionRemarks}
                setRemarks={setActionRemarks}
                reassignTo={reassignTo}
                setReassignTo={setReassignTo}
                checklist={workChecklist}
                setChecklist={setWorkChecklist}
                deliverables={workDeliverables}
                setDeliverables={setWorkDeliverables}
                onAct={act}
                onReassign={doReassign}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ ASSIGN ══════════════════════════════════════════════════════════ */}
      {tab === "new" && (created ? (
        <div style={{ ...card, maxWidth: 620 }}>
          <CheckCircle2 style={{ width: 40, height: 40, color: T.green, marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 800, color: T.navy, margin: "0 0 6px" }}>Task Assigned</h3>
          <div style={{ background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.5)", borderRadius: 6, padding: "12px 14px", margin: "12px 0 16px" }}>
            <div style={{ ...label, fontSize: 9 }}>TASK NUMBER</div>
            <code style={{ fontFamily: ORCA_MONO, fontSize: 17, fontWeight: 800, color: T.navy }}>{created}</code>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={resetForm} style={{ background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Assign another</button>
            <button onClick={() => { resetForm(); setTab("all"); }} style={{ background: "transparent", color: T.navy, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>View tasks</button>
          </div>
        </div>
      ) : (
        <>
          {/* Six steps. Not seven. */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 6,
                border: `1px solid ${i === step ? T.navy : T.border}`,
                background: i === step ? T.navy : i < step ? "rgba(16,185,129,0.08)" : "#fff",
                color: i === step ? "#fff" : i < step ? T.green : T.textMuted,
                fontSize: 11, fontWeight: 700, fontFamily: ORCA_MONO,
                cursor: i < step ? "pointer" : "default",
              }}>
                <span>{String(i + 1).padStart(2, "0")}</span>{s}
              </button>
            ))}
          </div>

          <div style={card}>
            {step === 0 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 4px" }}>Which case?</h3>
                <p style={{ ...hint, margin: "0 0 14px" }}>
                  Link the task to a registered case, or mark it administrative if it stands alone.
                </p>
                <div style={{ maxWidth: 460 }}>
                  <SearchableSelect
                    label="CASE" value={form.caseMasterId}
                    onChange={(v) => setForm({ ...form, caseMasterId: v, noCase: false })}
                    options={caseOptions}
                    emptyMessage="No registered cases within your scope yet."
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, fontSize: 12.5, color: T.textGray, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.noCase}
                    onChange={(e) => setForm({ ...form, noCase: e.target.checked, caseMasterId: e.target.checked ? "" : form.caseMasterId })} />
                  This is an administrative task with no case
                </label>
                {form.evidenceId && (
                  <div style={{ marginTop: 12, fontSize: 12, color: T.textGray }}>
                    Linked to exhibit <strong style={{ fontFamily: ORCA_MONO, color: T.navy }}>#{form.evidenceId}</strong>
                  </div>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 14px" }}>Task details</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
                  {fld(<>
                    <label style={label}>TASK TYPE *</label>
                    <select value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}
                      style={{ ...input, color: form.taskType ? T.navy : T.textMuted }}>
                      <option value="" disabled>Select a task type…</option>
                      {(reference?.taskTypes || []).map((t) => <option key={t} value={t} style={{ color: T.navy }}>{t}</option>)}
                    </select>
                  </>)}
                  {fld(<>
                    <label style={label}>TITLE *</label>
                    <input type="text" maxLength={LIMITS.title} value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Collect CCTV footage from the bus stand" style={input} />
                  </>)}
                </div>
                <div style={{ marginTop: 14 }}>
                  {fld(<>
                    <label style={label}>DESCRIPTION *</label>
                    <textarea rows={4} maxLength={LIMITS.description} value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="What exactly needs doing, and anything the officer needs to know."
                      style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
                  </>)}
                </div>
                <div style={{ marginTop: 14 }}>
                  {fld(<>
                    <label style={label}>EXPECTED OUTCOME (OPTIONAL)</label>
                    <textarea rows={2} maxLength={LIMITS.expectedOutcome} value={form.expectedOutcome}
                      onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })}
                      placeholder="What good looks like when this is done." style={{ ...input, resize: "vertical" }} />
                  </>)}
                </div>

                <ItemEditor
                  title="CHECKLIST (OPTIONAL)"
                  placeholder="Add a step…"
                  items={checklist.map((c) => ({ id: c.id, text: c.title }))}
                  onAdd={(text) => setChecklist((p) => [...p, { id: rid(), title: text, completed: false, completedAt: "", completedBy: "" }])}
                  onRemove={(id) => setChecklist((p) => p.filter((x) => x.id !== id))}
                  max={LIMITS.checklistItems}
                />
                <ItemEditor
                  title="REQUIRED DELIVERABLES (OPTIONAL)"
                  placeholder="e.g. Investigation report"
                  items={deliverables.map((d) => ({ id: d.id, text: d.name }))}
                  onAdd={(text) => setDeliverables((p) => [...p, { id: rid(), name: text, required: true, submitted: false, submittedAt: "" }])}
                  onRemove={(id) => setDeliverables((p) => p.filter((x) => x.id !== id))}
                  max={LIMITS.deliverables}
                />
              </>
            )}

            {step === 2 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 4px" }}>Who is it for?</h3>
                <p style={{ ...hint, margin: "0 0 14px" }}>
                  {reference?.scope.basis || "Officers within your assignment scope."}
                </p>
                <div style={{ maxWidth: 460 }}>
                  <SearchableSelect
                    label="ASSIGN TO" required value={form.assignedToEmployeeId}
                    onChange={(v) => setForm({ ...form, assignedToEmployeeId: v })}
                    options={officerOptions}
                    emptyMessage="No officers within your assignment scope."
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 14px" }}>Priority &amp; handling</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
                  {fld(<>
                    <label style={label}>PRIORITY *</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      style={{ ...input, color: form.priority ? T.navy : T.textMuted }}>
                      <option value="" disabled>Select a priority…</option>
                      {(reference?.priorities || []).map((p) => <option key={p} value={p} style={{ color: T.navy }}>{PRIORITY_LABELS[p] || p}</option>)}
                    </select>
                  </>)}
                  {fld(<>
                    <label style={label}>SENSITIVITY</label>
                    <select value={form.sensitivity} onChange={(e) => setForm({ ...form, sensitivity: e.target.value })} style={input}>
                      {(reference?.sensitivities || []).map((s) => <option key={s} value={s}>{SENSITIVITY_LABELS[s] || s}</option>)}
                    </select>
                    <span style={hint}>Recorded and shown. Who may see the task is decided by your unit scope, not by this.</span>
                  </>)}
                  {fld(<>
                    <label style={label}>ESTIMATED EFFORT</label>
                    <select value={form.estimatedEffort} onChange={(e) => setForm({ ...form, estimatedEffort: e.target.value })}
                      style={{ ...input, color: form.estimatedEffort ? T.navy : T.textMuted }}>
                      <option value="">Not estimated</option>
                      {(reference?.efforts || []).map((e) => <option key={e} value={e} style={{ color: T.navy }}>{e}</option>)}
                    </select>
                  </>)}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 14px" }}>When &amp; where</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
                  {fld(<>
                    <label style={label}>DUE DATE *</label>
                    <input type="datetime-local" value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={input} />
                    <span style={hint}>A task past its due date is shown as overdue automatically — nobody marks it.</span>
                  </>)}
                  {fld(<>
                    <label style={label}>DEPENDS ON TASK (OPTIONAL)</label>
                    <input type="text" value={form.dependencyTaskNumber}
                      onChange={(e) => setForm({ ...form, dependencyTaskNumber: e.target.value })}
                      placeholder="TASK-2026-00001" style={{ ...input, fontFamily: ORCA_MONO }} />
                  </>)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                  {fld(<>
                    <label style={label}>TASK LOCATION (OPTIONAL)</label>
                    <input type="text" maxLength={LIMITS.address} value={form.locationAddress}
                      onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
                      placeholder="Where the work is to be done" style={input} />
                  </>)}
                  {fld(<><label style={label}>LATITUDE</label>
                    <input type="text" value={form.locationLatitude} onChange={(e) => setForm({ ...form, locationLatitude: e.target.value })} style={input} /></>)}
                  {fld(<><label style={label}>LONGITUDE</label>
                    <input type="text" value={form.locationLongitude} onChange={(e) => setForm({ ...form, locationLongitude: e.target.value })} style={input} /></>)}
                </div>
                <p style={{ ...hint, marginTop: 8 }}>
                  Separate from the FIR and exhibit locations — this is where the officer has to go.
                </p>
              </>
            )}

            {step === 5 && (
              <>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 14px" }}>Review</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                  {([
                    ["CASE", form.noCase ? "Administrative — no case" : caseOptions.find((c) => c.id === form.caseMasterId)?.label || "—"],
                    ["TASK TYPE", form.taskType],
                    ["TITLE", form.title],
                    ["ASSIGNED TO", officerOptions.find((o) => o.id === form.assignedToEmployeeId)?.label || "—"],
                    ["PRIORITY", PRIORITY_LABELS[form.priority] || "—"],
                    ["SENSITIVITY", SENSITIVITY_LABELS[form.sensitivity] || form.sensitivity],
                    ["EFFORT", form.estimatedEffort || "not estimated"],
                    ["DUE", form.dueDate ? pretty(form.dueDate) : "—"],
                    ["CHECKLIST", checklist.length ? `${checklist.length} step(s)` : "none"],
                    ["DELIVERABLES", deliverables.length ? `${deliverables.length} item(s)` : "none"],
                  ] as const).map(([k, v]) => (
                    <div key={k}>
                      <div style={label}>{k}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.navy, marginTop: 2, overflowWrap: "anywhere" }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={label}>DESCRIPTION</div>
                  <pre style={{ margin: "5px 0 0", padding: "10px 12px", background: "#fafbfc", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5, color: T.navy, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    {form.description}
                  </pre>
                </div>
              </>
            )}
          </div>

          {formError && (
            <div role="alert" style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: T.red, fontWeight: 600 }}>
              {formError}
            </div>
          )}

          {draftDirty && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.45)", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: T.textGray, lineHeight: 1.5 }}>
              <span aria-hidden="true">⚠</span>
              <span><strong style={{ color: T.navy }}>Draft not yet assigned.</strong> Nothing is saved until you press Assign Task.</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 9 }}>
            {step > 0 && (
              <button onClick={() => { setFormError(""); setStep((s) => s - 1); }} style={{
                background: "transparent", color: T.navy, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button onClick={nextStep} style={{
                background: T.navy, color: "#fff", border: "none", borderRadius: 6,
                padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Next</button>
            ) : (
              <button onClick={() => void submit()} disabled={saving} style={{
                background: saving ? T.textMuted : T.navy, color: "#fff", border: "none", borderRadius: 6,
                padding: "10px 26px", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
              }}>{saving ? "Assigning…" : "Assign Task"}</button>
            )}
          </div>
        </>
      ))}
    </div>
  );
};

// ── Small editor for checklist / deliverable rows ──────────────────────────
function ItemEditor({ title, placeholder, items, onAdd, onRemove, max }: {
  title: string; placeholder: string; max: number;
  items: { id: string; text: string }[];
  onAdd: (text: string) => void; onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.length >= max) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={label}>{title}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder} style={{ ...input, flex: 1 }} />
        <button type="button" onClick={add} disabled={!draft.trim() || items.length >= max} style={{
          display: "inline-flex", alignItems: "center", gap: 5, background: "#fff",
          border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 13px",
          fontSize: 12, fontWeight: 600, color: T.navy,
          cursor: !draft.trim() || items.length >= max ? "not-allowed" : "pointer",
        }}><Plus style={{ width: 13, height: 13 }} /> Add</button>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fafbfc", border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 11px" }}>
              <span style={{ flex: 1, fontSize: 12.5, color: T.navy }}>{it.text}</span>
              <button type="button" onClick={() => onRemove(it.id)} title="Remove"
                style={{ background: "none", border: "none", cursor: "pointer", color: T.red, display: "flex" }}>
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task profile: detail, timeline, actions ────────────────────────────────
function TaskProfile(props: {
  detail: { task: Task; audit: any[] } | null;
  loading: boolean;
  myEmployeeId: number | null;
  officers: AssignableOfficer[];
  busy: boolean;
  error: string;
  completionNotes: string; setCompletionNotes: (v: string) => void;
  remarks: string; setRemarks: (v: string) => void;
  reassignTo: string; setReassignTo: (v: string) => void;
  checklist: ChecklistItem[]; setChecklist: (v: ChecklistItem[]) => void;
  deliverables: Deliverable[]; setDeliverables: (v: Deliverable[]) => void;
  onAct: (status: string) => void;
  onReassign: () => void;
}) {
  const { detail, loading, myEmployeeId, officers, busy, error } = props;
  const [showReassign, setShowReassign] = useState(false);

  if (loading || !detail) {
    return (
      <div style={{ padding: "32px 22px 36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @keyframes __ta_l4 { to { clip-path: inset(0 -1ch 0 0); } }
          .__ta_loader {
            width: fit-content;
            font-weight: bold;
            font-family: monospace;
            font-size: 22px;
            color: #001f3f;
            clip-path: inset(0 3ch 0 0);
            animation: __ta_l4 1s steps(4) infinite;
          }
          .__ta_loader::before { content: "Loading..."; }
        `}</style>
        <div className="__ta_loader" />
      </div>
    );
  }
  const t = detail.task;
  const isAssignee = myEmployeeId !== null && t.assignedToEmployeeId === myEmployeeId;

  /*
   * Only actions the task can actually take, given its state and who is
   * looking. Offering "Complete" on a cancelled task, or "Acknowledge" to
   * someone it was never assigned to, invites a click that the server will
   * refuse — and teaches officers the buttons lie.
   */
  const canAck = t.status === "ASSIGNED" && isAssignee;
  const canStart = (t.status === "ASSIGNED" || t.status === "ACKNOWLEDGED" || t.status === "ON_HOLD") && isAssignee;
  const canComplete = t.status === "IN_PROGRESS";
  const canHold = t.status === "ASSIGNED" || t.status === "ACKNOWLEDGED" || t.status === "IN_PROGRESS";
  const canCancel = t.status !== "COMPLETED" && t.status !== "CANCELLED";
  const isTerminal = t.status === "COMPLETED" || t.status === "CANCELLED";

  const cp = checklistProgress(props.checklist);
  const dp = deliverableProgress(props.deliverables);

  const btn = (text: string, onClick: () => void, primary = false) => (
    <button onClick={onClick} disabled={busy} style={{
      background: primary ? T.navy : "#fff", color: primary ? "#fff" : T.navy,
      border: primary ? "none" : `1px solid ${T.border}`, borderRadius: 6,
      padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: busy ? "wait" : "pointer",
    }}>{text}</button>
  );

  return (
    <div style={{ padding: "0 16px 18px", background: "rgba(0,31,63,0.02)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 14 }}>
        {([
          ["TASK TYPE", t.taskType],
          ["CASE", t.caseMasterId !== null ? `#${t.caseMasterId}` : "Administrative — no case"],
          ["EVIDENCE", t.evidenceId !== null ? `#${t.evidenceId}` : "—"],
          ["ASSIGNED BY", t.assignedByName || "—"],
          ["ASSIGNED TO", t.assignedToName || "—"],
          ["UNIT", t.unitName || "—"],
          ["DUE", t.dueDate ? pretty(t.dueDate) : "no due date"],
          ["SENSITIVITY", SENSITIVITY_LABELS[t.sensitivity] || t.sensitivity],
          ["EFFORT", t.estimatedEffort || "not estimated"],
          ["DEPENDS ON", t.dependencyTaskNumber || "—"],
          ["LOCATION", t.locationAddress || "—"],
          ["RAISED", pretty(t.createdAt)],
        ] as const).map(([k, v]) => (
          <div key={k}>
            <div style={label}>{k}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.navy, marginTop: 2, overflowWrap: "anywhere" }}>{v || "—"}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={label}>DESCRIPTION</div>
        <pre style={{ margin: "5px 0 0", padding: "10px 12px", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5, color: T.navy, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {t.description}
        </pre>
      </div>

      {t.expectedOutcome && (
        <div style={{ marginBottom: 14 }}>
          <div style={label}>EXPECTED OUTCOME</div>
          <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 4, lineHeight: 1.55 }}>{t.expectedOutcome}</div>
        </div>
      )}

      {/* Checklist and deliverables — editable while the task is live */}
      {props.checklist.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={label}>CHECKLIST — {cp.done}/{cp.total}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
            {props.checklist.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 11px", fontSize: 12.5, color: T.navy, cursor: isTerminal ? "default" : "pointer" }}>
                <input type="checkbox" checked={c.completed} disabled={isTerminal}
                  onChange={(e) => props.setChecklist(props.checklist.map((x) => x.id === c.id ? { ...x, completed: e.target.checked } : x))} />
                <span style={{ textDecoration: c.completed ? "line-through" : "none", opacity: c.completed ? 0.65 : 1 }}>{c.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {props.deliverables.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={label}>DELIVERABLES — {dp.done}/{dp.total}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
            {props.deliverables.map((d) => (
              <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 11px", fontSize: 12.5, color: T.navy, cursor: isTerminal ? "default" : "pointer" }}>
                <input type="checkbox" checked={d.submitted} disabled={isTerminal}
                  onChange={(e) => props.setDeliverables(props.deliverables.map((x) => x.id === d.id ? { ...x, submitted: e.target.checked } : x))} />
                <span style={{ textDecoration: d.submitted ? "line-through" : "none", opacity: d.submitted ? 0.65 : 1 }}>{d.name}</span>
                {d.required && !d.submitted && (
                  <span style={{ fontSize: 9, fontFamily: ORCA_MONO, color: T.gold, marginLeft: "auto" }}>REQUIRED</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {t.completionNotes && (
        <div style={{ marginBottom: 14 }}>
          <div style={label}>COMPLETION NOTES</div>
          <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 4, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{t.completionNotes}</div>
        </div>
      )}

      {/* Timeline, straight from the audit log */}
      <div style={{ marginBottom: 14 }}>
        <div style={label}>TASK TIMELINE</div>
        {detail.audit.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 5 }}>No recorded activity.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 7 }}>
            {detail.audit.map((a) => (
              <div key={a.auditId} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 11.5, color: T.textGray, borderLeft: `2px solid ${T.border}`, paddingLeft: 10 }}>
                <span style={{ fontFamily: ORCA_MONO, fontSize: 10, color: T.textMuted, flexShrink: 0, minWidth: 132 }}>{pretty(a.occurredAt)}</span>
                <span>
                  <strong style={{ color: T.navy }}>{a.action}</strong>
                  {a.previousState && a.newState ? ` · ${a.previousState} → ${a.newState}` : a.newState ? ` · ${a.newState}` : ""}
                  {a.remarks ? ` — ${a.remarks}` : ""}
                  {a.actorName ? <span style={{ color: T.textMuted }}> · {a.actorName}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 6, padding: "9px 12px", fontSize: 12, color: T.red, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {!isTerminal && (
        <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: 14 }}>
          {canComplete && (
            <div style={{ marginBottom: 12 }}>
              <label style={label}>COMPLETION NOTES *</label>
              <textarea rows={3} maxLength={LIMITS.completionNotes} value={props.completionNotes}
                onChange={(e) => props.setCompletionNotes(e.target.value)}
                placeholder="What was done, and what came of it."
                style={{ ...input, resize: "vertical", marginTop: 4 }} />
              {dp.requiredOpen > 0 && (
                <div style={{ ...hint, color: T.gold, marginTop: 5 }}>
                  {dp.requiredOpen} required deliverable(s) not yet submitted. You can still complete — the gap is
                  recorded in the task history.
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={label}>REMARKS</label>
            <input type="text" maxLength={LIMITS.remarks} value={props.remarks}
              onChange={(e) => props.setRemarks(e.target.value)}
              placeholder="Required to cancel or reassign" style={{ ...input, marginTop: 4 }} />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canAck && btn("Acknowledge", () => props.onAct("ACKNOWLEDGED"), true)}
            {canStart && btn(t.status === "ON_HOLD" ? "Resume" : "Start", () => props.onAct("IN_PROGRESS"), !canAck)}
            {canComplete && btn("Complete Task", () => props.onAct("COMPLETED"), true)}
            {canHold && t.status !== "ON_HOLD" && btn("Put On Hold", () => props.onAct("ON_HOLD"))}
            {canCancel && btn("Cancel Task", () => props.onAct("CANCELLED"))}
            <button onClick={() => setShowReassign((v) => !v)} disabled={busy} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "#fff",
              border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 16px",
              fontSize: 12.5, fontWeight: 700, color: T.navy, cursor: "pointer",
            }}><UserCog style={{ width: 14, height: 14 }} /> Reassign</button>
          </div>

          {showReassign && (
            <div style={{ marginTop: 12, borderTop: `1px dashed ${T.border}`, paddingTop: 12, display: "flex", gap: 9, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px" }}>
                <label style={label}>REASSIGN TO</label>
                <select value={props.reassignTo} onChange={(e) => props.setReassignTo(e.target.value)}
                  style={{ ...input, marginTop: 4, color: props.reassignTo ? T.navy : T.textMuted }}>
                  <option value="" disabled>Select an officer…</option>
                  {officers.filter((o) => o.employeeId !== t.assignedToEmployeeId).map((o) => (
                    <option key={o.employeeId} value={String(o.employeeId)} style={{ color: T.navy }}>
                      {o.name}{o.unitName ? ` — ${o.unitName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={props.onReassign} disabled={busy || !props.reassignTo} style={{
                background: busy || !props.reassignTo ? T.textMuted : T.navy, color: "#fff",
                border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 12.5, fontWeight: 700,
                cursor: busy || !props.reassignTo ? "not-allowed" : "pointer",
              }}>Confirm Reassignment</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
