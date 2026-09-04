"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, PlusCircle, X, FileText, Clock } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { BailRemandOrder } from "@/app/api/bail-remand/route";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useFIROptions } from "@/hooks/useFIROptions";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;

const TYPE_META: Record<string, { bg: string; col: string; label: string }> = {
  REMAND:           { bg: "#fff7ed", col: "#9a3412",  label: "Police Remand"    },
  JUDICIAL_CUSTODY: { bg: "#fef2f2", col: "#991b1b",  label: "Judicial Custody" },
  TRANSIT_REMAND:   { bg: "#faf5ff", col: "#7e22ce",  label: "Transit Remand"   },
  BAIL:             { bg: "#f0fdf4", col: "#15803d",  label: "Bail"             },
};

const STATUS_META: Record<string, { bg: string; col: string }> = {
  ACTIVE:  { bg: "#fef9c3", col: "#854d0e" },
  EXPIRED: { bg: "#f8fafc", col: "#475569" },
  REVOKED: { bg: "#fef2f2", col: "#991b1b" },
};

const EMPTY_FORM = {
  linkedCrimeNo: "", accusedName: "", arrestNo: "",
  orderType: "REMAND", orderDate: new Date().toISOString().substring(0, 10),
  expiryDate: "", courtName: "", judgeName: "", conditions: "",
};

function TypeChip({ type }: { type: string }) {
  const m = TYPE_META[type] || TYPE_META.REMAND;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>{m.label}</span>;
}

function StatusChip({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.ACTIVE;
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: m.bg, color: m.col }}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function ExpiryBadge({ date }: { date: string }) {
  if (!date) return null;
  const days = daysUntil(date);
  if (days === null) return null;
  const col = days <= 0 ? "#991b1b" : days <= 3 ? "#9a3412" : "#854d0e";
  const bg  = days <= 0 ? "#fef2f2" : days <= 3 ? "#fff7ed" : "#fef9c3";
  const label = days <= 0 ? "Expired" : days === 1 ? "Expires tomorrow" : `Expires in ${days}d`;
  return <span style={{ fontSize: 10, fontWeight: 700, background: bg, color: col, padding: "2px 8px", borderRadius: 6 }}><Clock size={9} style={{ marginRight: 3, verticalAlign: "middle" }} />{label}</span>;
}

