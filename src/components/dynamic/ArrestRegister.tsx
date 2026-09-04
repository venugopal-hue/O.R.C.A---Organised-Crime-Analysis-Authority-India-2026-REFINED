"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, PlusCircle, X, FileText, Printer } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { ArrestRecord } from "@/app/api/arrest/route";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useFIROptions } from "@/hooks/useFIROptions";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

const STATUS_META: Record<string, { bg: string; col: string; label: string }> = {
  IN_CUSTODY: { bg: "#fef2f2", col: "#991b1b",  label: "In Custody"       },
  REMANDED:   { bg: "#fff7ed", col: "#9a3412",  label: "Remanded"         },
  BAILED:     { bg: "#f0fdf4", col: "#15803d",  label: "Bailed"           },
  RELEASED:   { bg: "#f8fafc", col: "#475569",  label: "Released"         },
};

const EMPTY_FORM = {
  accusedName: "", age: "", gender: "Male", fatherName: "", address: "",
  linkedCrimeNo: "", sectionsInvoked: "",
  arrestDate: new Date().toISOString().substring(0, 10),
  arrestTime: "", arrestLocation: "", groundsOfArrest: "",
  medicalExamDone: "NO", medicalOfficer: "", custodyLocation: "",
};

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.IN_CUSTODY;
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>
      {m.label}
    </span>
  );
}

