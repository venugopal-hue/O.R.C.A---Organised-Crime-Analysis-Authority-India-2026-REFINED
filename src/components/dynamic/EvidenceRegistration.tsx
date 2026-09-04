"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUnsavedWarning } from "@/lib/useUnsavedWarning";
import {
  Loader2, AlertTriangle, RefreshCw, Inbox, ShieldCheck, ShieldAlert,
  Paperclip, MapPin, Plus, X, FileText, Link2, ArrowRight, Crosshair,
  Search as SearchIcon, ArrowLeft,
} from "lucide-react";
import { SearchableSelect, type SelectOption } from "@/components/dynamic/SearchableSelect";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import { MapPicker } from "@/components/dynamic/MapPicker";
import { LinkedTasks } from "@/components/dynamic/LinkedTasks";
import {
  validateEvidenceForm,
  isVehicleType,
  EVIDENCE_FIELD_LABELS,
} from "@/lib/evidenceValidation";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * Evidence Management - the hub for physical and digital evidence.
 *
 * Landing view is the register: headline counts, search, filters, and the
 * ledger. Registration sits behind "Register Evidence" rather than being the
 * first thing an officer sees, because looking something up is the common task
 * and registering is the occasional one.
 *
 * Mounted BARE, not inside <Panel>: Panel sets overflow:hidden for its rounded
 * corners, which clips the searchable dropdowns half way down. Same rule as
 * CaseRegistration and CrimeAnalytics.
 */

