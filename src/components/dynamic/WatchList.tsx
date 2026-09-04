"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, PlusCircle, X, FileText, Eye } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { WatchEntry } from "@/app/api/watch-list/route";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useFIROptions } from "@/hooks/useFIROptions";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

const THREAT_META: Record<string, { bg: string; col: string; dot: string }> = {
  HIGH:   { bg: "#fef2f2", col: "#991b1b", dot: "#dc2626" },
  MEDIUM: { bg: "#fff7ed", col: "#9a3412", dot: "#f97316" },
  LOW:    { bg: "#f0fdf4", col: "#15803d", dot: "#22c55e" },
};

const STATUS_META: Record<string, { bg: string; col: string; label: string }> = {
  ACTIVE:    { bg: "#fef9c3", col: "#854d0e", label: "Active"    },
  CLOSED:    { bg: "#f8fafc", col: "#475569", label: "Closed"    },
  ESCALATED: { bg: "#fef2f2", col: "#991b1b", label: "Escalated" },
};

const EMPTY_FORM = {
  personName: "", age: "", gender: "Male", address: "",
  threatLevel: "MEDIUM", reason: "", linkedCrimeNo: "",
  startDate: new Date().toISOString().substring(0, 10), reviewDate: "",
};

function ThreatBadge({ level }: { level: string }) {
  const m = THREAT_META[level] || THREAT_META.MEDIUM;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: m.bg, color: m.col }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {level} THREAT
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.ACTIVE;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>{m.label}</span>;
}

function DetailModal({ entry, onClose }: { entry: WatchEntry; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
        <div style={{ background: NAVY, padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderRadius: "14px 14px 0 0" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Watch List Entry</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "JetBrains Mono, monospace" }}>{entry.watchNo}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>{entry.personName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            <ThreatBadge level={entry.threatLevel} />
            <StatusChip status={entry.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
            <F label="Age" value={entry.age || "—"} />
            <F label="Gender" value={entry.gender} />
            <F label="Address" value={entry.address || "—"} />
            <F label="Linked FIR" value={entry.linkedCrimeNo || "—"} mono />
            <F label="Watch Since" value={entry.startDate} mono />
            <F label="Review Date" value={entry.reviewDate || "—"} mono />
            <F label="Assigned Officer" value={entry.assignedOfficerName || "—"} />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Reason for Watch</div>
            <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.65, background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>{entry.reason}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: mono ? "JetBrains Mono, monospace" : undefined }}>{value}</div>
    </div>
  );
}

