"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import {
  AlertTriangle, Loader2, RefreshCw, Inbox,
  PlusCircle, X, BookOpen, FileText,
} from "lucide-react";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useFIROptions } from "@/hooks/useFIROptions";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";

const NAVY  = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

const CATEGORIES = ["ALL", "COMPLAINT", "INCIDENT", "PATROL", "VISITOR", "INFORMATION", "OTHER"] as const;
type Category = typeof CATEGORIES[number];

const CAT_META: Record<string, { bg: string; col: string; label: string }> = {
  COMPLAINT:   { bg: "#fef2f2", col: "#991b1b", label: "Complaint"   },
  INCIDENT:    { bg: "#fff7ed", col: "#9a3412", label: "Incident"    },
  PATROL:      { bg: "#f0fdf4", col: "#15803d", label: "Patrol"      },
  VISITOR:     { bg: "#eff6ff", col: "#1d4ed8", label: "Visitor"     },
  INFORMATION: { bg: "#faf5ff", col: "#7e22ce", label: "Information" },
  OTHER:       { bg: "#f8fafc", col: "#475569", label: "Other"       },
};

const STATUS_META: Record<string, { bg: string; col: string }> = {
  OPEN:               { bg: "#fef9c3", col: "#854d0e" },
  CLOSED:             { bg: "#f0fdf4", col: "#15803d" },
  CONVERTED_TO_FIR:   { bg: "#eff6ff", col: "#1d4ed8" },
};

interface GDEntry {
  id: number;
  entryNo: string;
  stationName: string;
  category: string;
  description: string;
  reportedBy: string;
  reportedByContact: string;
  officerId: number;
  linkedCrimeNo: string;
  status: string;
  entryDate: string;
  createdAt: string;
}

const EMPTY_FORM = {
  category: "COMPLAINT",
  description: "",
  reportedBy: "",
  reportedByContact: "",
  linkedCrimeNo: "",
  entryDate: new Date().toISOString().substring(0, 10),
};

function CategoryChip({ cat }: { cat: string }) {
  const m = CAT_META[cat] || CAT_META.OTHER;
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>
      {m.label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.OPEN;
  const label = status === "CONVERTED_TO_FIR" ? "→ FIR" : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>
      {label}
    </span>
  );
}