const NAVY = "#001f3f";
const NAVY_MID = "#002855";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const RED = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const MONO = "JetBrains Mono, monospace";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: NAVY,
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, fontFamily: MONO,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`,
  borderRadius: 4, fontSize: 13, color: TEXT, fontFamily: "inherit", background: "#fff",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8,
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  // No overflow:hidden - it would clip the dropdown panels.
};

interface Lookup { id: number; name: string }
interface CaseOption { id: number; crimeNo: string; caseNo: string; registeredOn: string }

interface Reference {
  types: Lookup[]; statuses: Lookup[]; events: Lookup[];
  officers: Lookup[]; cases: CaseOption[];
}

interface EvidenceRow {
  evidenceId: number; evidenceNo: string; caseMasterId: number | null;
  evidenceTypeId: number | null; description: string; collectedAt: string;
  collectionPlace: string; latitude: number | null; longitude: number | null;
  sealNumber: string; quantity: string; collectedByEmployeeId: number | null;
  currentCustodianEmployeeId: number | null; evidenceStatusId: number | null;
  vehicleNumber: string;
}

interface ChainRow {
  custodyId: number; seqNo: number; eventTypeId: number;
  fromEmployeeId: number | null; toEmployeeId: number | null;
  eventAt: string; location: string; remarks: string;
  recordedByUid: string; recordedAt: string; rowHash: string;
}

interface Verdict {
  intact: boolean; rowsChecked: number; headHash: string | null;
  problems: { kind: string; seqNo: number; detail: string }[];
}

interface Stats {
  total: number; inCustody: number; atForensics: number;
  inCourt: number; closed: number; other: number;
}

interface FileRow {
  evidenceFileId: number; fileName: string; mimeType: string;
  sizeBytes: number; sha256: string; uploadedAt: string;
}

const opts = (l: Lookup[] | undefined): SelectOption[] =>
  (l || []).map((x) => ({ id: String(x.id), label: x.name }));

const nameOf = (l: Lookup[] | undefined, id: number | null) =>
  (id != null && (l || []).find((x) => x.id === id)?.name) || "—";

const prettySize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const EMPTY_FORM = {
  caseMasterId: "", evidenceTypeId: "", description: "", collectedAt: "",
  collectionPlace: "", latitude: "", longitude: "", sealNumber: "", quantity: "",
  // NOT pre-filled. The opening event asserts how the item entered custody -
  // "Collected at Scene" is a claim about what happened, and the form should not
  // make it on the officer's behalf.
  collectedByEmployeeId: "", custodianEmployeeId: "", eventTypeId: "", remarks: "",
  // Optional for most categories, required when the evidence IS a vehicle.
  // A knife has no registration mark, and a placeholder in that column would be
  // fiction in the record - so the field is always present, never pre-filled.
  vehicleNumber: "",
};

/**
 * Label plus inline error for the plain inputs.
 *
 * Every field on this form is mandatory (user decision, 2026-08-24), so the
 * asterisk is unconditional here - the one exception, Vehicle Number, renders
 * its own label because its requirement depends on the selected type.
 */
const Field: React.FC<{
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, error, required = true, children, style }) => (
  <div style={style}>
    <label style={labelStyle}>
      {label} {required && <span style={{ color: RED }}>*</span>}
    </label>
    {children}
    {error && (
      <div style={{ fontSize: 11, color: RED, marginTop: 4, lineHeight: 1.4 }}>{error}</div>
    )}
  </div>
);

export const EvidenceRegistration: React.FC = () => {
  const [tab, setTab] = useState<"register" | "register-list">("register-list");
  const [reference, setReference] = useState<Reference | null>(null);
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  /** Per-field messages, so the officer sees WHICH control is incomplete. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Detail / custody drawer
  const [openId, setOpenId] = useState<number | null>(null);
  const [chain, setChain] = useState<ChainRow[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [evForm, setEvForm] = useState({
    eventTypeId: "", fromEmployeeId: "", toEmployeeId: "",
    eventAt: "", location: "", remarks: "", newStatusId: "",
  });
  const [appending, setAppending] = useState(false);

  /**
   * Warn before a refresh discards an unregistered exhibit or an unsaved
   * custody event.
   *
   * Both are compared against their EMPTY templates, which are genuinely blank
   * here — EMPTY_FORM deliberately pre-fills nothing, because the opening
   * event is a claim about how the item entered custody and the form must not
   * make it for the officer.
   *
   * `pending` counts too: files chosen but not yet uploaded are lost on a
   * reload just as surely as typed text, and are easier to forget.
   */
  const evidenceDirty =
    JSON.stringify(form) !== JSON.stringify(EMPTY_FORM) || pending.length > 0;

  const custodyDirty = Object.values(evForm).some((v) => String(v ?? "").trim().length > 0);

  useUnsavedWarning(evidenceDirty || custodyDirty);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/evidence");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setConfigured(Boolean(j.configured));
      setRows(j.rows || []);
      setStats(j.stats || null);
      setReference(j.reference || null);
    } catch (e: any) {
      setError(e?.message || "Could not load the evidence register.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      /**
       * Vehicle Number is only shown for the Vehicle type, so switching away
       * from it must CLEAR the value, not merely hide it.
       *
       * Otherwise an officer who picks Vehicle, types a registration mark, then
       * corrects the type to Weapon would silently submit that mark against a
       * knife — with no field on screen to show where it came from.
       */
      if (k === "evidenceTypeId" && !isVehicleType(v, reference?.types)) {
        next.vehicleNumber = "";
      }
      return next;
    });
    // Clear this field's message as soon as it is touched. Leaving it up while
    // the officer types reads as though the fix had not registered.
    setFieldErrors((e) => {
      if (k === "evidenceTypeId") {
        return { ...e, evidenceTypeId: "", vehicleNumber: "" };
      }
      return e[k] ? { ...e, [k]: "" } : e;
    });
  };

  /** Browser geolocation - the officer is standing at the scene. */
  const captureLocation = () => {
    if (!navigator.geolocation) { setNotice("This browser cannot provide a location."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set("latitude", p.coords.latitude.toFixed(6));
        set("longitude", p.coords.longitude.toFixed(6));
        setNotice(`Location captured (±${Math.round(p.coords.accuracy)} m).`);
      },
      (err) => setNotice(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async () => {
    /**
     * Validated with the same rules the API enforces, so the form cannot pass
     * its own check and then be refused by the server.
     */
    const { errors, ok } = validateEvidenceForm(form, reference?.types);
    if (!ok) {
      setFieldErrors(errors);
      const missing = Object.keys(errors);
      setError(
        missing.length === 1
          ? errors[missing[0]]
          : `${missing.length} fields need attention: ${missing
              .map((k) => EVIDENCE_FIELD_LABELS[k] || k)
              .join(", ")}.`
      );
      return;
    }
    setFieldErrors({});
    setSaving(true); setNotice(null); setError(null);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        // The route returns `fields` alongside the message, so a server-side
        // refusal marks the same controls the client check would have.
        if (j.fields) setFieldErrors(j.fields);
        throw new Error(j.error || "Registration failed.");
      }

      // Attachments go up after the item exists, since each needs its id.
      let uploaded = 0;
      const failures: string[] = [];
      for (const f of pending) {
        const fd = new FormData();
        fd.append("evidenceId", String(j.evidenceId));
        fd.append("file", f);
        const up = await fetch("/api/evidence/file", { method: "POST", body: fd });
        const uj = await up.json().catch(() => ({}));
        if (up.ok && uj.success) uploaded++;
        else failures.push(`${f.name}: ${uj.error || up.status}`);
      }

      setNotice(
        `Registered ${j.evidenceNo}. Chain of custody opened.` +
        (uploaded ? ` ${uploaded} file(s) attached.` : "") +
        (failures.length ? ` Failed: ${failures.join("; ")}` : "")
      );
      setForm({ ...EMPTY_FORM });
      setFieldErrors({});
      setPending([]);
      await load();
    } catch (e: any) {
      setError(e?.message || "Registration failed.");
    } finally {
      setSaving(false);
    }
  };

  const openChain = async (evidenceId: number) => {
    setOpenId(evidenceId); setChainLoading(true); setChain([]); setVerdict(null); setFiles([]);
    try {
      const res = await fetch(`/api/evidence/custody?evidence=${evidenceId}`);
      const j = await res.json();
      if (j.success) { setChain(j.chain || []); setVerdict(j.verdict || null); setFiles(j.files || []); }
    } finally {
      setChainLoading(false);
    }
  };

  const appendEvent = async () => {
    if (!openId) return;
    setAppending(true);
    try {
      const res = await fetch("/api/evidence/custody", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...evForm, evidenceId: openId }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Could not record the event.");
      setEvForm({ eventTypeId: "", fromEmployeeId: "", toEmployeeId: "", eventAt: "", location: "", remarks: "", newStatusId: "" });
      await openChain(openId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not record the event.");
    } finally {
      setAppending(false);
    }
  };

  /**
   * Search covers evidence number, the linked FIR's crime number, and the
   * description - the three things an officer actually has to hand when
   * looking for an item.
   */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fType && String(r.evidenceTypeId) !== fType) return false;
      if (fStatus && String(r.evidenceStatusId) !== fStatus) return false;
      if (!q) return true;
      const crimeNo = reference?.cases.find((c) => c.id === r.caseMasterId)?.crimeNo || "";
      return (
        r.evidenceNo.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.sealNumber.toLowerCase().includes(q) ||
        // A registration mark is one of the first things anyone searches by.
        (r.vehicleNumber || "").toLowerCase().includes(q) ||
        crimeNo.toLowerCase().includes(q)
      );
    });
  }, [rows, search, fType, fStatus, reference]);

  const filtersActive = Boolean(search || fType || fStatus);
  const resetFilters = () => { setSearch(""); setFType(""); setFStatus(""); };

  const caseOptions: SelectOption[] = useMemo(
    () => (reference?.cases || []).map((c) => ({
      id: String(c.id),
      label: c.crimeNo || c.caseNo || `Case ${c.id}`,
      hint: c.registeredOn ? String(c.registeredOn).slice(0, 10) : undefined,
    })),
    [reference]
  );

  const openItem = rows.find((r) => r.evidenceId === openId) || null;

  /**
   * Whether the selected type IS a vehicle, resolved by NAME through the
   * lookup rather than by a hardcoded id - `EvidenceTypeID = 7` is Vehicle
   * today, but reloading reference data could renumber it and a literal 7 would
   * then start demanding a registration number for the wrong category.
   */
  const vehicleRequired = isVehicleType(form.evidenceTypeId, reference?.types);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Shared heading - the action slot keeps the button beside the title. */}
      <PageHeader
        title="Evidence Management"
        subtitle="Digital evidence intake, custody, storage and forensic tracking"
        style={{ marginBottom: 8 }}
        action={
          <button
            onClick={() => setTab(tab === "register" ? "register-list" : "register")}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
              background: tab === "register" ? "transparent" : NAVY,
              border: tab === "register" ? `1px solid ${BORDER}` : "none",
              borderRadius: 6, fontSize: 13, fontWeight: 700,
              color: tab === "register" ? GRAY : "#fff", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {tab === "register"
              ? <><ArrowLeft style={{ width: 15, height: 15 }} /> Back to Register</>
              : <><Plus style={{ width: 15, height: 15 }} /> Register Evidence</>}
          </button>
        }
      />

      {/* Headline counts. Groupings are defined server-side in evidence.ts so
          the numbers and their meaning cannot drift apart. */}
      {tab === "register-list" && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          {([
            ["Total Evidence", stats?.total, NAVY],
            ["In Custody", stats?.inCustody, GREEN],
            ["At Forensics", stats?.atForensics, AMBER],
            ["Produced in Court", stats?.inCourt, "#1E3A8A"],
            ["Closed / Disposed", stats?.closed, MUTED],
          ] as const).map(([label, value, colour]) => (
            <div key={label} style={{ ...cardStyle, padding: "16px 18px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: colour as string, marginTop: 6, fontFamily: MONO, lineHeight: 1 }}>
                {loading && stats === null ? "–" : (value ?? 0)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* An item whose status matches no group is reported, never absorbed
          silently into one of the cards above. */}
      {tab === "register-list" && stats && stats.other > 0 && (
        <div style={{ ...cardStyle, padding: "10px 14px", borderColor: AMBER, fontSize: 12.5, color: TEXT }}>
          {stats.other} item(s) have a status outside the tracked groups and are counted only in the total.
        </div>
      )}

      {/* Search + filters */}
      {tab === "register-list" && (
        <div style={{ ...cardStyle, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <SearchIcon style={{ width: 15, height: 15, color: MUTED, position: "absolute", left: 11, top: 11 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Evidence No / FIR No / Description"
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>
          <div style={{ minWidth: 175, flex: "0 1 200px" }}>
            <SearchableSelect
              label="Evidence Type" value={fType} onChange={setFType}
              options={opts(reference?.types)} placeholder="All types" emptyMessage="— none —"
            />
          </div>
          <div style={{ minWidth: 175, flex: "0 1 200px" }}>
            <SearchableSelect
              label="Status" value={fStatus} onChange={setFStatus}
              options={opts(reference?.statuses)} placeholder="All statuses" emptyMessage="— none —"
            />
          </div>
          <button
            onClick={resetFilters}
            disabled={!filtersActive}
            style={{
              padding: "9px 14px", background: "transparent", border: `1px solid ${BORDER}`,
              borderRadius: 4, fontSize: 12.5, fontWeight: 600,
              color: filtersActive ? NAVY : MUTED,
              cursor: filtersActive ? "pointer" : "default", whiteSpace: "nowrap",
            }}
          >
            Reset Filters
          </button>
          <button onClick={load} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: GRAY, cursor: "pointer", whiteSpace: "nowrap" }}>
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? "spin 1s linear infinite" : undefined }} />
            Refresh
          </button>
        </div>
      )}


      {error && (
        <div style={{ ...cardStyle, padding: "12px 16px", borderColor: RED, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle style={{ width: 16, height: 16, color: RED, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: RED }}>{error}</span>
        </div>
      )}
      {notice && (
        <div style={{ ...cardStyle, padding: "12px 16px", borderColor: GREEN, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck style={{ width: 16, height: 16, color: GREEN, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: TEXT }}>{notice}</span>
        </div>
      )}
      {!configured && !loading && (
        <div style={{ ...cardStyle, padding: "16px 18px", fontSize: 13, color: GRAY }}>
          The evidence store is not configured on this server, so nothing can be recorded.
        </div>
      )}

      {/* ── New Evidence ─────────────────────────────────────────────────── */}
      {tab === "register" && (
        <div style={{ ...cardStyle, padding: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: OFFWHITE, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evidence Particulars
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
              What was collected, from where, and who holds it now
            </div>
          </div>

          {/*
            EVERY field below is mandatory, for every evidence category
            (user decision, 2026-08-24). A partially recorded exhibit is the
            kind of gap that gets an item excluded in court, so the form no
            longer accepts one.

            Vehicle Number is the single conditional: required when the
            evidence IS a vehicle, present but optional otherwise. A knife has
            no registration mark, and forcing a placeholder into that column
            would put fiction into the record.

            The rules live in evidenceValidation.ts and the API enforces the
            same ones, so the form cannot pass its own check and then be
            refused by the server.
          */}
          <div style={{ padding: 18, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            <div>
              <SearchableSelect
                label="Linked Case / FIR" required
                value={form.caseMasterId} onChange={(v) => set("caseMasterId", v)}
                options={caseOptions}
                placeholder="— Select case —"
                emptyMessage="— No cases registered yet —"
              />
              {fieldErrors.caseMasterId && (
                <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{fieldErrors.caseMasterId}</div>
              )}
            </div>
            <div>
              <SearchableSelect
                label="Evidence Type" required
                value={form.evidenceTypeId} onChange={(v) => set("evidenceTypeId", v)}
                options={opts(reference?.types)} placeholder="— Select —"
                emptyMessage="— No types loaded —"
              />
              {fieldErrors.evidenceTypeId && (
                <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{fieldErrors.evidenceTypeId}</div>
              )}
            </div>

            {/*
              Vehicle Number — shown ONLY when the evidence type is Vehicle
              (user decision, 2026-08-24).

              It is therefore always mandatory when visible, so there is no
              "(optional)" state to render. Selecting a different type CLEARS
              the value rather than merely hiding it: a hidden field that still
              submits its contents would put a registration mark on a knife,
              and nobody would be able to see where it came from.
            */}
            {vehicleRequired && (
              <div>
                <label style={labelStyle}>
                  Vehicle Number <span style={{ color: RED }}>*</span>
                </label>
                <input
                  style={{
                    ...inputStyle,
                    textTransform: "uppercase",
                    fontFamily: MONO,
                    borderColor: fieldErrors.vehicleNumber ? RED : BORDER,
                  }}
                  placeholder="e.g. KA 01 AB 1234"
                  value={form.vehicleNumber}
                  // Uppercased on the way in, not just displayed: registration
                  // marks are cited in upper case, and storing mixed case would
                  // make the register's search miss them.
                  onChange={(e) => set("vehicleNumber", e.target.value.toUpperCase())}
                />
                <div style={{ fontSize: 11, color: fieldErrors.vehicleNumber ? RED : MUTED, marginTop: 4, lineHeight: 1.4 }}>
                  {fieldErrors.vehicleNumber || "Registration mark of the seized vehicle."}
                </div>
              </div>
            )}

            <Field label="Collected On" error={fieldErrors.collectedAt}>
              <input type="datetime-local"
                style={{ ...inputStyle, borderColor: fieldErrors.collectedAt ? RED : BORDER }}
                value={form.collectedAt} onChange={(e) => set("collectedAt", e.target.value)} />
            </Field>

            <Field label="Seal / Packet Number" error={fieldErrors.sealNumber}>
              <input style={{ ...inputStyle, borderColor: fieldErrors.sealNumber ? RED : BORDER }}
                placeholder="e.g. SEAL-2026-0417"
                value={form.sealNumber} onChange={(e) => set("sealNumber", e.target.value)} />
            </Field>

            <Field label="Quantity / Count" error={fieldErrors.quantity}>
              <input style={{ ...inputStyle, borderColor: fieldErrors.quantity ? RED : BORDER }}
                placeholder="e.g. 2 sealed packets"
                value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>

            <div>
              <SearchableSelect
                label="Collected By" required
                value={form.collectedByEmployeeId} onChange={(v) => set("collectedByEmployeeId", v)}
                options={opts(reference?.officers)} placeholder="— Select officer —"
                emptyMessage="— No officers loaded —"
              />
              {fieldErrors.collectedByEmployeeId && (
                <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{fieldErrors.collectedByEmployeeId}</div>
              )}
            </div>
            <div>
              <SearchableSelect
                label="Initial Custodian" required
                value={form.custodianEmployeeId} onChange={(v) => set("custodianEmployeeId", v)}
                options={opts(reference?.officers)} placeholder="— Select officer —"
                emptyMessage="— No officers loaded —"
              />
              {fieldErrors.custodianEmployeeId && (
                <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{fieldErrors.custodianEmployeeId}</div>
              )}
            </div>
            <div>
              <SearchableSelect
                label="Opening Custody Event" required
                value={form.eventTypeId} onChange={(v) => set("eventTypeId", v)}
                options={opts(reference?.events)} placeholder="— Select —"
                emptyMessage="— No event types loaded —"
              />
              {fieldErrors.eventTypeId && (
                <div style={{ fontSize: 11, color: RED, marginTop: 4 }}>{fieldErrors.eventTypeId}</div>
              )}
            </div>
          </div>

          <div style={{ padding: "0 18px 18px", display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
            <Field label="Description" error={fieldErrors.description}>
              <textarea rows={3}
                style={{ ...inputStyle, resize: "vertical", borderColor: fieldErrors.description ? RED : BORDER }}
                placeholder="What the item is, distinguishing marks, condition when collected"
                value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>

          <div style={{ padding: "0 18px 18px", display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <Field label="Place of Collection" error={fieldErrors.collectionPlace} style={{ gridColumn: "1 / -1" }}>
              <input style={{ ...inputStyle, borderColor: fieldErrors.collectionPlace ? RED : BORDER }}
                placeholder="e.g. Outside 42, Hosur Road, Bengaluru"
                value={form.collectionPlace} onChange={(e) => set("collectionPlace", e.target.value)} />
            </Field>
            <Field label="Latitude" error={fieldErrors.latitude}>
              <input style={{ ...inputStyle, borderColor: fieldErrors.latitude ? RED : BORDER }}
                placeholder="e.g. 12.9716"
                value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
            </Field>
            <Field label="Longitude" error={fieldErrors.longitude}>
              <input style={{ ...inputStyle, borderColor: fieldErrors.longitude ? RED : BORDER }}
                placeholder="e.g. 77.5946"
                value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
            </Field>

            {/* Spans two grid columns: both buttons together need ~300px, and a
                single minmax(200px, 1fr) cell forced them to stack. */}
            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "nowrap" }}>
              <button onClick={captureLocation}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: GRAY, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Crosshair style={{ width: 14, height: 14 }} /> Use my location
              </button>
              {/* The officer is often NOT standing where the item was found -
                  recovered later, or logged back at the station - so the point
                  has to be markable by hand as well. */}
              <button onClick={() => setMapOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: NAVY, cursor: "pointer", whiteSpace: "nowrap" }}>
                <MapPin style={{ width: 14, height: 14 }} /> Mark on map
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div style={{ padding: "0 18px 18px" }}>
            <label style={labelStyle}>Attachments (photos, video, PDF)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "transparent", border: `1px dashed ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: GRAY, cursor: "pointer" }}>
                <Paperclip style={{ width: 14, height: 14 }} /> Add files
              </button>
              <input ref={fileRef} type="file" multiple style={{ display: "none" }}
                onChange={(e) => { if (e.target.files) setPending((p) => [...p, ...Array.from(e.target.files!)]); }} />
              {pending.map((f, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "4px 10px", fontSize: 12, color: TEXT }}>
                  <FileText style={{ width: 13, height: 13, color: NAVY_MID }} />
                  {f.name}
                  <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>{prettySize(f.size)}</span>
                  <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}>
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>
              Files are stored in the Catalyst File Store (India) with a SHA-256 recorded, so they can be proved unaltered later. Up to 100 MB each.
            </div>
          </div>

          <div style={{ padding: "14px 18px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setPending([]); setNotice(null); setFieldErrors({}); setError(null); }}
              style={{ padding: "9px 16px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, fontWeight: 600, color: GRAY, cursor: "pointer" }}>
              Clear
            </button>
            <button onClick={submit} disabled={saving || !configured}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", background: NAVY, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "default" : "pointer", opacity: saving || !configured ? 0.6 : 1 }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Plus style={{ width: 14, height: 14 }} />}
              Register Evidence
            </button>
          </div>
        </div>
      )}

      {mapOpen && (
        <MapPicker
          lat={form.latitude ? Number(form.latitude) : null}
          lon={form.longitude ? Number(form.longitude) : null}
          onPick={(la, lo) => {
            set("latitude", la.toFixed(6));
            set("longitude", lo.toFixed(6));
            setNotice(`Collection point marked at ${la.toFixed(6)}, ${lo.toFixed(6)}.`);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}

      {/* ── Evidence Register ────────────────────────────────────────────── */}
      {tab === "register-list" && (
        <div style={{ ...cardStyle, padding: 0 }}>
          {loading ? (
            <OrcaLoader padding="36px 18px" />
          ) : visible.length === 0 ? (
            <div style={{ display: "flex", gap: 12, padding: "36px 20px", color: GRAY, fontSize: 13, lineHeight: 1.6 }}>
              <Inbox style={{ width: 18, height: 18, color: MUTED, flexShrink: 0, marginTop: 1 }} />
              {/* "Nothing here yet" and "nothing matches what you typed" are
                  different situations and need different words. */}
              {rows.length === 0 ? (
                <div>
                  <strong style={{ color: TEXT }}>No evidence registered yet.</strong>
                  <div style={{ marginTop: 4 }}>
                    Use <strong>Register Evidence</strong> to record an item. It appears here with its chain of custody.
                  </div>
                </div>
              ) : (
                <div>
                  <strong style={{ color: TEXT }}>No evidence matches these filters.</strong>
                  <div style={{ marginTop: 4 }}>
                    {rows.length} item{rows.length === 1 ? "" : "s"} registered in total.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Evidence No", "Type", "Description", "Collected", "Custodian", "Status", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, color: GRAY, textTransform: "uppercase", borderBottom: `2px solid ${BORDER}`, background: "rgba(0,0,0,0.01)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.evidenceId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "12px 14px", fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: NAVY }}>{r.evidenceNo}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{nameOf(reference?.types, r.evidenceTypeId)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, maxWidth: 320 }} title={r.description}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</div>
                        {r.vehicleNumber && (
                          <div style={{ fontFamily: MONO, fontSize: 11.5, color: GRAY, marginTop: 2 }}>
                            {r.vehicleNumber}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5, fontFamily: MONO, color: GRAY }}>{r.collectedAt || "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{nameOf(reference?.officers, r.currentCustodianEmployeeId)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12.5 }}>
                        <span style={{ background: `${SAFFRON}22`, color: "#9a5b00", padding: "3px 8px", borderRadius: 4, fontWeight: 600, fontSize: 11.5 }}>
                          {nameOf(reference?.statuses, r.evidenceStatusId)}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button onClick={() => openChain(r.evidenceId)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer" }}>
                          <Link2 style={{ width: 12, height: 12 }} /> Chain
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtersActive && (
                <div style={{ padding: "9px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 11.5, color: MUTED, fontFamily: MONO }}>
                  showing {visible.length} of {rows.length}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chain of custody drawer ──────────────────────────────────────── */}
      {openId !== null && (
        <div style={{ ...cardStyle, padding: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: OFFWHITE, display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Chain of Custody — {openItem?.evidenceNo || `#${openId}`}
              </div>
              <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>Append-only. Entries cannot be edited or removed.</div>
              {openItem?.vehicleNumber && (
                <div style={{ fontSize: 12, color: NAVY, fontFamily: MONO, marginTop: 4 }}>
                  Vehicle {openItem.vehicleNumber}
                </div>
              )}
            </div>
            <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Integrity verdict */}
          {verdict && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 10, background: verdict.intact ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)" }}>
              {verdict.intact
                ? <ShieldCheck style={{ width: 17, height: 17, color: GREEN, flexShrink: 0, marginTop: 1 }} />
                : <ShieldAlert style={{ width: 17, height: 17, color: RED, flexShrink: 0, marginTop: 1 }} />}
              <div style={{ fontSize: 12.5, color: TEXT }}>
                <strong style={{ color: verdict.intact ? GREEN : RED }}>
                  {verdict.intact ? "Chain intact" : "CHAIN BROKEN"}
                </strong>{" "}
                — {verdict.rowsChecked} entr{verdict.rowsChecked === 1 ? "y" : "ies"} verified.
                {verdict.headHash && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 3, wordBreak: "break-all" }}>
                    head {verdict.headHash}
                  </div>
                )}
                {verdict.problems.map((p, i) => (
                  <div key={i} style={{ color: RED, marginTop: 4 }}>Entry {p.seqNo}: {p.detail}</div>
                ))}
              </div>
            </div>
          )}

          {/*
            Tasks raised on this exhibit. "Create Task" carries the exhibit and
            its case across, so an officer sending an item for forensic
            examination never retypes the identifiers.
          */}
          {openId !== null && (
            <div style={{ padding: "0 18px 16px" }}>
              <LinkedTasks
                evidenceId={openId}
                caseMasterId={rows.find((r) => r.evidenceId === openId)?.caseMasterId ?? null}
              />
            </div>
          )}

          {chainLoading ? (
            <OrcaLoader padding="28px 18px" />
          ) : (
            <div style={{ padding: "14px 18px" }}>
              {chain.map((c) => (
                <div key={c.custodyId} style={{ display: "flex", gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: MONO }}>
                    {c.seqNo}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>
                      {nameOf(reference?.events, c.eventTypeId)}
                    </div>
                    <div style={{ fontSize: 12.5, color: GRAY, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: MONO }}>{c.eventAt}</span>
                      {c.location && <>· <span>{c.location}</span></>}
                      {(c.fromEmployeeId || c.toEmployeeId) && (
                        <>· <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {nameOf(reference?.officers, c.fromEmployeeId)}
                          <ArrowRight style={{ width: 12, height: 12, color: MUTED }} />
                          {nameOf(reference?.officers, c.toEmployeeId)}
                        </span></>
                      )}
                    </div>
                    {c.remarks && <div style={{ fontSize: 12.5, color: TEXT, marginTop: 4 }}>{c.remarks}</div>}
                    <div style={{ fontSize: 10.5, color: MUTED, marginTop: 4, fontFamily: MONO, wordBreak: "break-all" }}>
                      recorded {c.recordedAt} · {c.rowHash.slice(0, 16)}…
                    </div>
                  </div>
                </div>
              ))}

              {/* Attachments */}
              {files.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>Attachments</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {files.map((f) => (
                      <a key={f.evidenceFileId} href={`/api/evidence/file?id=${f.evidenceFileId}&evidence=${openId}`} target="_blank" rel="noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, color: TEXT, textDecoration: "none" }}>
                        <FileText style={{ width: 14, height: 14, color: NAVY_MID }} />
                        <span style={{ fontWeight: 600 }}>{f.fileName}</span>
                        <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11 }}>{prettySize(f.sizeBytes)}</span>
                        <span style={{ marginLeft: "auto", color: MUTED, fontFamily: MONO, fontSize: 10 }} title={`SHA-256 ${f.sha256}`}>
                          {f.sha256.slice(0, 12)}…
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Append an event */}
              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ ...labelStyle, marginBottom: 10 }}>Record a custody event</div>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                  <SearchableSelect label="What happened" value={evForm.eventTypeId}
                    onChange={(v) => setEvForm((f) => ({ ...f, eventTypeId: v }))}
                    options={opts(reference?.events)} placeholder="— Select —" emptyMessage="— none —" />
                  <SearchableSelect label="From" value={evForm.fromEmployeeId}
                    onChange={(v) => setEvForm((f) => ({ ...f, fromEmployeeId: v }))}
                    options={opts(reference?.officers)} placeholder="— Officer —" emptyMessage="— none —" />
                  <SearchableSelect label="To" value={evForm.toEmployeeId}
                    onChange={(v) => setEvForm((f) => ({ ...f, toEmployeeId: v }))}
                    options={opts(reference?.officers)} placeholder="— Officer —" emptyMessage="— none —" />
                  <SearchableSelect label="New status" value={evForm.newStatusId}
                    onChange={(v) => setEvForm((f) => ({ ...f, newStatusId: v }))}
                    options={opts(reference?.statuses)} placeholder="— Unchanged —" emptyMessage="— none —" />
                  <div>
                    <label style={labelStyle}>When <span style={{ color: RED }}>*</span></label>
                    <input type="datetime-local" style={inputStyle} value={evForm.eventAt}
                      onChange={(e) => setEvForm((f) => ({ ...f, eventAt: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Where</label>
                    <input style={inputStyle} placeholder="e.g. FSL Bengaluru" value={evForm.location}
                      onChange={(e) => setEvForm((f) => ({ ...f, location: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Remarks</label>
                  <input style={inputStyle} placeholder="Reason for the transfer, receipt number, condition of seal"
                    value={evForm.remarks} onChange={(e) => setEvForm((f) => ({ ...f, remarks: e.target.value }))} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button onClick={appendEvent} disabled={appending}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: NAVY, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, color: "#fff", cursor: appending ? "default" : "pointer", opacity: appending ? 0.6 : 1 }}>
                    {appending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Plus style={{ width: 14, height: 14 }} />}
                    Append to Chain
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvidenceRegistration;