/* ── Arrest Warrant printable document ── */
function printWarrant(r: ArrestRecord) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Arrest Warrant — ${r.arrestNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Source Sans 3', sans-serif; background: #fff; color: #1a1a2e; }
  @page { size: A4; margin: 18mm 20mm; }
  .page { max-width: 750px; margin: 0 auto; padding: 0; position: relative; }

  /* Watermark */
  .watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 88px; font-weight: 900; color: rgba(0,31,63,0.04);
    letter-spacing: 8px; pointer-events: none; z-index: 0; white-space: nowrap;
    font-family: 'EB Garamond', serif;
  }

  /* Header */
  .header { text-align: center; border-bottom: 3px double #001f3f; padding-bottom: 14px; margin-bottom: 18px; }
  .emblem { font-size: 48px; line-height: 1; margin-bottom: 4px; }
  .dept { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; color: #001f3f; text-transform: uppercase; }
  .doc-title {
    font-family: 'EB Garamond', serif; font-size: 26px; font-weight: 700;
    color: #001f3f; margin: 10px 0 4px; letter-spacing: 0.04em;
  }
  .doc-sub { font-size: 11px; color: #475569; font-style: italic; }

  /* Classification */
  .classification {
    display: inline-block; padding: 3px 14px; border: 2px solid #dc2626;
    color: #dc2626; font-size: 10px; font-weight: 800; letter-spacing: 0.15em;
    text-transform: uppercase; margin: 8px auto; border-radius: 2px;
  }

  /* Ref line */
  .ref-line { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .ref-line strong { color: #001f3f; }

  /* Section */
  .section-title {
    font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: #001f3f; border-left: 3px solid #001f3f; padding-left: 8px; margin: 18px 0 10px;
  }

  /* Grid */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 32px; margin-bottom: 6px; }
  .field { margin-bottom: 6px; }
  .field-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px; }
  .field-value { font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; min-height: 22px; }
  .field-value.mono { font-family: 'Courier New', monospace; font-size: 12px; }
  .field-value.large { font-size: 15px; font-weight: 700; color: #001f3f; }

  .grounds-box {
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px;
    font-size: 13px; line-height: 1.65; color: #1e293b; min-height: 60px;
    background: #f8fafc;
  }

  /* Signature block */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #1e293b; padding-top: 6px; margin-top: 40px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1e293b; }
  .sig-sub { font-size: 9px; color: #64748b; margin-top: 2px; }

  /* Seal area */
  .seal-area { border: 2px dashed #cbd5e1; border-radius: 50%; width: 90px; height: 90px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; text-align: center; }

  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  .generated { font-size: 9px; color: #cbd5e1; text-align: center; margin-top: 6px; font-style: italic; }
</style>
</head>
<body>
<div class="watermark">O.R.C.A</div>
<div class="page">

  <div class="header">
    <div class="emblem">🇮🇳</div>
    <div class="dept">Government of India &nbsp;·&nbsp; State Police</div>
    <div class="dept" style="margin-top:2px;font-size:9px;color:#64748b;">O.R.C.A — Operational Records &amp; Crime Analytics System</div>
    <div class="doc-title">Arrest Memorandum</div>
    <div class="doc-sub">Issued under Section 41 / 41A CrPC (BNSS 2023 equivalent)</div>
    <div><span class="classification">Restricted — Law Enforcement Use Only</span></div>
  </div>

  <div class="ref-line">
    <span>Arrest No: <strong>${r.arrestNo}</strong></span>
    <span>FIR / Crime No: <strong>${r.linkedCrimeNo || "—"}</strong></span>
    <span>Date of Arrest: <strong>${r.arrestDate}</strong></span>
  </div>

  <div class="section-title">Personal Particulars of the Accused</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">Full Name</div>
      <div class="field-value large">${r.accusedName}</div>
    </div>
    <div class="field">
      <div class="field-label">Father's / Husband's Name</div>
      <div class="field-value">${r.fatherName || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">Age</div>
      <div class="field-value">${r.age || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">Gender</div>
      <div class="field-value">${r.gender}</div>
    </div>
    <div class="field" style="grid-column:1/-1">
      <div class="field-label">Last Known Address</div>
      <div class="field-value">${r.address || "—"}</div>
    </div>
  </div>

  <div class="section-title">Offence Details</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">FIR / Crime Number</div>
      <div class="field-value mono">${r.linkedCrimeNo || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">Sections Invoked</div>
      <div class="field-value">${r.sectionsInvoked || "—"}</div>
    </div>
  </div>

  <div class="section-title">Arrest Details</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">Date of Arrest</div>
      <div class="field-value mono">${r.arrestDate}</div>
    </div>
    <div class="field">
      <div class="field-label">Time of Arrest</div>
      <div class="field-value mono">${r.arrestTime || "—"}</div>
    </div>
    <div class="field" style="grid-column:1/-1">
      <div class="field-label">Place of Arrest</div>
      <div class="field-value">${r.arrestLocation || "—"}</div>
    </div>
    <div class="field" style="grid-column:1/-1">
      <div class="field-label">Current Custody Location</div>
      <div class="field-value">${r.custodyLocation || "—"}</div>
    </div>
  </div>

  <div class="section-title">Grounds of Arrest</div>
  <div class="grounds-box">${r.groundsOfArrest || "As per FIR and investigation findings."}</div>

  <div class="section-title">Medical Examination</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">Medical Examination Done</div>
      <div class="field-value">${r.medicalExamDone === "YES" ? "Yes — conducted at time of arrest" : "No"}</div>
    </div>
    <div class="field">
      <div class="field-label">Medical Officer</div>
      <div class="field-value">${r.medicalOfficer || "—"}</div>
    </div>
  </div>

  <div class="section-title">Arresting Officer</div>
  <div class="grid">
    <div class="field">
      <div class="field-label">Name</div>
      <div class="field-value">${r.arrestingOfficerName || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">Document Generated</div>
      <div class="field-value mono">${new Date().toLocaleString("en-IN")}</div>
    </div>
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <div class="seal-area">Official<br/>Stamp</div>
      <div class="sig-line">Arresting Officer</div>
      <div class="sig-sub">${r.arrestingOfficerName || "Signature"}</div>
    </div>
    <div class="sig-box">
      <div class="seal-area">Station<br/>Seal</div>
      <div class="sig-line">Station House Officer</div>
      <div class="sig-sub">SHO / Designation</div>
    </div>
    <div class="sig-box">
      <div class="seal-area">Court<br/>Seal</div>
      <div class="sig-line">Magistrate</div>
      <div class="sig-sub">Court / Designation</div>
    </div>
  </div>

  <div class="footer">
    <span>Arrest No: ${r.arrestNo}</span>
    <span>O.R.C.A INDIA 2026 — Confidential Police Record</span>
    <span>Page 1 of 1</span>
  </div>
  <div class="generated">Generated by O.R.C.A Intelligence Platform · Not valid without official stamp and signature</div>
</div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

/* ── Detail modal ── */
function ArrestDetailModal({ record, onClose }: { record: ArrestRecord; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: WHITE, borderRadius: 14, width: "100%", maxWidth: 600,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
      }}>
        {/* Navy header */}
        <div style={{ background: NAVY, padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderRadius: "14px 14px 0 0" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Arrest Record</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "JetBrains Mono, monospace" }}>{record.arrestNo}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>{record.accusedName}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => printWarrant(record)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: WHITE, cursor: "pointer" }}
            >
              <Printer size={13} /> Print Warrant
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <StatusChip status={record.status} />
            {record.linkedCrimeNo && (
              <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", background: "#eff6ff", color: NAVY, padding: "2px 9px", borderRadius: 6, fontWeight: 700 }}>
                {record.linkedCrimeNo}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
            <MF label="Age" value={record.age || "—"} />
            <MF label="Gender" value={record.gender} />
            <MF label="Father's Name" value={record.fatherName || "—"} />
            <MF label="Address" value={record.address || "—"} />
            <MF label="Arrest Date" value={record.arrestDate} mono />
            <MF label="Arrest Time" value={record.arrestTime || "—"} mono />
            <MF label="Arrest Location" value={record.arrestLocation || "—"} />
            <MF label="Custody Location" value={record.custodyLocation || "—"} />
            <MF label="Sections Invoked" value={record.sectionsInvoked || "—"} />
            <MF label="Arresting Officer" value={record.arrestingOfficerName || "—"} />
            <MF label="Medical Exam" value={record.medicalExamDone === "YES" ? `Yes — ${record.medicalOfficer || "conducted"}` : "No"} />
          </div>

          {record.groundsOfArrest && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Grounds of Arrest</div>
              <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.65, background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>{record.groundsOfArrest}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MF({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: mono ? "JetBrains Mono, monospace" : undefined }}>{value}</div>
    </div>
  );
}

/* ── Main component ── */
export const ArrestRegister: React.FC = () => {
  const [records, setRecords]       = useState<ArrestRecord[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const { firOptions } = useFIROptions();
  const [detail, setDetail]         = useState<ArrestRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/arrest");
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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.accusedName.toLowerCase().includes(q) || r.linkedCrimeNo.toLowerCase().includes(q) || r.arrestNo.toLowerCase().includes(q));
    }
    return rows;
  }, [records, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    records.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [records]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.accusedName.trim()) { setFormError("Accused name is required."); return; }
    if (!form.linkedCrimeNo.trim()) { setFormError("Crime number is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res  = await fetch("/api/arrest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setShowForm(false); setForm({ ...EMPTY_FORM }); await load();
    } catch (e: any) { setFormError(e.message || "Submission failed."); }
    finally { setSubmitting(false); }
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>ArrestRecord table not found in Catalyst</div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["ArrestID — BIGINT","ArrestNo — VARCHAR(50)","PersonName — VARCHAR(255)","PersonDOB — VARCHAR(20)",
                "PersonAddress — VARCHAR(255)","PersonContact — VARCHAR(100)",
                "LinkedCrimeNo — VARCHAR(100)","SectionsInvoked — VARCHAR(255)","ArrestDate — VARCHAR(20)",
                "ArrestTime — VARCHAR(10)","ArrestLocation — VARCHAR(255)","GroundsOfArrest — VARCHAR(255)",
                "MedicalExamDone — VARCHAR(5)","MedicalOfficer — VARCHAR(255)","CustodyLocation — VARCHAR(255)",
                "ArrestingOfficerID — BIGINT","ArrestingOfficerName — VARCHAR(255)","Status — VARCHAR(30)",
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
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        {["ALL", ...Object.keys(STATUS_META)].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: statusFilter === s ? NAVY : "transparent",
            color: statusFilter === s ? WHITE : GRAY,
            border: `1px solid ${statusFilter === s ? NAVY : BORDER}`,
          }}>
            {s === "ALL" ? "All" : STATUS_META[s]?.label}
            {s !== "ALL" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or crime no…"
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", width: 220 }} />
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: "pointer" }}>
          <PlusCircle size={13} /> New Arrest
        </button>
      </div>

      {/* Summary tiles */}
      {!loading && records.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.entries(STATUS_META).map(([s, m]) => counts[s] ? (
            <div key={s} style={{ background: m.bg, borderRadius: 8, padding: "8px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer" }} onClick={() => setStatusFilter(s)}>
              <div style={{ fontSize: 9, fontWeight: 700, color: m.col, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.col }}>{counts[s]}</div>
            </div>
          ) : null)}
        </div>
      )}

      {loading && <OrcaLoader />}
      {error && !loading && <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}><AlertTriangle size={15} color="#991b1b" /><span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span></div>}
      {!loading && !error && displayed.length === 0 && <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}><Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No arrest records found</div></div>}

      {/* Records list */}
      {!loading && !error && displayed.map((r) => (
        <div key={r.id} style={{
          background: r.status === "IN_CUSTODY" ? "#fff5f5" : r.status === "REMANDED" ? "#fffbf0" : WHITE,
          borderRadius: 10, marginBottom: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
        }}>
          <div style={{ flexShrink: 0, minWidth: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{r.arrestNo}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{r.arrestDate}</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{r.accusedName}</span>
              {r.gender && r.gender !== "Unknown" && <span style={{ fontSize: 11, color: GRAY }}>{r.gender}{r.age ? `, ${r.age}y` : ""}</span>}
              <StatusChip status={r.status} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {r.linkedCrimeNo && <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: NAVY }}>FIR: {r.linkedCrimeNo}</span>}
              {r.custodyLocation && <span style={{ fontSize: 11, color: GRAY }}>{r.custodyLocation}</span>}
            </div>
          </div>
          <button onClick={() => setDetail(r)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer" }}>
            <FileText size={13} /> View
          </button>
        </div>
      ))}

      {/* New arrest form */}
      {showForm && (
        <div onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Record Arrest</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Accused Full Name *</label><input {...f("accusedName")} required style={IS} /></div>
                <div><label style={LS}>Age</label><input {...f("age")} style={IS} placeholder="e.g. 28" /></div>
                <div><label style={LS}>Gender</label><select {...f("gender")} style={IS}>{["Male","Female","Transgender","Unknown"].map((g) => <option key={g}>{g}</option>)}</select></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Father's / Husband's Name</label><input {...f("fatherName")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Address</label><input {...f("address")} style={IS} /></div>
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
                <div><label style={LS}>Sections Invoked</label><input {...f("sectionsInvoked")} style={IS} placeholder="e.g. IPC 302, 307" /></div>
                <div><label style={LS}>Arrest Date</label><input type="date" {...f("arrestDate")} style={IS} /></div>
                <div><label style={LS}>Arrest Time</label><input type="time" {...f("arrestTime")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Place of Arrest</label><input {...f("arrestLocation")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Grounds of Arrest</label><textarea {...f("groundsOfArrest")} rows={3} style={{ ...IS, resize: "vertical" }} /></div>
                <div><label style={LS}>Medical Exam Done?</label><select {...f("medicalExamDone")} style={IS}><option value="NO">No</option><option value="YES">Yes</option></select></div>
                <div><label style={LS}>Medical Officer</label><input {...f("medicalOfficer")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Custody Location</label><input {...f("custodyLocation")} style={IS} placeholder="Lock-up / Jail / Hospital" /></div>
              </div>
              {formError && <div style={{ marginTop: 14, display: "flex", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px" }}><AlertTriangle size={13} color="#991b1b" /><span style={{ fontSize: 12, color: "#991b1b" }}>{formError}</span></div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>{submitting ? "Saving…" : "Record Arrest"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && <ArrestDetailModal record={detail} onClose={() => setDetail(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
