"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, AlertTriangle } from "lucide-react";
import { ORCA_TOKENS, ORCA_MONO } from "@/lib/theme";
import { useIntelligence } from "@/context/IntelligenceContext";
import { STATUS_LABELS } from "@/lib/tasks";

/**
 * The tasks raised against one case or one exhibit.
 *
 * Mounted inside the case ledger and the evidence profile so an officer sees
 * what is outstanding without leaving the record. It shows a COUNT and a list;
 * it does not restate the case or the exhibit, both of which are already on the
 * screen around it.
 *
 * "Assign Task" carries the identifiers across. An officer raising a forensic
 * follow-up on EVD-2026-00124 should never retype that number — retyping is
 * where the wrong exhibit gets attached.
 */

const T = ORCA_TOKENS;

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#b91c1c", HIGH: "#ea580c", NORMAL: "#0369a1", LOW: "#64748b",
};
const STATUS_COLOR: Record<string, string> = {
  ASSIGNED: "#b45309", ACKNOWLEDGED: "#0369a1", IN_PROGRESS: "#7c3aed",
  COMPLETED: "#059669", ON_HOLD: "#64748b", CANCELLED: "#64748b", OVERDUE: "#b91c1c",
};

interface LinkedTask {
  taskNumber: string;
  title: string;
  priority: string;
  status: string;
  displayStatus: string;
  assignedToName: string;
  dueDate: string;
  overdue: boolean;
}

const pretty = (v: string) => {
  if (!v) return "no due date";
  const t = Date.parse(v.includes("T") ? v : v.replace(" ", "T"));
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const LinkedTasks: React.FC<{
  caseMasterId?: number | null;
  evidenceId?: number | null;
  /** Shown on the assign button, e.g. "EVD-2026-00124". */
  contextLabel?: string;
}> = ({ caseMasterId = null, evidenceId = null, contextLabel = "" }) => {
  const { setActiveTab, setTaskPreset } = useIntelligence();
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const q = evidenceId !== null
        ? `evidenceId=${evidenceId}`
        : caseMasterId !== null
        ? `caseMasterId=${caseMasterId}`
        : "";
      const res = await fetch(`/api/tasks${q ? "?" + q : ""}`);
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Could not load tasks.");
      setTasks(j.tasks || []);
      setState("ready");
    } catch (e: any) {
      setError(e?.message || "Could not load tasks.");
      setState("error");
    }
  }, [caseMasterId, evidenceId]);

  useEffect(() => { void load(); }, [load]);

  const openAssign = () => {
    // The identifiers travel with the officer, so nothing is retyped.
    setTaskPreset({ caseMasterId, evidenceId });
    setActiveTab("tasks");
  };

  const active = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const overdue = active.filter((t) => t.overdue);
  const completed = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ClipboardList style={{ width: 15, height: 15, color: T.gold }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.navy, fontFamily: ORCA_MONO, letterSpacing: "0.05em" }}>
            TASKS
          </span>
        </div>
        <button onClick={openAssign} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: T.navy, color: "#fff",
          border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          <Plus style={{ width: 13, height: 13 }} />
          {evidenceId !== null ? "Create Task" : "Assign Task"}
        </button>
      </div>

      {state === "ready" && (
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: tasks.length ? 12 : 0 }}>
          {([
            ["Total", tasks.length, T.navy],
            ["Active", active.length, active.length ? T.gold : T.navy],
            ["Overdue", overdue.length, overdue.length ? T.red : T.green],
            ["Completed", completed.length, T.green],
          ] as const).map(([k, v, c]) => (
            <div key={k}>
              <div style={{ fontSize: 19, fontWeight: 800, color: c as string, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: T.textGray, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{k}</div>
            </div>
          ))}
        </div>
      )}

      {state === "loading" && (
        <div style={{ fontSize: 12.5, color: T.textMuted }}>Reading tasks…</div>
      )}

      {state === "error" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: T.textGray }}>
          <AlertTriangle style={{ width: 14, height: 14, color: T.red, flexShrink: 0, marginTop: 1 }} />
          <span>
            {error}{" "}
            <button onClick={() => void load()} style={{ background: "none", border: "none", color: T.navy, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Retry
            </button>
          </span>
        </div>
      )}

      {state === "ready" && tasks.length === 0 && (
        <div style={{ fontSize: 12.5, color: T.textGray, lineHeight: 1.55 }}>
          No tasks have been raised {evidenceId !== null ? "on this exhibit" : "on this case"} within your
          authorized scope.
        </div>
      )}

      {state === "ready" && tasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t) => (
            <div key={t.taskNumber} style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              background: "#fafbfc", border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 11px",
            }}>
              <span style={{
                background: PRIORITY_COLOR[t.priority] || T.textMuted, color: "#fff", fontSize: 8.5,
                fontWeight: 800, padding: "2px 7px", borderRadius: 9, fontFamily: ORCA_MONO, flexShrink: 0,
              }}>{t.priority}</span>
              <code style={{ fontFamily: ORCA_MONO, fontSize: 10.5, color: T.textGray, flexShrink: 0 }}>{t.taskNumber}</code>
              <span style={{ flex: 1, fontSize: 12.5, color: T.navy, fontWeight: 600, minWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </span>
              <span style={{ fontSize: 11.5, color: T.textGray, flexShrink: 0 }}>{t.assignedToName || "—"}</span>
              <span style={{ fontSize: 11, color: t.overdue ? T.red : T.textMuted, fontWeight: t.overdue ? 700 : 400, flexShrink: 0 }}>
                {pretty(t.dueDate)}
              </span>
              <span style={{
                fontSize: 8.5, fontWeight: 800, fontFamily: ORCA_MONO, flexShrink: 0,
                color: STATUS_COLOR[t.displayStatus] || T.textMuted,
                border: `1px solid ${STATUS_COLOR[t.displayStatus] || T.border}`,
                borderRadius: 9, padding: "2px 7px",
              }}>{STATUS_LABELS[t.displayStatus] || t.displayStatus}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