function DetailModal({ order, onClose }: { order: BailRemandOrder; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
        <div style={{ background: NAVY, padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderRadius: "14px 14px 0 0" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Bail / Remand Order</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WHITE, fontFamily: "JetBrains Mono, monospace" }}>{order.orderNo}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 3 }}>{order.accusedName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            <TypeChip type={order.orderType} />
            <StatusChip status={order.status} />
            {order.expiryDate && <ExpiryBadge date={order.expiryDate} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
            <F label="FIR / Crime No." value={order.linkedCrimeNo || "—"} mono />
            <F label="Arrest No." value={order.arrestNo || "—"} mono />
            <F label="Order Date" value={order.orderDate} mono />
            <F label="Expiry Date" value={order.expiryDate || "—"} mono />
            <F label="Court" value={order.courtName || "—"} />
            <F label="Judge" value={order.judgeName || "—"} />
          </div>
          {order.conditions && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Conditions</div>
              <div style={{ fontSize: 13, color: NAVY, lineHeight: 1.65, background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>{order.conditions}</div>
            </div>
          )}
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

export const BailRemandTracker: React.FC = () => {
  const [orders, setOrders]         = useState<BailRemandOrder[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const { firOptions } = useFIROptions();
  const [detail, setDetail]         = useState<BailRemandOrder | null>(null);
  const [patching, setPatching]     = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/bail-remand");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setTableReady(data.tableReady);
      setOrders(data.orders ?? []);
    } catch (e: any) { setError(e.message || "Failed to load."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => {
    let rows = orders;
    if (typeFilter !== "ALL") rows = rows.filter((o) => o.orderType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((o) => o.accusedName.toLowerCase().includes(q) || o.linkedCrimeNo.toLowerCase().includes(q));
    }
    return rows;
  }, [orders, typeFilter, search]);

  const expiringSoon = useMemo(() => orders.filter((o) => {
    if (o.status !== "ACTIVE" || !o.expiryDate) return false;
    const d = daysUntil(o.expiryDate);
    return d !== null && d <= 3;
  }).length, [orders]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.accusedName.trim()) { setFormError("Accused name is required."); return; }
    if (!form.linkedCrimeNo.trim()) { setFormError("Crime number is required."); return; }
    setSubmitting(true); setFormError(null);
    try {
      const res  = await fetch("/api/bail-remand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setShowForm(false); setForm({ ...EMPTY_FORM }); await load();
    } catch (e: any) { setFormError(e.message || "Submission failed."); }
    finally { setSubmitting(false); }
  };

  const patchStatus = async (o: BailRemandOrder, status: string) => {
    setPatching(o.id);
    try {
      await fetch("/api/bail-remand", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowId: o.rowId, status }) });
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>BailRemand table not found in Catalyst</div>
            <ul style={{ fontSize: 12, color: "#78350f", marginTop: 8, lineHeight: 2, paddingLeft: 20 }}>
              {["BRID — BIGINT","OrderNo — VARCHAR(50)","LinkedCrimeNo — VARCHAR(100)","AccusedName — VARCHAR(255)",
                "ArrestNo — VARCHAR(50)","OrderType — VARCHAR(30)","OrderDate — VARCHAR(20)","ExpiryDate — VARCHAR(20)",
                "CourtName — VARCHAR(255)","JudgeName — VARCHAR(255)","Conditions — VARCHAR(255)",
                "Status — VARCHAR(20)","CreatedAt — DATETIME","UpdatedAt — DATETIME",
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
      {/* Expiry alert */}
      {expiringSoon > 0 && (
        <div style={{ display: "flex", gap: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 16px", marginBottom: 16 }}>
          <AlertTriangle size={15} color="#9a3412" style={{ marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#9a3412", fontWeight: 600 }}>{expiringSoon} order{expiringSoon > 1 ? "s" : ""} expiring within 3 days — review immediately.</span>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        {["ALL", ...Object.keys(TYPE_META)].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: typeFilter === t ? NAVY : "transparent",
            color: typeFilter === t ? WHITE : GRAY,
            border: `1px solid ${typeFilter === t ? NAVY : BORDER}`,
          }}>
            {t === "ALL" ? "All" : TYPE_META[t]?.label}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or crime no…"
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${BORDER}`, outline: "none", width: 220 }} />
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: "pointer" }}>
          <PlusCircle size={13} /> Add Order
        </button>
      </div>

      {loading && <OrcaLoader />}
      {error && !loading && <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}><AlertTriangle size={15} color="#991b1b" /><span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span></div>}
      {!loading && !error && displayed.length === 0 && <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8 }}><Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} /><div style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No bail/remand orders found</div></div>}

      {!loading && !error && displayed.map((o) => {
        const days = daysUntil(o.expiryDate);
        const isUrgent = o.status === "ACTIVE" && days !== null && days <= 3;
        return (
          <div key={o.id} style={{
            background: isUrgent ? "#fffbf0" : WHITE,
            borderRadius: 10, marginBottom: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
          }}>
            <div style={{ flexShrink: 0, minWidth: 120 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{o.orderNo}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{o.orderDate}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{o.accusedName}</span>
                <TypeChip type={o.orderType} />
                <StatusChip status={o.status} />
                {o.expiryDate && <ExpiryBadge date={o.expiryDate} />}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {o.linkedCrimeNo && <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: NAVY }}>FIR: {o.linkedCrimeNo}</span>}
                {o.courtName && <span style={{ fontSize: 11, color: GRAY }}>{o.courtName}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {o.status === "ACTIVE" && (
                <select
                  disabled={patching === o.id}
                  value=""
                  onChange={(e) => { if (e.target.value) patchStatus(o, e.target.value); }}
                  style={{ padding: "5px 8px", borderRadius: 6, fontSize: 11, border: `1px solid ${BORDER}`, color: GRAY, background: WHITE, cursor: "pointer" }}
                >
                  <option value="">Change status…</option>
                  <option value="EXPIRED">Mark Expired</option>
                  <option value="REVOKED">Mark Revoked</option>
                </select>
              )}
              <button onClick={() => setDetail(o)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer" }}>
                <FileText size={13} /> View
              </button>
            </div>
          </div>
        );
      })}

      {showForm && (
        <div onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(10,20,40,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.28)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: 0 }}>Add Bail / Remand Order</h2>
              <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: GRAY }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Accused Name *</label><input {...f("accusedName")} required style={IS} /></div>
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
                <div><label style={LS}>Arrest No. (if any)</label><input {...f("arrestNo")} style={IS} /></div>
                <div><label style={LS}>Order Type</label><select {...f("orderType")} style={IS}>{Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                <div><label style={LS}>Order Date</label><input type="date" {...f("orderDate")} style={IS} /></div>
                <div><label style={LS}>Expiry / Next Hearing Date</label><input type="date" {...f("expiryDate")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Court Name</label><input {...f("courtName")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Judge Name</label><input {...f("judgeName")} style={IS} /></div>
                <div style={{ gridColumn: "1/-1" }}><label style={LS}>Conditions (if bail)</label><textarea {...f("conditions")} rows={3} style={{ ...IS, resize: "vertical" }} placeholder="Surety amount, travel restrictions, etc." /></div>
              </div>
              {formError && <div style={{ marginTop: 14, display: "flex", gap: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px" }}><AlertTriangle size={13} color="#991b1b" /><span style={{ fontSize: 12, color: "#991b1b" }}>{formError}</span></div>}
              <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setFormError(null); }} style={{ padding: "7px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ padding: "7px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: NAVY, color: WHITE, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>{submitting ? "Saving…" : "Add Order"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && <DetailModal order={detail} onClose={() => setDetail(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
