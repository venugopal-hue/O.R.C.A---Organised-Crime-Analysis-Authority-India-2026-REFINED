"use client";

import React, { useEffect, useState } from "react";
import { ClipboardList, AlertTriangle } from "lucide-react";
import { ORCA_TOKENS, ORCA_MONO } from "@/lib/theme";
import { useIntelligence } from "@/context/IntelligenceContext";

/**
 * The officer's own workload, in one line on Command Overview.
 *
 * Reads the same authorized endpoint the Task module does, so the figures here
 * and there are the same numbers from the same source — a second count derived
 * a different way is a second count free to disagree.
 *
 * Every figure is real. There is no placeholder path: if the request fails the
 * card says so, and if the officer genuinely has nothing it says that instead.
 */

const T = ORCA_TOKENS;

interface Summary {
  mine: number;
  dueToday: number;
  overdue: number;
  inProgress: number;
}

export const TaskSummaryCard: React.FC = () => {
  const { setActiveTab } = useIntelligence();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tasks");
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.success) throw new Error(j.error || "unavailable");
        setSummary({
          mine: j.summary?.mine ?? 0,
          dueToday: j.summary?.dueToday ?? 0,
          overdue: j.summary?.overdue ?? 0,
          inProgress: j.summary?.inProgress ?? 0,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const figure = (n: number, label: string, colour: string) => (
    <div key={label} style={{ minWidth: 78 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: colour, lineHeight: 1 }}>
        {state === "ready" ? n : "—"}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: T.textGray, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>
        {label}
      </div>
    </div>
  );

  return (
    <div style={{
      background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8,
      padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 150 }}>
        <ClipboardList style={{ width: 16, height: 16, color: T.gold }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.navy, fontFamily: ORCA_MONO, letterSpacing: "0.05em" }}>
          MY TASKS
        </span>
      </div>

      {state === "error" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, fontSize: 12, color: T.textGray }}>
          <AlertTriangle style={{ width: 14, height: 14, color: T.red, flexShrink: 0 }} />
          Task figures are unavailable right now.
        </div>
      ) : state === "ready" && summary && summary.mine === 0 ? (
        <div style={{ flex: 1, fontSize: 12.5, color: T.textGray }}>
          No tasks are assigned to you.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 26, flex: 1, flexWrap: "wrap" }}>
          {figure(summary?.dueToday ?? 0, "Due Today", (summary?.dueToday ?? 0) ? T.gold : T.navy)}
          {figure(summary?.overdue ?? 0, "Overdue", (summary?.overdue ?? 0) ? T.red : T.green)}
          {figure(summary?.inProgress ?? 0, "In Progress", T.navy)}
        </div>
      )}

      <button
        onClick={() => setActiveTab("tasks")}
        style={{
          background: "transparent", color: T.navy, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: "7px 15px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        View All Tasks
      </button>
    </div>
  );
};
