"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, PlusCircle, X, FileText, ShieldAlert } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { WantedRecord } from "@/app/api/wanted-persons/route";
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
  WANTED:       { bg: "#fef2f2", col: "#991b1b", label: "Wanted"       },
  APPREHENDED:  { bg: "#f0fdf4", col: "#15803d", label: "Apprehended"  },
  CANCELLED:    { bg: "#f8fafc", col: "#475569", label: "Cancelled"    },
};

const EMPTY_FORM = {
  personName: "", age: "", gender: "Male", lastKnownAddress: "",
  linkedCrimeNo: "", warrantNo: "", courtName: "",
  abscondedSince: new Date().toISOString().substring(0, 10),
  threatLevel: "HIGH", reward: "",
};

function ThreatBadge({ level }: { level: string }) {
  const m = THREAT_META[level] || THREAT_META.MEDIUM;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: m.bg, color: m.col }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />{level}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.WANTED;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>{m.label}</span>;
}

function DetailModal({ record, onClose }: { record: WantedRecord; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
        <div style={{ background: "#7f1d1d", padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderRadius: "14px 14px 0 0" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Wanted / Absconder</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "JetBrains Mono, monospace" }}>{record.wantedNo}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 3, fontWeight: 700 }}>{record.personName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            <ThreatBadge level={record.threatLevel} />
            <StatusChip status={record.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
            <F label="Age" value={record.age || "—"} />
            <F label="Gender" value={record.gender} />
            <F label="Last Known Address" value={record.lastKnownAddress || "—"} />
            <F label="Absconded Since" value={record.abscondedSince} mono />
            <F label="FIR / Crime No." value={record.linkedCrimeNo || "—"} mono />
            <F label="Warrant No." value={record.warrantNo || "—"} mono />
            <F label="Court" value={record.courtName || "—"} />
            <F label="Reward" value={record.reward || "—"} />
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

export const WantedPersons: React.FC = () => {
  const [records, setRecords]       = useState<WantedRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [statusFilter, setStatusFilter] = useState("WANTED");
  const [threatFilter, setThreatFilter] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const { firOptions } = useFIROptions();
  const [detail, setDetail]         = useState<WantedRecord | null>(null);
  const [patching, setPatching]     = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/wanted-persons");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setTableReady(data.tableReady);
      setRecords(data.records ?? []);
    } catch (e: any) { setError(e.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let rows = records;
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (threatFilter !== "ALL") rows = rows.filter((r) => r.threatLevel === threatFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.personName.toLowerCase().includes(q) || r.linkedCrimeNo.toLowerCase().includes(q));
    }
    return rows;
  }, [records, statusFilter, threatFilter, search]);

  const wantedCount = useMemo(() => records.filter((r) => r.status === "WANTED").length, [records]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.personName.trim()) { setFormError("Person name is required."); return; }
    if (!form.linkedCrimeNo.trim()) { setFormError("Crime number is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res  = await fetch("/api/wanted-persons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setShowForm(false); setForm({ ...EMPTY_FORM }); await load();
    } catch (e: any) { setFormError(e.message || "Submission failed."); }
    finally { setSubmitting(false); }
  };

  const patchStatus = async (rec: WantedRecord, status: string) => {
    setPatching(rec.id);
    try {
      await fetch("/api/wanted-persons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowId: rec.rowId, status }) });
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>WantedPerson table not found in Catalyst</div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["WantedID — BIGINT","WantedNo — VARCHAR(50)","PersonName — VARCHAR(255)","Age — VARCHAR(20)",
                "Gender — VARCHAR(20)","LastKnownAddress — VARCHAR(255)","LinkedCrimeNo — VARCHAR(100)",
                "WarrantNo — VARCHAR(100)","CourtName — VARCHAR(255)","AbscondedSince — VARCHAR(20)",
                "ThreatLevel — VARCHAR(10)","Reward — VARCHAR(50)","Status — VARCHAR(20)",
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
      {wantedCount > 0 && (
        <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", marginBottom: 16, alignItems: "center" }}>
          <ShieldAlert size={16} color="#dc2626" />
          <span style={{ fontSize: 13, color: "#991b1b", fontWeight: 700 }}>{wantedCount} person{wantedCount > 1 ? "s" : ""} currently wanted / at large</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        {["ALL", "WANTED", "APPREHENDED", "CANCELLED"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: statusFilter === s ? NAVY : "transparent",
            color: statusFilter === s ? WHITE : GRAY,
            border: `1px solid ${statusFilter === s ? NAVY : BORDER}`,
          }}>{s === "ALL" ? "All" : STATUS_META[s]?.label ?? s}</button>
        ))}
        <span style={{ color: BORDER, fontSize: 14 }}>|</span>
        {["ALL", "HIGH", "MEDIUM", "LOW"].map((t) => (
          <button key={t} onClick={() => setThreatFilter(t)} style={{
            padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: threatFilter === t ? "#7f1d1d" : "transparent",
            color: threatFilter === t ? WHITE : GRAY,
            border: `1px solid ${threatFilter === t ? "#7f1d1d" : BORDER}`,
          }}>{t === "ALL" ? "Any Threat" : t}</button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or FIR…"
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", width: 200 }} />
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: "#7f1d1d", color: WHITE, cursor: "pointer" }}>
          <PlusCircle size={13} /> Add Wanted
        </button>
      </div>

      {loading && <OrcaLoader />}
      {error && !loading && <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}><AlertTriangle size={15} color="#991b1b" /><span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span></div>}
      {!loading && !error && displayed.length === 0 && <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}><Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No records match the current filter</div></div>}

      {!loading && !error && displayed.map((r) => (
        <div key={r.id} style={{
          background: r.status === "WANTED" ? (r.threatLevel === "HIGH" ? "#fff5f5" : "#fffbf0") : WHITE,
          borderRadius: 10, marginBottom: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
        }}>
          <div style={{ flexShrink: 0, minWidth: 110 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{r.wantedNo}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>Since {r.abscondedSince}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{r.personName}</span>
              {r.gender !== "Unknown" && <span style={{ fontSize: 11, color: GRAY }}>{r.gender}{r.age ? `, ${r.age}y` : ""}</span>}
              <ThreatBadge level={r.threatLevel} />
              <StatusChip status={r.status} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {r.linkedCrimeNo && <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: NAVY }}>FIR: {r.linkedCrimeNo}</span>}
              {r.warrantNo && <span style={{ fontSize: 11, color: GRAY }}>Warrant: {r.warrantNo}</span>}
              {r.reward && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>Reward: {r.reward}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {r.status === "WANTED" && (
              <select
                disabled={patching === r.id}
                value=""
                onChange={(e) => { if (e.target.value) patchStatus(r, e.target.value); }}
                style={{ padding: "5px 8px", borderRadius: 6, fontSize: 11, border: `1px solid ${BORDER}`, color: GRAY, background: WHITE, cursor: "pointer" }}
              >
                <option value="">Change status…</option>
                <option value="APPREHENDED">Mark Apprehended</option>
                <option value="CANCELLED">Cancel</option>
              </select>
            )}
            <button onClick={() => setDetail(r)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #7f1d1d", background: "transparent", color: "#7f1d1d", cursor: "pointer" }}>
              <FileText size={13} /> View
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#7f1d1d", margin: 0 }}>Add Wanted Person / Absconder</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Person Name *</label><input {...f("personName")} required style={IS} /></div>
                <div><label style={LS}>Age</label><input {...f("age")} style={IS} /></div>
                <div><label style={LS}>Gender</label><select {...f("gender")} style={IS}>{["Male","Female","Transgender","Unknown"].map((g) => <option key={g}>{g}</option>)}</select></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Last Known Address</label><input {...f("lastKnownAddress")} style={IS} /></div>
                <div>
                  <SearchableSelect
                    label="FIR / Crime No. *"
                    value={form.linkedCrimeNo}
                    onChange={(v) => setForm((prev) => ({ ...prev, linkedCrimeNo: v }))}
                    options={firOptions}
                    emptyMessage="No FIR records in Catalyst"
                    required
                  />
                </div>
                <div><label style={LS}>Warrant No.</label><input {...f("warrantNo")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Issuing Court</label><input {...f("courtName")} style={IS} /></div>
                <div><label style={LS}>Absconded Since</label><input type="date" {...f("abscondedSince")} style={IS} /></div>
                <div><label style={LS}>Threat Level</label><select {...f("threatLevel")} style={IS}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Reward (if any)</label><input {...f("reward")} style={IS} placeholder="e.g. ₹50,000" /></div>
              </div>
              {formError && <div style={{ marginTop: 14, display: "flex", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px" }}><AlertTriangle size={13} color="#991b1b" /><span style={{ fontSize: 12, color: "#991b1b" }}>{formError}</span></div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: "#7f1d1d", color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>{submitting ? "Saving…" : "Add to Register"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {detail && <DetailModal record={detail} onClose={() => setDetail(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