/* ── Detail modal ── */
function GDDetailModal({ entry, onClose }: { entry: GDEntry; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(10,20,40,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: WHITE, borderRadius: 14, width: "100%", maxWidth: 540,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
        }}
      >
        {/* Header band */}
        <div style={{
          background: NAVY, padding: "18px 24px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              General Diary Entry
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "JetBrains Mono, monospace" }}>
              {entry.entryNo}
            </div>
            {entry.stationName && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{entry.stationName}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, marginTop: -2 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Chips row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <CategoryChip cat={entry.category} />
            <StatusChip status={entry.status} />
            <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto", fontFamily: "JetBrains Mono, monospace" }}>
              {entry.entryDate}
            </span>
          </div>

          {/* Description */}
          <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.65, marginBottom: 18, fontWeight: 500 }}>
            {entry.description}
          </div>

          {/* Detail grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>
            {entry.reportedBy && <Field label="Reported By" value={entry.reportedBy} />}
            {entry.reportedByContact && <Field label="Contact" value={entry.reportedByContact} />}
            {entry.linkedCrimeNo && <Field label="Linked FIR" value={entry.linkedCrimeNo} mono />}
            {entry.createdAt && <Field label="Logged At" value={entry.createdAt.substring(0, 16).replace("T", " ")} mono />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, fontFamily: mono ? "JetBrains Mono, monospace" : undefined }}>{value}</div>
    </div>
  );
}

/* ── Main ── */
export const GeneralDiary: React.FC = () => {
  const [entries, setEntries]       = useState<GDEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [catFilter, setCatFilter]   = useState<Category>("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [detail, setDetail]         = useState<GDEntry | null>(null);
  const { firOptions } = useFIROptions();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (catFilter !== "ALL") params.set("category", catFilter);
      if (dateFilter) params.set("date", dateFilter);
      const res  = await fetch(`/api/general-diary?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setTableReady(data.tableReady);
      setEntries(data.entries ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [catFilter, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    entries.forEach((e) => { c[e.category] = (c[e.category] || 0) + 1; });
    return c;
  }, [entries]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.description.trim()) { setFormError("Description is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res = await fetch("/api/general-diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (e: any) {
      setFormError(e.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const f = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 6, fontSize: 12,
    border: `1px solid ${BORDER}`, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700, color: GRAY,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
  };

  if (!loading && tableReady === false) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "24px 28px", display: "flex", gap: 16 }}>
          <AlertTriangle size={22} color="#92400e" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>GeneralDiary table not found in Catalyst</div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["GDID — BIGINT", "EntryNo — VARCHAR(50)", "StationID — BIGINT", "StationName — VARCHAR(255)",
                "Category — VARCHAR(50)", "Description — VARCHAR(255)", "ReportedBy — VARCHAR(255)",
                "ReportedByContact — VARCHAR(100)", "OfficerID — BIGINT", "LinkedCrimeNo — VARCHAR(100)",
                "Status — VARCHAR(20)", "EntryDate — VARCHAR(20)", "CreatedAt — DATETIME", "UpdatedAt — DATETIME",
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
        <BookOpen size={15} color={NAVY} />
        {CATEGORIES.map((cat) => (
          <button key={cat}
            onClick={() => setCatFilter(cat)}
            style={{
              padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: catFilter === cat ? NAVY : "transparent",
              color: catFilter === cat ? WHITE : GRAY,
              border: `1px solid ${catFilter === cat ? NAVY : BORDER}`,
            }}
          >
            {cat === "ALL" ? "All" : (CAT_META[cat]?.label ?? cat)}
            {cat !== "ALL" && counts[cat] ? ` (${counts[cat]})` : ""}
          </button>
        ))}
        <input
          type="date" value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none" }}
        />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY, padding: 0 }}>
            <X size={13} />
          </button>
        )}
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button onClick={() => setShowForm(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: "pointer", marginLeft: "auto" }}>
          <PlusCircle size={13} /> New Entry
        </button>
      </div>

      {/* Summary row */}
      {!loading && entries.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {Object.entries(CAT_META).map(([cat, meta]) =>
            counts[cat] ? (
              <div key={cat} style={{ background: meta.bg, borderRadius: 8, padding: "8px 14px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                onClick={() => setCatFilter(cat as Category)}>
                <div style={{ fontSize: 9, fontWeight: 700, color: meta.col, textTransform: "uppercase", letterSpacing: "0.08em" }}>{meta.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: meta.col }}>{counts[cat]}</div>
              </div>
            ) : null
          )}
        </div>
      )}

      {loading && (
        <OrcaLoader />
      )}
      {error && !loading && (
        <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}>
          <AlertTriangle size={15} color="#991b1b" style={{ marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}>
          <Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No diary entries found</div>
        </div>
      )}

      {/* Entry list */}
      {!loading && !error && entries.map((entry) => (
        <div key={entry.id} style={{
          background: WHITE, borderRadius: 10, marginBottom: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
        }}>
          {/* Left: entry no + date */}
          <div style={{ flexShrink: 0, minWidth: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{entry.entryNo}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{entry.entryDate}</div>
          </div>

          {/* Center */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 5 }}>
              <CategoryChip cat={entry.category} />
              <StatusChip status={entry.status} />
              {entry.linkedCrimeNo && (
                <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: NAVY, background: "#eff6ff", padding: "2px 7px", borderRadius: 6 }}>
                  {entry.linkedCrimeNo}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: NAVY, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.description}
            </div>
            {entry.reportedBy && (
              <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>{entry.reportedBy}{entry.reportedByContact ? ` · ${entry.reportedByContact}` : ""}</div>
            )}
          </div>

          <button
            onClick={() => setDetail(entry)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer",
            }}
          >
            <FileText size={13} /> View
          </button>
        </div>
      ))}

      {/* New entry form modal */}
      {showForm && (
        <div
          onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>New General Diary Entry</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select {...f("category")} style={inputStyle}>
                    {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                      <option key={c} value={c}>{CAT_META[c]?.label ?? c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Entry Date</label>
                  <input type="date" {...f("entryDate")} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description *</label>
                  <textarea {...f("description")} rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                    placeholder="Detail of the incident, complaint, patrol note, etc." />
                </div>
                <div>
                  <label style={labelStyle}>Reported By</label>
                  <input {...f("reportedBy")} style={inputStyle} placeholder="Name (if walk-in)" />
                </div>
                <div>
                  <label style={labelStyle}>Contact</label>
                  <input {...f("reportedByContact")} style={inputStyle} placeholder="Mobile / phone" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <SearchableSelect
                    label="Linked FIR / Crime No. (optional)"
                    value={form.linkedCrimeNo}
                    onChange={(v) => setForm((prev) => ({ ...prev, linkedCrimeNo: v }))}
                    options={firOptions}
                    emptyMessage="No FIR records in Catalyst"
                    placeholder="— Search crime number —"
                  />
                </div>
              </div>

              {formError && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px" }}>
                  <AlertTriangle size={13} color="#991b1b" />
                  <span style={{ fontSize: 12, color: "#991b1b" }}>{formError}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button"
                  onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
                  style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  style={{ padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Saving…" : "Log Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && <GDDetailModal entry={detail} onClose={() => setDetail(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