export const WatchListModule: React.FC = () => {
  const [entries, setEntries]       = useState<WatchEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const { firOptions } = useFIROptions();
  const [detail, setDetail]         = useState<WatchEntry | null>(null);
  const [patching, setPatching]     = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/watch-list");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setTableReady(data.tableReady);
      setEntries(data.entries ?? []);
    } catch (e: any) { setError(e.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let rows = entries.filter((e) => e.status === "ACTIVE" || e.status === "ESCALATED");
    if (threatFilter !== "ALL") rows = rows.filter((e) => e.threatLevel === threatFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((e) => e.personName.toLowerCase().includes(q));
    }
    return rows;
  }, [entries, threatFilter, search]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.personName.trim()) { setFormError("Person name is required."); return; }
    if (!form.reason.trim()) { setFormError("Reason is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res  = await fetch("/api/watch-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setShowForm(false); setForm({ ...EMPTY_FORM }); await load();
    } catch (e: any) { setFormError(e.message || "Submission failed."); }
    finally { setSubmitting(false); }
  };

  const patchStatus = async (e: WatchEntry, status: string) => {
    setPatching(e.id);
    try {
      await fetch("/api/watch-list", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowId: e.rowId, status }) });
      await load();
    } finally { setPatching(null); }
  };

  const f = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value })),
  });

  const IS = { width: "100%", padding: "7px 10px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", boxSizing: "border-box" } as React.CSSProperties;
  const LS = { display: "block", fontSize: 10, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } as React.CSSProperties;

  if (!loading && tableReady === false) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "24px 28px", display: "flex", gap: 16 }}>
          <AlertTriangle size={22} color="#92400e" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>WatchList table not found in Catalyst</div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["WatchID — BIGINT","WatchNo — VARCHAR(50)","PersonName — VARCHAR(255)","Age — VARCHAR(20)",
                "Gender — VARCHAR(20)","Address — VARCHAR(255)","ThreatLevel — VARCHAR(10)",
                "Reason — VARCHAR(255)","LinkedCrimeNo — VARCHAR(100)","AssignedOfficerName — VARCHAR(255)",
                "LastVerified — VARCHAR(20)","Status — VARCHAR(20)",
                "CreatedAt — DATETIME","UpdatedAt — DATETIME",
              ].map((c) => <li key={c} style={{ fontFamily: "JetBrains Mono, monospace" }}>{c}</li>)}
            </ul>
            <button onClick={load} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid #fde68a", background: WHITE, color: "#92400e", cursor: "pointer" }}>Re-check</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        <Eye size={15} color={NAVY} />
        {["ALL", "HIGH", "MEDIUM", "LOW"].map((t) => (
          <button key={t} onClick={() => setThreatFilter(t)} style={{
            padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: threatFilter === t ? NAVY : "transparent",
            color: threatFilter === t ? WHITE : GRAY,
            border: `1px solid ${threatFilter === t ? NAVY : BORDER}`,
          }}>{t === "ALL" ? "All Threats" : `${t} (${entries.filter((e) => e.threatLevel === t && e.status === "ACTIVE").length})`}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…"
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", width: 200 }} />
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: "pointer" }}>
          <PlusCircle size={13} /> Add to Watch
        </button>
      </div>

      {loading && <OrcaLoader />}
      {error && !loading && <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}><AlertTriangle size={15} color="#991b1b" /><span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span></div>}
      {!loading && !error && displayed.length === 0 && <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}><Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No active watch subjects</div></div>}

      {!loading && !error && displayed.map((e) => (
        <div key={e.id} style={{
          background: e.threatLevel === "HIGH" ? "#fff5f5" : e.threatLevel === "MEDIUM" ? "#fffbf0" : WHITE,
          borderRadius: 10, marginBottom: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
        }}>
          <div style={{ flexShrink: 0, minWidth: 110 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{e.watchNo}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Since {e.startDate}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{e.personName}</span>
              {e.gender !== "Unknown" && <span style={{ fontSize: 11, color: GRAY }}>{e.gender}{e.age ? `, ${e.age}y` : ""}</span>}
              <ThreatBadge level={e.threatLevel} />
              <StatusChip status={e.status} />
            </div>
            <div style={{ fontSize: 12, color: GRAY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.reason}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {e.status === "ACTIVE" && (
              <select
                disabled={patching === e.id}
                value=""
                onChange={(ev) => { if (ev.target.value) patchStatus(e, ev.target.value); }}
                style={{ padding: "5px 8px", borderRadius: 6, fontSize: 11, border: `1px solid ${BORDER}`, color: GRAY, background: WHITE, cursor: "pointer" }}
              >
                <option value="">Change status…</option>
                <option value="ESCALATED">Escalate</option>
                <option value="CLOSED">Close</option>
              </select>
            )}
            {e.status === "ESCALATED" && (
              <select
                disabled={patching === e.id}
                value=""
                onChange={(ev) => { if (ev.target.value) patchStatus(e, ev.target.value); }}
                style={{ padding: "5px 8px", borderRadius: 6, fontSize: 11, border: `1px solid ${BORDER}`, color: GRAY, background: WHITE, cursor: "pointer" }}
              >
                <option value="">Change status…</option>
                <option value="CLOSED">Close</option>
              </select>
            )}
            <button onClick={() => setDetail(e)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer" }}>
              <FileText size={13} /> View
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Add to Watch List</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Person Name *</label><input {...f("personName")} required style={IS} /></div>
                <div><label style={LS}>Age</label><input {...f("age")} style={IS} /></div>
                <div><label style={LS}>Gender</label><select {...f("gender")} style={IS}>{["Male","Female","Transgender","Unknown"].map((g) => <option key={g}>{g}</option>)}</select></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Address</label><input {...f("address")} style={IS} /></div>
                <div><label style={LS}>Threat Level</label><select {...f("threatLevel")} style={IS}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></div>
                <div>
                  <SearchableSelect
                    label="Linked FIR / Crime No."
                    value={form.linkedCrimeNo}
                    onChange={(v) => setForm((prev) => ({ ...prev, linkedCrimeNo: v }))}
                    options={firOptions}
                    emptyMessage="No FIR records in Catalyst"
                    placeholder="— Search crime number —"
                  />
                </div>
                <div><label style={LS}>Watch Start Date</label><input type="date" {...f("startDate")} style={IS} /></div>
                <div><label style={LS}>Review Date</label><input type="date" {...f("reviewDate")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Reason for Watch *</label><textarea {...f("reason")} required rows={3} style={{ ...IS, resize: "vertical" }} /></div>
              </div>
              {formError && <div style={{ marginTop: 14, display: "flex", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px" }}><AlertTriangle size={13} color="#991b1b" /><span style={{ fontSize: 12, color: "#991b1b" }}>{formError}</span></div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>{submitting ? "Saving…" : "Add to Watch"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {detail && <DetailModal entry={detail} onClose={() => setDetail(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
