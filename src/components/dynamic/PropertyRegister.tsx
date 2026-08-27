"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Copy, Trash2, RefreshCw, Inbox, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { ORCA_TOKENS, ORCA_MONO } from "@/lib/theme";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { useUnsavedWarning } from "@/lib/useUnsavedWarning";
import {
  formatRupees,
  rowTotal,
  unitSpec,
  categorySpec,
  normaliseIdentifier,
  isMatchable,
  LIMITS,
  REPORT_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  type CategorySpec,
  type UnitSpec,
} from "@/lib/propertyRegister";

/**
 * Lost, Stolen and Found property register.
 *
 * A STANDALONE registry — a report here is not an FIR and creates no case. The
 * FIR number is a field an officer fills in if one was registered elsewhere.
 *
 * Every rupee figure on this screen is labelled DECLARED, because it is what
 * the owner said the item was worth. Nothing here assesses or verifies a price,
 * and a bare "₹ 4,00,000" in a police record would read as though the force
 * stood behind the number.
 *
 * Mounted bare rather than inside a Panel: Panel sets overflow:hidden, which
 * clips the SearchableSelect dropdowns. Same rule as CaseRegistration.
 */

const T = ORCA_TOKENS;

const TYPE_COLOR: Record<string, string> = {
  LOST: "#0369a1",
  STOLEN: "#b91c1c",
  FOUND: "#059669",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#b45309",
  UNDER_SEARCH: "#0369a1",
  PARTIALLY_RECOVERED: "#7c3aed",
  RECOVERED: "#059669",
  CLOSED: "#64748b",
  WITHDRAWN: "#64748b",
};

interface Ref {
  districts: { id: number; name: string }[];
  units: { id: number; name: string; districtId: number | null }[];
  categories: CategorySpec[];
  quantityUnits: UnitSpec[];
  ownerIdTypes: string[];
  reportTypes: { value: string; label: string }[];
  reportStatuses: { value: string; label: string }[];
  itemStatuses: { value: string; label: string }[];
}

interface ItemDraft {
  tempId: string;
  category: string;
  itemDescription: string;
  quantity: string;
  quantityUnit: string;
  declaredUnitValue: string;
  identifierType: string;
  identifierValue: string;
  remarks: string;
}

interface StoredItem {
  itemId: number;
  category: string;
  itemDescription: string;
  quantity: string;
  quantityUnit: string;
  declaredUnitValue: string;
  declaredTotalValue: number;
  identifierType: string;
  identifierValue: string;
  itemStatus: string;
  remarks: string;
  recoveredNote: string;
}

interface StoredReport {
  reference: string;
  reportType: string;
  reportStatus: string;
  placeOfIncident: string;
  incidentFrom: string;
  incidentTo: string;
  ownerName: string;
  ownerContact: string;
  ownerAddress: string;
  ownerIdType: string;
  ownerIdNumber: string;
  narrative: string;
  firReference: string;
  registeredByName: string;
  districtId: number;
  unitId: number;
  itemCount: number;
  declaredTotal: number;
  noFir: boolean;
  recoveredCount: number;
  createdAt: string;
}

const EMPTY_ITEM = (): ItemDraft => ({
  // Isolation key. Rows are edited and removed by this, never by array index —
  // deleting row 2 must not silently rewrite row 3.
  tempId: Math.random().toString(36).slice(2, 10),
  category: "",
  itemDescription: "",
  quantity: "1",
  quantityUnit: "Pieces",
  declaredUnitValue: "",
  identifierType: "",
  identifierValue: "",
  remarks: "",
});

const EMPTY_REPORT = {
  reportType: "",
  incidentFrom: "",
  incidentTo: "",
  placeOfIncident: "",
  districtId: "",
  unitId: "",
  ownerName: "",
  ownerContact: "",
  ownerAddress: "",
  ownerIdType: "",
  ownerIdNumber: "",
  narrative: "",
  firReference: "",
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textGray,
  fontFamily: ORCA_MONO,
  letterSpacing: "0.03em",
};

const input: React.CSSProperties = {
  padding: "8px 11px",
  fontSize: 13,
  borderRadius: 6,
  border: `1px solid ${T.border}`,
  outline: "none",
  background: "#fff",
  color: T.navy,
  fontFamily: "inherit",
  width: "100%",
};

const hint: React.CSSProperties = { fontSize: 10.5, color: T.textMuted, lineHeight: 1.45 };

