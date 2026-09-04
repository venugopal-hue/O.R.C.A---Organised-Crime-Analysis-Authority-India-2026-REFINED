"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Trash2, CheckCheck, RefreshCw, ArrowRight } from "lucide-react";
import { useIntelligence } from "@/context/IntelligenceContext";
import type { NotificationItem, NotifLevel } from "@/app/api/notifications/route";

const CAT_TAB: Record<string, string> = {
  task:     "tasks",
  bail:     "bail-remand",
  deadline: "court-deadlines",
};

const CAT_LABEL: Record<string, string> = {
  task:     "Task",
  bail:     "Bail & Remand",
  deadline: "Court Deadline",
};

const CAT_ICON: Record<string, string> = {
  task:     "📋",
  bail:     "⚖️",
  deadline: "📅",
};

const LEVEL_COLOR: Record<NotifLevel, string> = {
  critical: "#dc2626",
  warning:  "#d97706",
  info:     "#2563eb",
};

const LEVEL_BG: Record<NotifLevel, string> = {
  critical: "#fef2f2",
  warning:  "#fffbeb",
  info:     "#eff6ff",
};

const LEVEL_BORDER: Record<NotifLevel, string> = {
  critical: "#fecaca",
  warning:  "#fde68a",
  info:     "#bfdbfe",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STORAGE_KEY = "orca_notif_dismissed_v1";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveDismissed(s: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])); } catch {}
}

