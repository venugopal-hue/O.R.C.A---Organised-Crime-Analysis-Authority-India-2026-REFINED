"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, PlusCircle, X, Search, FileText } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

type Status = "MISSING" | "FOUND" | "CLOSED";

interface MPRecord {
  id: number;
  fullName: string;
  age: string;
  gender: string;
  lastSeenDate: string;
  lastSeenLocation: string;
  description: string;
  reporterName: string;
  reporterContact: string;
  linkedCrimeNo: string;
  status: Status;
  createdAt: string;
}

const STATUS_STYLE: Record<Status, { bg: string; col: string; label: string }> = {
  MISSING: { bg: "#fef2f2", col: "#991b1b", label: "MISSING" },
  FOUND:   { bg: "#f0fdf4", col: "#15803d", label: "FOUND"   },
  CLOSED:  { bg: "#f8fafc", col: "#64748b", label: "CLOSED"  },
};

const EMPTY_FORM = {
  fullName: "", age: "", gender: "Unknown",
  lastSeenDate: "", lastSeenLocation: "", description: "",
  reporterName: "", reporterContact: "", linkedCrimeNo: "",
};

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.MISSING;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
      background: s.bg, color: s.col,
    }}>{s.label}</span>
  );
}

function MPDetailModal({ record, onClose }: { record: MPRecord; onClose: () => void }) {
  const s = STATUS_STYLE[record.status] || STATUS_STYLE.MISSING;
  const rows: [string, string][] = [
    ["Full Name", record.fullName],
    ["Age", record.age || "—"],
    ["Gender", record.gender || "—"],
    ["Last Seen Date", record.lastSeenDate || "—"],
    ["Last Seen Location", record.lastSeenLocation || "—"],
    ["Linked FIR / Crime No.", record.linkedCrimeNo || "—"],
    ["Reporter Name", record.reporterName || "—"],
    ["Reporter Contact", record.reporterContact || "—"],
    ["Registered On", record.createdAt ? new Date(record.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"],
  ];
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
          background: WHITE, borderRadius: 14, width: "100%", maxWidth: 560,
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{record.fullName}</span>
              <StatusBadge status={record.status} />
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{record.gender}{record.age ? `, ${record.age}y` : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY, padding: 4, marginTop: -2 }}>
            <X size={20} />
          </button>
        </div>

        {record.description && (
          <div style={{ padding: "14px 24px 0", fontSize: 13, color: GRAY, lineHeight: 1.6, fontStyle: "italic" }}>
            "{record.description}"
          </div>
        )}

        <div style={{ padding: "16px 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ gridColumn: label === "Last Seen Location" || label === "Linked FIR / Crime No." ? "1 / -1" : undefined }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MissingPersons: React.FC = () => {
  const [records, setRecords]     = useState<MPRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("MISSING");
  const [detailRecord, setDetailRecord] = useState<MPRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/missing-persons");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setTableReady(data.tableReady);
      setRecords(data.records ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let rows = records;
    if (statusFilter !== "ALL") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.lastSeenLocation.toLowerCase().includes(q) ||
        r.linkedCrimeNo.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [records, statusFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setFormError("Full name is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res = await fetch("/api/missing-persons", {
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

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 6, fontSize: 12,
    border: `1px solid ${BORDER}`, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700, color: GRAY,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
  };

  // Table not created in Catalyst yet.
  if (!loading && tableReady === false) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "24px 28px",
          display: "flex", gap: 16,
        }}>
          <AlertTriangle size={22} color="#92400e" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
              MissingPerson table not found in Catalyst
            </div>
            <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
              Create a table named <strong>MissingPerson</strong> in the Zoho Catalyst console with these columns:
            </div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["MissingPersonID — BIGINT", "FullName — VARCHAR", "Age — VARCHAR", "Gender — VARCHAR", "LastSeenDate — VARCHAR", "LastSeenLocation — VARCHAR", "Description — VARCHAR", "ReporterName — VARCHAR", "ReporterContact — VARCHAR", "LinkedCrimeNo — VARCHAR", "Status — VARCHAR", "ReportingOfficerID — BIGINT", "CreatedAt — DATETIME", "UpdatedAt — DATETIME"].map((c) => (
                <li key={c} style={{ fontFamily: "JetBrains Mono, monospace" }}>{c}</li>
              ))}
            </ul>
            <button onClick={load} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid #fde68a`, background: WHITE, color: "#92400e", cursor: "pointer" }}>
              Re-check
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        background: "#f8fafc", borderRadius: 8,
        padding: "12px 16px", marginBottom: 20,
      }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 260 }}>
          <Search size={13} color={GRAY} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or location…"
            style={{ ...inputStyle, paddingLeft: 28 }}
          />
        </div>
        {(["ALL", "MISSING", "FOUND", "CLOSED"] as const).map((st) => (
          <button key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: statusFilter === st ? NAVY : "transparent",
              color: statusFilter === st ? WHITE : GRAY,
              border: `1px solid ${statusFilter === st ? NAVY : BORDER}`,
            }}
          >{st}</button>
        ))}
        <button onClick={load} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6,
            fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: "pointer", marginLeft: "auto",
          }}
        >
          <PlusCircle size={13} /> Register
        </button>
      </div>

      {/* Summary */}
      {!loading && records.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          {(["MISSING", "FOUND", "CLOSED"] as Status[]).map((st) => {
            const count = records.filter((r) => r.status === st).length;
            const s = STATUS_STYLE[st];
            return (
              <div key={st} style={{ background: s.bg, borderRadius: 8, padding: "10px 18px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                onClick={() => setStatusFilter(st === statusFilter ? "ALL" : st)}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.col, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.col }}>{count}</div>
              </div>
            );
          })}
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
      {!loading && !error && displayed.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}>
          <Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            {records.length === 0 ? "No missing person records yet" : "No records match the current filter"}
          </div>
          {records.length === 0 && (
            <button onClick={() => setShowForm(true)} style={{ marginTop: 8, padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: NAVY, color: WHITE, border: "none", cursor: "pointer" }}>
              Register first case
            </button>
          )}
        </div>
      )}

      {/* Records list */}
      {!loading && !error && displayed.map((r) => (
        <div key={r.id} style={{
          background: r.status === "MISSING" ? "#fff5f5" : r.status === "FOUND" ? "#f0fdf4" : WHITE,
          borderRadius: 10, padding: "14px 18px", marginBottom: 8,
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{r.fullName}</span>
              <span style={{ fontSize: 11, color: GRAY }}>{r.gender}{r.age ? `, ${r.age}y` : ""}</span>
              <StatusBadge status={r.status} />
            </div>
            {r.lastSeenLocation && (
              <div style={{ fontSize: 12, color: GRAY }}>
                Last seen: <strong>{r.lastSeenLocation}</strong>
                {r.lastSeenDate && <span style={{ color: MUTED }}> · {r.lastSeenDate}</span>}
              </div>
            )}
            {r.linkedCrimeNo && (
              <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: NAVY, marginTop: 2 }}>FIR: {r.linkedCrimeNo}</div>
            )}
          </div>
          <button
            onClick={() => setDetailRecord(r)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <FileText size={13} /> View Details
          </button>
        </div>
      ))}

      {/* Registration modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: WHITE, borderRadius: 12, width: "100%", maxWidth: 640,
            maxHeight: "90vh", overflowY: "auto", padding: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Register Missing Person</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input {...field("fullName")} required style={inputStyle} placeholder="As per records" />
                </div>
                <div>
                  <label style={labelStyle}>Age</label>
                  <input {...field("age")} style={inputStyle} placeholder="e.g. 25" />
                </div>
                <div>
                  <label style={labelStyle}>Gender</label>
                  <select {...field("gender")} style={inputStyle}>
                    {["Unknown", "Male", "Female", "Transgender"].map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Last Seen Date</label>
                  <input {...field("lastSeenDate")} type="date" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Seen Location</label>
                  <input {...field("lastSeenLocation")} style={inputStyle} placeholder="Area / landmark" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea {...field("description")} rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                    placeholder="Clothing, marks, height…" />
                </div>
                <div>
                  <label style={labelStyle}>Reporter Name</label>
                  <input {...field("reporterName")} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Reporter Contact</label>
                  <input {...field("reporterContact")} style={inputStyle} placeholder="Mobile / phone" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Linked FIR / Crime No. (optional)</label>
                  <input {...field("linkedCrimeNo")} style={inputStyle} placeholder="e.g. CR-2026-00123" />
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
                  style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Registering…" : "Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailRecord && <MPDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