const field = (children: React.ReactNode) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
);

const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 18,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const pretty = (v: string) => {
  if (!v) return "—";
  const t = Date.parse(v.includes("T") ? v : v.replace(" ", "T"));
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export const PropertyRegister: React.FC = () => {
  const [tab, setTab] = useState<"register" | "ledger" | "search">("ledger");
  const [reference, setReference] = useState<Ref | null>(null);
  const [refError, setRefError] = useState("");

  const [form, setForm] = useState({ ...EMPTY_REPORT });
  const [items, setItems] = useState<ItemDraft[]>([EMPTY_ITEM()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [badItem, setBadItem] = useState<number | null>(null);
  const [done, setDone] = useState<{ reference: string; itemCount: number } | null>(null);

  const [reports, setReports] = useState<StoredReport[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stolenWithoutFir, setStolenWithoutFir] = useState(0);
  // Supervisory view: only the stolen reports carrying no FIR number.
  const [noFirOnly, setNoFirOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const [openRef, setOpenRef] = useState("");
  const [openItems, setOpenItems] = useState<StoredItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [lookup, setLookup] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  const pristine = useRef(JSON.stringify({ form: EMPTY_REPORT, items: [{ ...EMPTY_ITEM(), tempId: "" }] }));

  /*
   * Dirty is measured against the values the form OPENS with, not against
   * emptiness: quantity starts at "1" and the unit at "Pieces", so comparing
   * to blank would warn on an untouched form.
   */
  const draftDirty =
    tab === "register" &&
    !done &&
    JSON.stringify({ form, items: items.map((i) => ({ ...i, tempId: "" })) }) !== pristine.current;

  useUnsavedWarning(draftDirty);

  // ── Reference data ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/property/reference");
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.success) throw new Error(j.error || "Reference data unavailable.");
        setReference(j);
      } catch (e: any) {
        if (!cancelled) setRefError(e?.message || "Could not load reference data.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/property/reports");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setReports(j.reports || []);
      setCounts(j.counts || {});
      setStolenWithoutFir(j.stolenWithoutFir || 0);
    } catch (e: any) {
      setListError(e?.message || "Could not load the register.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const districtOptions = useMemo(
    () => (reference?.districts || []).map((d) => ({ id: String(d.id), label: d.name })),
    [reference]
  );

  /** Stations in the chosen district. Offering all 202 at once helps nobody. */
  const unitOptions = useMemo(() => {
    const all = reference?.units || [];
    const chosen = Number(form.districtId) || null;
    const scoped = chosen ? all.filter((u) => u.districtId === chosen) : all;
    return scoped.map((u) => ({ id: String(u.id), label: u.name }));
  }, [reference, form.districtId]);

  const cumulative = useMemo(
    () => items.reduce((sum, it) => sum + rowTotal(it.quantity, it.declaredUnitValue), 0),
    [items]
  );

  const patchItem = (tempId: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.tempId === tempId ? { ...it, ...patch } : it)));

  const removeItem = (tempId: string) => {
    const it = items.find((x) => x.tempId === tempId);
    const populated = it && (it.itemDescription.trim() || rowTotal(it.quantity, it.declaredUnitValue) > 0);
    if (populated && !window.confirm("This item has details entered. Remove it?")) return;
    setItems((prev) => {
      const next = prev.filter((x) => x.tempId !== tempId);
      return next.length ? next : [EMPTY_ITEM()];
    });
  };

  const cloneItem = (tempId: string) =>
    setItems((prev) => {
      const i = prev.findIndex((x) => x.tempId === tempId);
      if (i < 0) return prev;
      // Everything carries over EXCEPT the identifier: cloning is for "five
      // identical phones, different IMEIs", and copying the identifier would
      // put the same IMEI on two rows.
      const copy = { ...prev[i], tempId: EMPTY_ITEM().tempId, identifierValue: "" };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    setBadItem(null);
    setSaving(true);
    try {
      const res = await fetch("/api/property/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setFormError(j.error || "Could not register the report.");
        if (typeof j.itemIndex === "number") setBadItem(j.itemIndex);
        return;
      }
      setDone({ reference: j.reference, itemCount: j.itemCount });
      setLoaded(false);
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_REPORT });
    setItems([EMPTY_ITEM()]);
    setDone(null);
    setFormError("");
    setBadItem(null);
  }

  const expand = useCallback(async (ref: string) => {
    if (openRef === ref) { setOpenRef(""); return; }
    setOpenRef(ref);
    setOpenItems([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/property/reports?reference=${encodeURIComponent(ref)}`);
      const j = await res.json();
      if (res.ok && j.success) setOpenItems(j.items || []);
    } catch {
      /* the summary row is already on screen; the item list is supplementary */
    } finally {
      setDetailLoading(false);
    }
  }, [openRef]);

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    if (lookupBusy) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/property/matches?identifier=${encodeURIComponent(lookup)}`);
      setLookupResult(await res.json());
    } catch {
      setLookupResult({ success: false, error: "Search failed." });
    } finally {
      setLookupBusy(false);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (noFirOnly && !r.noFir) return false;
      if (typeFilter !== "ALL" && r.reportType !== typeFilter) return false;
      if (statusFilter !== "ALL" && r.reportStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.placeOfIncident.toLowerCase().includes(q) ||
        r.firReference.toLowerCase().includes(q)
      );
    });
  }, [reports, typeFilter, statusFilter, query, noFirOnly]);

  const tabBtn = (id: typeof tab, text: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? T.navy : "transparent",
        color: tab === id ? "#fff" : T.textGray,
        border: `1px solid ${tab === id ? T.navy : T.border}`,
        borderRadius: 6,
        padding: "7px 16px",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.navy, margin: 0 }}>
            Lost &amp; Stolen Property Register
          </h1>
          <p style={{ fontSize: 12.5, color: T.textGray, margin: "4px 0 0", maxWidth: 720, lineHeight: 1.55 }}>
            A standalone register of property reported lost, stolen or found.{" "}
            <strong style={{ color: T.navy }}>A report here is not an FIR</strong> and creates no case —
            record the FIR number separately if one has been registered.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("ledger", "Register")}
          {tabBtn("register", "New Report")}
          {tabBtn("search", "Identifier Search")}
        </div>
      </div>

      {refError && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: T.red }}>
          {refError}
        </div>
      )}

      {/* ══ REGISTER (ledger) ═══════════════════════════════════════════════ */}
      {tab === "ledger" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12 }}>
            {([
              ["Open", (counts.OPEN || 0) + (counts.UNDER_SEARCH || 0), T.gold],
              ["Recovered", (counts.RECOVERED || 0) + (counts.PARTIALLY_RECOVERED || 0), T.green],
              ["Closed", (counts.CLOSED || 0) + (counts.WITHDRAWN || 0), T.textGray],
              ["Total reports", reports.length, T.navy],
            ] as const).map(([t, v, c]) => (
              <div key={t} style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textGray, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t}</div>
                <div style={{ fontSize: 25, fontWeight: 800, color: c as string, marginTop: 5 }}>{loaded ? v : "—"}</div>
              </div>
            ))}

            {/*
              The supervisory count.
              Theft is cognizable and BNSS s.173 makes registering an FIR
              mandatory, so a stolen report with no FIR number is a gap in a
              duty. A per-report flag buried in an expanded row does nothing
              about that; a number on the ledger that a supervisor can click
              into does. Without it, a standalone property register is
              somewhere a theft complaint can rest quietly and never reach the
              crime figures.
            */}
            <button
              onClick={() => setNoFirOnly((v) => !v)}
              title="Show only theft reports with no FIR number recorded"
              style={{
                ...card, padding: 14, textAlign: "left", cursor: "pointer",
                borderColor: noFirOnly ? T.gold : stolenWithoutFir > 0 ? "rgba(255,153,51,0.55)" : T.border,
                background: noFirOnly ? "rgba(255,153,51,0.10)" : "#fff",
                borderWidth: noFirOnly ? 2 : 1, borderStyle: "solid",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textGray, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Stolen, no FIR
              </div>
              <div style={{ fontSize: 25, fontWeight: 800, color: stolenWithoutFir > 0 ? T.gold : T.green, marginTop: 5 }}>
                {loaded ? stolenWithoutFir : "—"}
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                {noFirOnly ? "Filtering — click to clear" : "Click to filter"}
              </div>
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All types</option>
              {(reference?.reportTypes || []).map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...input, width: "auto" }}>
              <option value="ALL">All statuses</option>
              {(reference?.reportStatuses || []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reference, owner, place, FIR number…"
              style={{ ...input, flex: "1 1 240px", minWidth: 200, width: "auto" }}
            />
            <button
              onClick={() => void load()} disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: T.navy, cursor: loading ? "default" : "pointer" }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
              {loading ? "Reading…" : "Refresh"}
            </button>
          </div>

          {listError && (
            <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: T.red }}>
              {listError}
            </div>
          )}

          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {visible.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <Inbox style={{ width: 34, height: 34, color: T.textMuted, margin: "0 auto 10px" }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.navy }}>
                  {!loaded
                    ? "Reading the register…"
                    : reports.length === 0
                    ? "No property reports recorded"
                    : noFirOnly
                    // Said explicitly: an empty list under this filter is a
                    // clean result, and must not be mistaken for "the filter
                    // found nothing because it is broken".
                    ? "Every theft report carries an FIR number"
                    : "No report matches this filter"}
                </div>
                {loaded && reports.length === 0 && (
                  <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 5 }}>
                    Reports registered under <strong>New Report</strong> appear here.
                  </div>
                )}
              </div>
            ) : (
              visible.map((r) => {
                const isOpen = openRef === r.reference;
                return (
                  <div key={r.reference} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <button
                      onClick={() => void expand(r.reference)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: isOpen ? "rgba(0,31,63,0.03)" : "none", border: "none", textAlign: "left", cursor: "pointer" }}
                    >
                      <span style={{ background: TYPE_COLOR[r.reportType] || T.textMuted, color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 10, fontFamily: ORCA_MONO, flexShrink: 0 }}>
                        {r.reportType}
                      </span>
                      <span style={{ fontFamily: ORCA_MONO, fontSize: 11.5, color: T.textGray, flexShrink: 0 }}>{r.reference}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.navy, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.ownerName || "(owner not recorded)"} · {r.placeOfIncident}
                      </span>
                      <span style={{ fontSize: 11, color: T.textGray, flexShrink: 0 }}>
                        {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                      </span>
                      <span style={{ fontFamily: ORCA_MONO, fontSize: 11.5, fontWeight: 700, color: T.navy, flexShrink: 0 }}>
                        {formatRupees(r.declaredTotal)}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, fontFamily: ORCA_MONO, color: STATUS_COLOR[r.reportStatus] || T.textMuted, border: `1px solid ${STATUS_COLOR[r.reportStatus] || T.border}`, borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>
                        {REPORT_STATUS_LABELS[r.reportStatus] || r.reportStatus}
                      </span>
                      {isOpen ? <ChevronUp style={{ width: 15, height: 15, color: T.textMuted }} /> : <ChevronDown style={{ width: 15, height: 15, color: T.textMuted }} />}
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 16px 18px", background: "rgba(0,31,63,0.02)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "0 0 14px" }}>
                          {([
                            ["OWNER / COMPLAINANT", r.ownerName || "not recorded"],
                            ["CONTACT", r.ownerContact || "not recorded"],
                            ["ID", r.ownerIdType ? `${r.ownerIdType} ${r.ownerIdNumber}` : "not recorded"],
                            ["PLACE", r.placeOfIncident],
                            ["WINDOW", `${pretty(r.incidentFrom)}${r.incidentTo ? " → " + pretty(r.incidentTo) : ""}`],
                            ["FIR REFERENCE", r.firReference || "none recorded"],
                            ["REGISTERED BY", r.registeredByName],
                            ["REGISTERED ON", pretty(r.createdAt)],
                          ] as const).map(([k, v]) => (
                            <div key={k}>
                              <div style={label}>{k}</div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.navy, marginTop: 2, overflowWrap: "anywhere" }}>{v}</div>
                            </div>
                          ))}
                        </div>

                        {r.reportType === "STOLEN" && !r.firReference && (
                          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,153,51,0.07)", border: "1px dashed rgba(255,153,51,0.45)", borderRadius: 6, padding: "10px 12px", marginBottom: 14 }}>
                            <AlertTriangle style={{ width: 15, height: 15, color: T.gold, flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: 12, color: T.textGray, lineHeight: 1.55 }}>
                              <strong style={{ color: T.navy }}>No FIR reference recorded.</strong> Theft is a
                              cognizable offence. This register does not create an FIR — if one has been
                              registered, add its number here.
                            </div>
                          </div>
                        )}

                        {r.narrative && (
                          <div style={{ marginBottom: 14 }}>
                            <div style={label}>NARRATIVE</div>
                            <pre style={{ margin: "5px 0 0", padding: "10px 12px", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5, color: T.navy, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                              {r.narrative}
                            </pre>
                          </div>
                        )}

                        <div style={label}>ITEMS</div>
                        {detailLoading ? (
                          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 6 }}>Reading items…</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                            {openItems.map((it) => (
                              <div key={it.itemId} style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                                  <strong style={{ fontSize: 12.5, color: T.navy }}>{it.category}</strong>
                                  <span style={{ fontSize: 9, fontWeight: 800, fontFamily: ORCA_MONO, color: it.itemStatus === "MISSING" ? T.gold : T.green }}>
                                    {ITEM_STATUS_LABELS[it.itemStatus] || it.itemStatus}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 4, lineHeight: 1.5 }}>{it.itemDescription}</div>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 7, fontSize: 11.5, fontFamily: ORCA_MONO, color: T.textGray }}>
                                  <span>{it.quantity} {it.quantityUnit}</span>
                                  <span>Declared {formatRupees(Number(it.declaredUnitValue) || 0)} each</span>
                                  <strong style={{ color: T.navy }}>Declared total {formatRupees(it.declaredTotalValue)}</strong>
                                  {it.identifierValue && <span>{it.identifierType}: {it.identifierValue}</span>}
                                </div>
                                {it.recoveredNote && (
                                  <div style={{ fontSize: 12, color: T.textGray, marginTop: 6, borderTop: `1px dashed ${T.border}`, paddingTop: 6 }}>
                                    {it.recoveredNote}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ══ NEW REPORT ══════════════════════════════════════════════════════ */}
      {tab === "register" && (done ? (
        <div style={{ ...card, maxWidth: 620 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: T.navy, margin: "0 0 6px" }}>Report Registered</h3>
          <p style={{ fontSize: 13, color: T.textGray, margin: "0 0 16px", lineHeight: 1.55 }}>
            {done.itemCount} item{done.itemCount === 1 ? "" : "s"} recorded against this report.
          </p>
          <div style={{ background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.5)", borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ ...label, fontSize: 9 }}>REFERENCE</div>
            <code style={{ fontFamily: ORCA_MONO, fontSize: 17, fontWeight: 800, color: T.navy }}>{done.reference}</code>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={resetForm} style={{ background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Register another
            </button>
            <button onClick={() => { resetForm(); setTab("ledger"); }} style={{ background: "transparent", color: T.navy, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              View register
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 14px" }}>Report Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              {field(<>
                <label style={label}>REPORT TYPE *</label>
                <select required value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })} style={{ ...input, color: form.reportType ? T.navy : T.textMuted }}>
                  <option value="" disabled>Select lost, stolen or found…</option>
                  {(reference?.reportTypes || []).map((t) => (
                    <option key={t.value} value={t.value} style={{ color: T.navy }}>{t.label}</option>
                  ))}
                </select>
              </>)}
              {field(<>
                <label style={label}>FROM (WHEN IT WENT MISSING) *</label>
                <input type="datetime-local" required value={form.incidentFrom} onChange={(e) => setForm({ ...form, incidentFrom: e.target.value })} style={input} />
              </>)}
              {field(<>
                <label style={label}>UNTIL (OPTIONAL)</label>
                <input type="datetime-local" value={form.incidentTo} onChange={(e) => setForm({ ...form, incidentTo: e.target.value })} style={input} />
                <span style={hint}>Use when the exact time is unknown and only a window can be given.</span>
              </>)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginTop: 14 }}>
              <SearchableSelect
                label="DISTRICT" required value={form.districtId}
                onChange={(v) => setForm({ ...form, districtId: v, unitId: "" })}
                options={districtOptions} emptyMessage="No districts available."
              />
              <SearchableSelect
                label="POLICE STATION" required value={form.unitId}
                onChange={(v) => setForm({ ...form, unitId: v })}
                options={unitOptions}
                emptyMessage={form.districtId ? "No stations in this district." : "Choose a district first."}
              />
              {field(<>
                <label style={label}>PLACE OF INCIDENT *</label>
                <input type="text" required maxLength={LIMITS.place} value={form.placeOfIncident} onChange={(e) => setForm({ ...form, placeOfIncident: e.target.value })} placeholder="Street, landmark or premises" style={input} />
              </>)}
            </div>

            <div style={{ marginTop: 14 }}>
              {field(<>
                <label style={label}>FIR NUMBER (IF ONE HAS BEEN REGISTERED)</label>
                <input type="text" maxLength={LIMITS.firReference} value={form.firReference} onChange={(e) => setForm({ ...form, firReference: e.target.value })} placeholder="e.g. 142/2026" style={{ ...input, maxWidth: 320 }} />
                <span style={hint}>
                  This register does not create an FIR. Registering one is an officer&apos;s decision — record its
                  number here if it has been made.
                </span>
              </>)}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 4px" }}>Owner / Complainant</h3>
            <p style={{ ...hint, margin: "0 0 14px" }}>
              Required for a lost or stolen report. Left blank on a found report, where there is no owner yet.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              {field(<><label style={label}>NAME{form.reportType !== "FOUND" ? " *" : ""}</label>
                <input type="text" maxLength={LIMITS.ownerName} value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} style={input} /></>)}
              {field(<><label style={label}>CONTACT NUMBER{form.reportType !== "FOUND" ? " *" : ""}</label>
                <input type="text" maxLength={LIMITS.ownerContact} value={form.ownerContact} onChange={(e) => setForm({ ...form, ownerContact: e.target.value })} style={input} /></>)}
              {field(<><label style={label}>ID TYPE</label>
                <select value={form.ownerIdType} onChange={(e) => setForm({ ...form, ownerIdType: e.target.value })} style={{ ...input, color: form.ownerIdType ? T.navy : T.textMuted }}>
                  <option value="">Not recorded</option>
                  {(reference?.ownerIdTypes || []).map((t) => <option key={t} value={t} style={{ color: T.navy }}>{t}</option>)}
                </select></>)}
              {field(<><label style={label}>ID NUMBER</label>
                <input type="text" maxLength={LIMITS.ownerIdNumber} value={form.ownerIdNumber} onChange={(e) => setForm({ ...form, ownerIdNumber: e.target.value })} style={input} /></>)}
            </div>
            <div style={{ marginTop: 14 }}>
              {field(<><label style={label}>ADDRESS</label>
                <textarea rows={2} maxLength={LIMITS.ownerAddress} value={form.ownerAddress} onChange={(e) => setForm({ ...form, ownerAddress: e.target.value })} style={{ ...input, resize: "vertical" }} /></>)}
            </div>
          </div>

          {/* Items */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: 0 }}>Property Items</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ background: "rgba(0,31,63,0.04)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px" }}>
                  <span style={{ ...label, fontSize: 9 }}>TOTAL DECLARED VALUE </span>
                  <strong style={{ fontFamily: ORCA_MONO, fontSize: 14, color: T.navy }}>{formatRupees(cumulative)}</strong>
                </div>
                <button type="button" onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Plus style={{ width: 14, height: 14 }} /> Add Item
                </button>
              </div>
            </div>
            <p style={{ ...hint, margin: "0 0 14px" }}>
              Values are as <strong>declared by the owner</strong>. Nothing here is an assessed or verified valuation.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {items.map((it, idx) => {
                const spec = categorySpec(it.category);
                const u = unitSpec(it.quantityUnit);
                const total = rowTotal(it.quantity, it.declaredUnitValue);
                const flagged = badItem === idx;
                return (
                  <div key={it.tempId} style={{ border: `1px solid ${flagged ? T.red : T.border}`, borderRadius: 7, padding: 14, background: flagged ? "rgba(239,68,68,0.03)" : "#fafbfc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ ...label, fontSize: 10 }}>ITEM {idx + 1}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => cloneItem(it.tempId)} title="Duplicate this item"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 10px", fontSize: 11.5, color: T.textGray, cursor: "pointer" }}>
                          <Copy style={{ width: 12, height: 12 }} /> Duplicate
                        </button>
                        <button type="button" onClick={() => removeItem(it.tempId)} title="Remove this item"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 5, padding: "5px 10px", fontSize: 11.5, color: T.red, cursor: "pointer" }}>
                          <Trash2 style={{ width: 12, height: 12 }} /> Remove
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                      {field(<>
                        <label style={label}>CATEGORY *</label>
                        <select required value={it.category}
                          onChange={(e) => patchItem(it.tempId, { category: e.target.value, identifierType: "" })}
                          style={{ ...input, color: it.category ? T.navy : T.textMuted }}>
                          <option value="" disabled>Select a category…</option>
                          {(reference?.categories || []).map((c) => (
                            <option key={c.name} value={c.name} style={{ color: T.navy }}>{c.name}</option>
                          ))}
                        </select>
                      </>)}
                      {field(<>
                        <label style={label}>QUANTITY *</label>
                        <input type="text" inputMode="decimal" required value={it.quantity}
                          onChange={(e) => patchItem(it.tempId, { quantity: e.target.value })} style={input} />
                        <span style={hint}>{u ? u.hint : "Choose a unit."}</span>
                      </>)}
                      {field(<>
                        <label style={label}>UNIT *</label>
                        <select required value={it.quantityUnit}
                          onChange={(e) => patchItem(it.tempId, { quantityUnit: e.target.value })} style={input}>
                          {(reference?.quantityUnits || []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                        </select>
                      </>)}
                      {field(<>
                        <label style={label}>DECLARED VALUE PER UNIT (₹) *</label>
                        <input type="text" inputMode="decimal" required value={it.declaredUnitValue}
                          onChange={(e) => patchItem(it.tempId, { declaredUnitValue: e.target.value })} placeholder="0" style={input} />
                        <span style={hint}>Enter 0 for documents and ID cards with no market value.</span>
                      </>)}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {field(<>
                        <label style={label}>DESCRIPTION *</label>
                        <textarea rows={2} required maxLength={LIMITS.description} value={it.itemDescription}
                          onChange={(e) => patchItem(it.tempId, { itemDescription: e.target.value })}
                          placeholder="Make, model, colour, size, distinguishing marks and condition"
                          style={{ ...input, resize: "vertical" }} />
                      </>)}
                    </div>

                    {/* Category-aware identifier: the label and guidance change with
                        the category, so the officer is told what to look for. */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 12 }}>
                      {field(<>
                        <label style={label}>IDENTIFIER TYPE</label>
                        <select value={it.identifierType} onChange={(e) => patchItem(it.tempId, { identifierType: e.target.value })}
                          style={{ ...input, color: it.identifierType ? T.navy : T.textMuted }}>
                          <option value="">Not recorded</option>
                          {(spec?.identifierTypes || ["Serial Number"]).map((x) => (
                            <option key={x} value={x} style={{ color: T.navy }}>{x}</option>
                          ))}
                        </select>
                      </>)}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                        <label style={label}>{(spec?.identifierLabel || "IDENTIFIER").toUpperCase()}</label>
                        <input type="text" maxLength={LIMITS.identifier} value={it.identifierValue}
                          onChange={(e) => patchItem(it.tempId, { identifierValue: e.target.value })} style={input} />
                        <span style={hint}>
                          {spec ? spec.identifierHint : "Choose a category to see what identifier applies."}
                          {it.identifierValue && !isMatchable(normaliseIdentifier(it.identifierValue)) && (
                            <strong style={{ color: T.gold, display: "block", marginTop: 2 }}>
                              Too short to search against other reports — recorded, but it will not be matched.
                            </strong>
                          )}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 260px" }}>
                        <label style={label}>REMARKS</label>
                        <input type="text" maxLength={LIMITS.remarks} value={it.remarks}
                          onChange={(e) => patchItem(it.tempId, { remarks: e.target.value })} style={input} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ ...label, fontSize: 9 }}>DECLARED TOTAL</div>
                        <strong style={{ fontFamily: ORCA_MONO, fontSize: 15, color: T.navy }}>{formatRupees(total)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={card}>
            {field(<>
              <label style={label}>NARRATIVE</label>
              <textarea rows={4} maxLength={LIMITS.narrative} value={form.narrative}
                onChange={(e) => setForm({ ...form, narrative: e.target.value })}
                placeholder="What happened, in the complainant's account."
                style={{ ...input, resize: "vertical", lineHeight: 1.55 }} />
            </>)}
          </div>

          {formError && (
            <div role="alert" style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: T.red, fontWeight: 600 }}>
              {formError}{badItem !== null ? ` (item ${badItem + 1})` : ""}
            </div>
          )}

          {draftDirty && (
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.45)", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: T.textGray, lineHeight: 1.5 }}>
              <span aria-hidden="true">⚠</span>
              <span><strong style={{ color: T.navy }}>Draft not yet registered.</strong> Nothing is saved until you press Register Report.</span>
            </div>
          )}

          <div>
            <button type="submit" disabled={saving}
              style={{ background: saving ? T.textMuted : T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "11px 26px", fontSize: 13.5, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Registering…" : "Register Report"}
            </button>
          </div>
        </form>
      ))}

      {/* ══ IDENTIFIER SEARCH ═══════════════════════════════════════════════ */}
      {tab === "search" && (
        <div style={{ ...card, maxWidth: 860 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.navy, margin: "0 0 5px" }}>Identifier Search</h3>
          <p style={{ fontSize: 12.5, color: T.textGray, margin: "0 0 14px", lineHeight: 1.6 }}>
            Check an IMEI, chassis number, serial number or wallet address against every report in the
            register. Spaces and punctuation are ignored, so <code style={{ fontFamily: ORCA_MONO }}>KA-01-AB-1234</code>{" "}
            and <code style={{ fontFamily: ORCA_MONO }}>ka01ab1234</code> find each other.
          </p>

          <form onSubmit={runLookup} style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <input type="text" value={lookup} onChange={(e) => setLookup(e.target.value)}
              placeholder="Enter an identifier" style={{ ...input, flex: "1 1 260px", fontFamily: ORCA_MONO, width: "auto" }} />
            <button type="submit" disabled={lookupBusy || !lookup.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: lookupBusy || !lookup.trim() ? T.textMuted : T.navy, color: "#fff", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 12.5, fontWeight: 700, cursor: lookupBusy || !lookup.trim() ? "not-allowed" : "pointer" }}>
              <Search style={{ width: 14, height: 14 }} />
              {lookupBusy ? "Searching…" : "Search"}
            </button>
          </form>

          {lookupResult && (
            <div style={{ marginTop: 16 }}>
              {lookupResult.refused ? (
                <div style={{ background: "rgba(255,153,51,0.08)", border: "1px dashed rgba(255,153,51,0.5)", borderRadius: 6, padding: "11px 13px", fontSize: 12.5, color: T.textGray, lineHeight: 1.55 }}>
                  {lookupResult.refused}
                </div>
              ) : !lookupResult.success ? (
                <div style={{ background: "rgba(239,68,68,0.06)", border: `1px solid ${T.red}`, borderRadius: 6, padding: "11px 13px", fontSize: 12.5, color: T.red }}>
                  {lookupResult.error}
                </div>
              ) : (lookupResult.matches || []).length === 0 ? (
                <div style={{ padding: "22px 14px", textAlign: "center", border: `1px solid ${T.border}`, borderRadius: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.navy }}>No report carries this identifier</div>
                  <div style={{ fontSize: 12, color: T.textGray, marginTop: 4 }}>
                    Nothing in the register records <code style={{ fontFamily: ORCA_MONO }}>{lookupResult.searched}</code>.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.navy, marginBottom: 8 }}>
                    {lookupResult.matches.length} report{lookupResult.matches.length === 1 ? "" : "s"} record this identifier
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lookupResult.matches.map((m: any) => (
                      <div key={`${m.reference}-${m.itemId}`} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "11px 13px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ background: TYPE_COLOR[m.reportType] || T.textMuted, color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 10, fontFamily: ORCA_MONO }}>
                            {m.reportType}
                          </span>
                          <code style={{ fontFamily: ORCA_MONO, fontSize: 12, color: T.navy, fontWeight: 700 }}>{m.reference}</code>
                          <span style={{ fontSize: 12.5, color: T.textGray }}>{m.category}</span>
                          <span style={{ fontSize: 11, fontFamily: ORCA_MONO, color: T.textMuted }}>
                            {ITEM_STATUS_LABELS[m.itemStatus] || m.itemStatus}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: T.textGray, marginTop: 5, lineHeight: 1.5 }}>{m.itemDescription}</div>
                        <div style={{ fontSize: 11.5, fontFamily: ORCA_MONO, color: T.textMuted, marginTop: 5 }}>
                          {m.identifierType}: {m.identifierValue} · {m.placeOfIncident} · {pretty(m.incidentFrom)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/*
                    The basis line is not decoration. Two reports carrying the
                    same string is a fact; that they are the same object is a
                    conclusion only an officer can reach.
                  */}
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 12, background: "rgba(0,31,63,0.03)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "10px 12px" }}>
                    <AlertTriangle style={{ width: 15, height: 15, color: T.gold, flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 11.5, color: T.textGray, lineHeight: 1.55 }}>
                      <strong style={{ color: T.navy }}>This is not a conclusion.</strong> {lookupResult.basis}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