export function NotificationBell() {
  const { setActiveTab } = useIntelligence();
  const [open, setOpen]         = useState(false);
  const [items, setItems]       = useState<NotificationItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [read, setRead]         = useState<Set<string>>(new Set());
  const panelRef                = useRef<HTMLDivElement>(null);

  // Load persisted dismissed list on mount
  useEffect(() => { setDismissed(loadDismissed()); }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const data = await res.json();
      if (data?.items) setItems(data.items);
    } catch { /* keep stale */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);
  useEffect(() => {
    const t = setInterval(fetchItems, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchItems]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const persist = (next: Set<string>) => { setDismissed(next); saveDismissed(next); };

  const visible = items.filter(i => !dismissed.has(i.id));
  const unread  = visible.filter(i => !read.has(i.id)).length;

  const dismiss  = (id: string) => persist(new Set([...dismissed, id]));
  const clearAll = () => persist(new Set(items.map(i => i.id)));
  const markAllRead = () => setRead(new Set(visible.map(i => i.id)));

  const go = (item: NotificationItem) => {
    setRead(r => new Set([...r, item.id]));
    const tab = CAT_TAB[item.category];
    if (tab) { setActiveTab(tab); setOpen(false); }
  };

  return (
    <div ref={panelRef} style={{ position: "relative", flexShrink: 0 }}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) void fetchItems(); }}
        title="Notifications"
        style={{
          width: 28, height: 28, borderRadius: "50%", position: "relative",
          border: open ? "1.5px solid #FF9933" : "1.5px solid rgba(255,255,255,0.35)",
          background: open ? "rgba(255,153,51,0.12)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: open ? "#FF9933" : "rgba(255,255,255,0.75)",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#FF9933";
          (e.currentTarget as HTMLElement).style.color = "#FF9933";
          (e.currentTarget as HTMLElement).style.background = "rgba(255,153,51,0.1)";
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.35)";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }
        }}
      >
        <Bell style={{ width: 14, height: 14 }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            width: 12, height: 12, borderRadius: "50%",
            background: "#dc2626",
            border: "2px solid #002855",
            animation: "bellpulse 1.8s ease-in-out infinite",
          }} />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: 42, right: 0, zIndex: 9999,
          width: 420, maxHeight: 580,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "Inter, sans-serif",
        }}>

          {/* Header */}
          <div style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid #f1f5f9",
            background: "#fff",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: "#fff7ed", border: "1px solid #fed7aa",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bell style={{ width: 16, height: 16, color: "#ea580c" }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Notifications</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                    {visible.length === 0 ? "No active alerts" : `${unread} unread · ${visible.length} total`}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {visible.length > 0 && <>
                  <TopBtn title="Mark all read" onClick={markAllRead}><CheckCheck size={14} /></TopBtn>
                  <TopBtn title="Clear all" onClick={clearAll}><Trash2 size={14} /></TopBtn>
                </>}
                <TopBtn title="Refresh" onClick={fetchItems}
                  style={{ animation: loading ? "spin .7s linear infinite" : "none" }}>
                  <RefreshCw size={14} />
                </TopBtn>
                <TopBtn title="Close" onClick={() => setOpen(false)}><X size={14} /></TopBtn>
              </div>
            </div>

            {/* Summary pills */}
            {visible.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["critical", "warning"] as NotifLevel[]).map(l => {
                  const count = visible.filter(i => i.level === l).length;
                  if (!count) return null;
                  return (
                    <span key={l} style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: LEVEL_BG[l], color: LEVEL_COLOR[l],
                      border: `1px solid ${LEVEL_BORDER[l]}`,
                    }}>
                      {l === "critical" ? "🔴" : "🟡"} {count} {l}
                    </span>
                  );
                })}
                {(["task", "bail", "deadline"] as const).map(cat => {
                  const count = visible.filter(i => i.category === cat).length;
                  if (!count) return null;
                  return (
                    <span key={cat} style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0",
                    }}>
                      {CAT_ICON[cat]} {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {!loading && visible.length === 0 && (
              <div style={{ padding: "52px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>All clear</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No overdue tasks, bail expiry or deadline alerts.</div>
              </div>
            )}

            {visible.map((item, idx) => {
              const isRead = read.has(item.id);
              const col    = LEVEL_COLOR[item.level];
              const bg     = LEVEL_BG[item.level];
              const border = LEVEL_BORDER[item.level];
              return (
                <div
                  key={item.id}
                  style={{
                    margin: "10px 14px",
                    borderRadius: 12,
                    border: `1px solid ${isRead ? "#e2e8f0" : border}`,
                    background: isRead ? "#f8fafc" : bg,
                    overflow: "hidden",
                    transition: "all .2s",
                  }}
                >
                  <div style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>

                    {/* Icon */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      background: isRead ? "#f1f5f9" : `${col}18`,
                      border: `1px solid ${isRead ? "#e2e8f0" : `${col}33`}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                    }}>
                      {CAT_ICON[item.category]}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        {!isRead && (
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                        )}
                        <span style={{
                          fontSize: 14, fontWeight: 700,
                          color: isRead ? "#475569" : "#0f172a",
                        }}>{item.title}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55, marginBottom: 8 }}>
                        {item.detail}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                          color: col, background: `${col}15`,
                          padding: "2px 8px", borderRadius: 6, border: `1px solid ${col}30`,
                          textTransform: "uppercase",
                        }}>{item.level}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>{CAT_LABEL[item.category]}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>{fmtDate(item.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div style={{
                    borderTop: `1px solid ${isRead ? "#e2e8f0" : border}`,
                    display: "flex",
                    background: isRead ? "#f1f5f9" : `${col}08`,
                  }}>
                    <button
                      onClick={() => go(item)}
                      style={{
                        flex: 1, padding: "9px 14px", fontSize: 13, fontWeight: 600,
                        color: col, background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        borderRight: `1px solid ${isRead ? "#e2e8f0" : border}`,
                      }}
                    >
                      Go to {CAT_LABEL[item.category]} <ArrowRight size={13} />
                    </button>
                    <button
                      onClick={() => dismiss(item.id)}
                      title="Dismiss"
                      style={{
                        padding: "9px 16px", fontSize: 13, color: "#94a3b8",
                        background: "none", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <X size={13} /> Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{ height: 10 }} />
          </div>

          {/* Footer */}
          <div style={{
            padding: "10px 20px", borderTop: "1px solid #f1f5f9",
            background: "#f8fafc", flexShrink: 0,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Refreshes every 5 min · Dismissals saved</span>
          </div>
        </div>
      )}

      <style>{`
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes bellpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
`}</style>
    </div>
  );
}

function TopBtn({ children, onClick, title, style: extraStyle }: {
  children: React.ReactNode; onClick: () => void; title: string; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 30, borderRadius: 8,
        border: "1px solid #e2e8f0", background: "#f8fafc",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#64748b", transition: "all .15s", ...extraStyle,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "#f1f5f9";
        (e.currentTarget as HTMLElement).style.color = "#1e293b";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "#f8fafc";
        (e.currentTarget as HTMLElement).style.color = "#64748b";
      }}
    >{children}</button>
  );
}
