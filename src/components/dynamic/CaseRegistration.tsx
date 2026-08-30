"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useUnsavedWarning } from "@/lib/useUnsavedWarning";
import {
  FilePlus2,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Printer,
  RotateCcw,
  Database,
  MapPin,
  Scale,
  Users,
  UserX,
  ShieldAlert,
  FileText,
  ListOrdered,
  Database as DatabaseIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CaseLedger } from "@/components/dynamic/CaseLedger";
import { ReferenceDataLoader } from "@/components/dynamic/ReferenceDataLoader";
import { SearchableSelect } from "@/components/dynamic/SearchableSelect";
import { FIRLetterhead, FIRDocumentData } from "@/components/dynamic/FIRLetterhead";
import { PageHeader, HeaderChip } from "@/components/layout/PageHeader";

// ── Shared visual tokens (matching the dashboard's inline design system) ────
const NAVY = "#001f3f";
const NAVY_MID = "#002855";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const MONO = "JetBrains Mono, monospace";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: NAVY,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 5,
  fontFamily: MONO,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  fontSize: 13,
  color: TEXT,
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, right, children }) => (
  <div
    style={{
      background: "#fff",
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      // No `overflow: hidden` here — it would clip the searchable dropdown
      // panels that open out of these cards. The header rounds its own top
      // corners instead, which is what the hidden overflow was for.
    }}
  >
    <div
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        borderRadius: "8px 8px 0 0",
        background: "rgba(0,0,0,0.01)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {icon}
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NAVY,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: MONO,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
    <div style={{ padding: 16 }}>{children}</div>
  </div>
);

const Grid: React.FC<{ cols?: string; children: React.ReactNode }> = ({
  cols = "repeat(auto-fit, minmax(220px, 1fr))",
  children,
}) => <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14 }}>{children}</div>;

interface Option { id: string; label: string; extra?: any }
interface MasterList { options: Option[]; error?: string }

/**
 * Select and RepeatBlock are declared at module scope on purpose. Declaring a
 * component inside another component gives it a new type on every render, which
 * makes React unmount and remount the subtree — text inputs would lose focus
 * after each keystroke.
 */
const LookupSelect: React.FC<{
  label: string;
  table: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  required?: boolean;
}> = ({ label, table, value, onChange, options, required }) => (
  // Internal surrogate IDs stay hidden — an officer picks "Bengaluru Urban",
  // not "Bengaluru Urban (443)". Act and Section are the exception and render
  // their codes, because those codes are what officers actually cite.
  <SearchableSelect
    label={label}
    value={value}
    onChange={onChange}
    options={options.map((o) => ({ id: o.id, label: o.label }))}
    emptyMessage={`— ${table} has no reference data —`}
    required={required}
  />
);

function RepeatBlock<T>({
  rows, setRows, blank, render, addLabel,
}: {
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  blank: () => T;
  render: (row: T, i: number, update: (k: string, v: string) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${BORDER}`,
            borderLeft: `3px solid ${SAFFRON}`,
            borderRadius: 6,
            padding: 14,
            background: OFFWHITE,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: MONO, letterSpacing: "0.08em" }}>
              ENTRY {String(i + 1).padStart(2, "0")}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((p) => p.filter((_, x) => x !== i))}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#ef4444", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <Trash2 style={{ width: 13, height: 13 }} /> Remove
              </button>
            )}
          </div>
          {render(row, i, (k, v) =>
            setRows((p) => p.map((r, x) => (x === i ? { ...r, [k]: v } : r)))
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((p) => [...p, blank()])}
        style={{
          alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
          background: "#fff", border: `1px dashed ${NAVY}`, color: NAVY,
          borderRadius: 4, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        <Plus style={{ width: 14, height: 14 }} /> {addLabel}
      </button>
    </div>
  );
}

const emptyComplainant = () => ({
  ComplainantName: "", AgeYear: "", OccupationID: "", ReligionID: "", CasteID: "", GenderID: "",
});
const emptyVictim = () => ({ VictimName: "", AgeYear: "", GenderID: "", VictimPolice: "0" });
const emptyAccused = () => ({ AccusedName: "", AgeYear: "", GenderID: "", PersonID: "" });
const emptySection = () => ({ ActID: "", SectionID: "" });

export const CaseRegistration: React.FC = () => {
  const { officerProfile } = useAuth();

  const [subTab, setSubTab] = useState<"new" | "ledger" | "reference">("new");
  const [masters, setMasters] = useState<Record<string, MasterList>>({});
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadingMasters, setLoadingMasters] = useState(true);

  const [caseData, setCaseData] = useState<Record<string, string>>({
    CaseCategoryID: "", CrimeRegisteredDate: new Date().toISOString().slice(0, 10),
    DistrictID: "", PoliceStationID: "", PolicePersonID: "", GravityOffenceID: "",
    CrimeMajorHeadID: "", CrimeMinorHeadID: "", CaseStatusID: "", CourtID: "",
    IncidentFromDate: "", IncidentToDate: "", InfoReceivedPSDate: "",
    latitude: "", longitude: "", BriefFacts: "",
  });

  const [complainants, setComplainants] = useState([emptyComplainant()]);
  const [victims, setVictims] = useState([emptyVictim()]);
  const [accused, setAccused] = useState([emptyAccused()]);
  const [actSections, setActSections] = useState([emptySection()]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  /**
   * Warn before a refresh discards an unregistered case.
   *
   * This is the longest form in the platform — a case carries complainants,
   * victims, accused and act sections, each an added row. Losing it to a
   * stray F5 costs an officer the whole entry.
   *
   * "Dirty" is measured against the values the form OPENS with, not against
   * emptiness: CrimeRegisteredDate is pre-set to today and VictimPolice to
   * "0", so an untouched form is not blank and comparing to blank would warn
   * every time. Anything the officer actually changed, or any row they added,
   * shows up as a difference from this snapshot.
   */
  const pristine = useRef({
    caseData: JSON.stringify(caseData),
    rows: JSON.stringify([
      [emptyComplainant()], [emptyVictim()], [emptyAccused()], [emptySection()],
    ]),
  });

  const caseDirty =
    subTab === "new" &&
    !result &&
    (JSON.stringify(caseData) !== pristine.current.caseData ||
      JSON.stringify([complainants, victims, accused, actSections]) !== pristine.current.rows);

  useUnsavedWarning(caseDirty);

  // ── Load reference data ──────────────────────────────────────────────────
  const loadMasters = useCallback(async () => {
    setLoadingMasters(true);
    setLoadError("");
    try {
      const res = await fetch("/api/fir/masters");
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setMasters(data.masters || {});
      if (!data.success && data.error) setLoadError(data.error);
    } catch (e: any) {
      setConfigured(false);
      setLoadError(e.message || "Could not reach the reference data service.");
    } finally {
      setLoadingMasters(false);
    }
  }, []);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  const opts = (table: string): Option[] => masters[table]?.options || [];

  // Crime sub-heads belong to the selected major head.
  const subHeadOptions = useMemo(() => {
    const all = masters["CrimeSubHead"]?.options || [];
    if (!caseData.CrimeMajorHeadID) return all;
    return all.filter(
      (o) => String(o.extra?.CrimeHeadID ?? "") === String(caseData.CrimeMajorHeadID)
    );
  }, [masters, caseData.CrimeMajorHeadID]);

  // Police stations/units belong to the selected district.
  const stationOptions = useMemo(() => {
    const all = masters["Unit"]?.options || [];
    if (!caseData.DistrictID) return all;
    return all.filter((o) => String(o.extra?.DistrictID ?? "") === String(caseData.DistrictID));
  }, [masters, caseData.DistrictID]);

  /**
   * Sections belong to the act chosen on that row.
   *
   * Returns nothing until an act is picked. Section codes are NOT unique across
   * acts - IPC and BNS share 358 of them, and a bare "103" means "Punishment
   * for murder" under BNS but "right of private defence of property" under IPC.
   * Offering the union would let an officer pick an ambiguous code, and would
   * render two options carrying the same React key.
   */
  const sectionsForAct = (actCode: string): Option[] => {
    if (!actCode) return [];
    return opts("Section").filter((o) => String(o.extra?.ActCode ?? "") === String(actCode));
  };

  // ── Live Crime Number preview (mirrors the server's composition) ─────────
  const crimeNoPreview = useMemo(() => {
    const pad = (v: string, w: number) =>
      String(v || "").replace(/\D/g, "").padStart(w, "0").slice(-w);
    if (!caseData.CaseCategoryID || !caseData.PoliceStationID || !caseData.CrimeRegisteredDate) {
      return null;
    }
    // Year comes straight off the registration date string, keeping this pure.
    const year = caseData.CrimeRegisteredDate.slice(0, 4);
    return (
      pad(caseData.CaseCategoryID, 1) +
      pad(caseData.DistrictID, 4) +
      pad(caseData.PoliceStationID, 4) +
      pad(year, 4) +
      "?????"
    );
  }, [caseData.CaseCategoryID, caseData.DistrictID, caseData.PoliceStationID, caseData.CrimeRegisteredDate]);

  const set = (k: string, v: string) => setCaseData((p) => ({ ...p, [k]: v }));
  const setDistrict = (districtId: string) =>
    setCaseData((p) => {
      const selectedStation = masters["Unit"]?.options.find((o) => o.id === p.PoliceStationID);
      const stationStillValid =
        !selectedStation ||
        !districtId ||
        String(selectedStation.extra?.DistrictID ?? "") === String(districtId);
      return {
        ...p,
        DistrictID: districtId,
        PoliceStationID: stationStillValid ? p.PoliceStationID : "",
      };
    });

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    setResult(null);

    if (!caseData.CaseCategoryID || !caseData.PoliceStationID || !caseData.CrimeRegisteredDate) {
      setError("Case Category, Police Station and Registration Date are required to compose the Crime Number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/fir/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseMaster: caseData,
          complainants,
          victims,
          accused,
          actSections,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Registration failed.");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message || "Registration request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCaseData({
      CaseCategoryID: "", CrimeRegisteredDate: new Date().toISOString().slice(0, 10),
      DistrictID: "", PoliceStationID: "", PolicePersonID: "", GravityOffenceID: "",
      CrimeMajorHeadID: "", CrimeMinorHeadID: "", CaseStatusID: "", CourtID: "",
      IncidentFromDate: "", IncidentToDate: "", InfoReceivedPSDate: "",
      latitude: "", longitude: "", BriefFacts: "",
    });
    setComplainants([emptyComplainant()]);
    setVictims([emptyVictim()]);
    setAccused([emptyAccused()]);
    setActSections([emptySection()]);
    setResult(null);
    setError("");
  };

  const labelFor = (table: string, id: string) =>
    opts(table).find((o) => o.id === String(id))?.label || "";

  // Build the letterhead payload from the form + resolved master labels.
  const firDocument = (): FIRDocumentData | null => {
    if (!result) return null;
    const genderLabel = (g: string) =>
      ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" }[g] || g || "");
    return {
      crimeNo: result.crimeNo,
      caseNo: result.caseNo,
      caseCategory: labelFor("CaseCategory", caseData.CaseCategoryID),
      registeredDate: caseData.CrimeRegisteredDate,
      policeStation: labelFor("Unit", caseData.PoliceStationID),
      district: labelFor("District", caseData.DistrictID),
      gravity: labelFor("GravityOffence", caseData.GravityOffenceID),
      caseStatus: labelFor("CaseStatusMaster", caseData.CaseStatusID),
      court: labelFor("Court", caseData.CourtID),
      registeringOfficer:
        labelFor("Employee", caseData.PolicePersonID) || result.registeredBy || officerProfile?.name || "",
      incidentFrom: caseData.IncidentFromDate,
      incidentTo: caseData.IncidentToDate,
      infoReceived: caseData.InfoReceivedPSDate,
      latitude: caseData.latitude,
      longitude: caseData.longitude,
      briefFacts: caseData.BriefFacts,
      actSections: actSections
        .filter((s) => s.ActID && s.SectionID)
        .map((s) => {
          const act = opts("Act").find((o) => o.id === s.ActID);
          // Section codes are NOT unique across acts - IPC and BNS share 358 of
          // them (both have a 103, meaning entirely different offences), so the
          // act has to be part of the match or the letterhead can print the
          // wrong offence description on an official document.
          const sec = opts("Section").find(
            (o) => o.id === s.SectionID && String(o.extra?.ActCode ?? "") === String(s.ActID)
          );
          return {
            act: act?.label || s.ActID,
            actCode: s.ActID,
            section: s.SectionID,
            sectionDesc: sec?.label || "",
          };
        }),
      complainants: complainants
        .filter((c) => c.ComplainantName.trim())
        .map((c) => ({ name: c.ComplainantName, age: c.AgeYear, gender: genderLabel(c.GenderID) })),
      victims: victims
        .filter((v) => v.VictimName.trim())
        .map((v) => ({ name: v.VictimName, age: v.AgeYear, gender: genderLabel(v.GenderID) })),
      accused: accused
        .filter((a) => a.AccusedName.trim())
        .map((a, i) => ({
          ref: a.PersonID || `A${i + 1}`,
          name: a.AccusedName,
          age: a.AgeYear,
          gender: genderLabel(a.GenderID),
        })),
    };
  };

  // globals.css hides everything except .report-frame under @media print,
  // so this prints the letterhead alone.
  const handlePrint = () => window.print();

  const sub = (row: any, update: (k: string, v: string) => void, field: string, ph: string, type = "text") => (
    <input
      type={type}
      value={row[field] || ""}
      placeholder={ph}
      min={field === "AgeYear" ? 1 : undefined}
      step={field === "AgeYear" ? 1 : undefined}
      inputMode={field === "AgeYear" ? "numeric" : undefined}
      onChange={(e) => {
        if (field !== "AgeYear") {
          update(field, e.target.value);
          return;
        }
        const value = e.target.value;
        if (value === "" || /^[1-9]\d{0,2}$/.test(value)) update(field, value);
      }}
      style={inputStyle}
    />
  );

  const genderSelect = (row: any, update: (k: string, v: string) => void, numeric: boolean) => (
    <select value={row.GenderID || ""} onChange={(e) => update("GenderID", e.target.value)} style={inputStyle}>
      <option value="">— Gender —</option>
      <option value={numeric ? "1" : "M"}>Male</option>
      <option value={numeric ? "2" : "F"}>Female</option>
      <option value={numeric ? "3" : "T"}>Transgender</option>
    </select>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Heading ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Case Registration"
        subtitle="Register an FIR, UDR, PAR or Zero FIR into the Karnataka Police case ledger."
        style={{ marginBottom: 8 }}
        action={
          crimeNoPreview ? (
            <HeaderChip
              label="CRIME NUMBER PREVIEW"
              value={crimeNoPreview}
              hint="CAT · DISTRICT · UNIT · YEAR · SERIAL"
            />
          ) : undefined
        }
      />

      {/* ── Connection state ───────────────────────────────────────────── */}
      {!loadingMasters && configured === false && (
        <div
          style={{
            background: "rgba(249,115,22,0.07)",
            border: "1px solid #fdba74",
            borderRadius: 6,
            padding: "12px 16px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle style={{ width: 18, height: 18, color: "#f97316", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.55 }}>
            <strong style={{ color: "#c2410c" }}>Catalyst not connected.</strong> The form is fully
            usable, but dropdowns stay empty and cases cannot be saved until the Catalyst credentials
            are present in <code style={{ fontFamily: MONO }}>.env.local</code>.
            {loadError && <div style={{ marginTop: 4, color: MUTED }}>{loadError}</div>}
          </div>
        </div>
      )}

      {!loadingMasters && configured === true && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap",
            background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED }}>
            <Database style={{ width: 15, height: 15, color: "#10b981" }} />
            Connected to Catalyst Data Store ·{" "}
            <strong style={{ color: NAVY, fontFamily: MONO }}>
              {Object.values(masters).reduce((n, m) => n + m.options.length, 0)} reference records
            </strong>
          </div>
          <button
            onClick={loadMasters}
            style={{
              background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4,
              padding: "5px 11px", fontSize: 11, fontWeight: 600, color: NAVY, cursor: "pointer",
            }}
          >
            Reload reference data
          </button>
        </div>
      )}

      {loadingMasters && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: MUTED, padding: "6px 2px" }}>
          <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
          Loading reference data from Catalyst…
        </div>
      )}

      {/* ── Sub-tab bar ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${BORDER}` }}>
        {([
          ["new", "New Registration", <FilePlus2 key="a" style={{ width: 14, height: 14 }} />],
          ["ledger", "Registered Cases", <ListOrdered key="b" style={{ width: 14, height: 14 }} />],
          ["reference", "Reference Data", <DatabaseIcon key="c" style={{ width: 14, height: 14 }} />],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setSubTab(id as typeof subTab)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 16px", fontSize: 12.5,
              fontWeight: subTab === id ? 700 : 600,
              color: subTab === id ? NAVY : MUTED,
              borderBottom: `2px solid ${subTab === id ? SAFFRON : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {subTab === "ledger" && <CaseLedger labelFor={labelFor} opts={opts} />}
      {subTab === "reference" && <ReferenceDataLoader onLoaded={loadMasters} />}

      {subTab === "new" && (<>

      {/* ── A. Case particulars ────────────────────────────────────────── */}
      <Section
        icon={<FileText style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Case Particulars"
        subtitle="Identifies the case and composes its Crime Number"
      >
        <Grid>
          <LookupSelect label="Case Category" table="CaseCategory" value={caseData.CaseCategoryID} onChange={(v) => set("CaseCategoryID", v)} options={opts("CaseCategory")} required />
          <div>
            <label style={labelStyle}>
              Registration Date <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="date"
              value={caseData.CrimeRegisteredDate}
              onChange={(e) => set("CrimeRegisteredDate", e.target.value)}
              style={inputStyle}
            />
          </div>
          <LookupSelect label="District" table="District" value={caseData.DistrictID} onChange={setDistrict} options={opts("District")} />
          <LookupSelect label="Police Station / Unit" table="Unit" value={caseData.PoliceStationID} onChange={(v) => set("PoliceStationID", v)} options={stationOptions} required />
          <LookupSelect label="Registering Officer" table="Employee" value={caseData.PolicePersonID} onChange={(v) => set("PolicePersonID", v)} options={opts("Employee")} />
          <LookupSelect label="Gravity of Offence" table="GravityOffence" value={caseData.GravityOffenceID} onChange={(v) => set("GravityOffenceID", v)} options={opts("GravityOffence")} />
          <LookupSelect label="Major Crime Head" table="CrimeHead" value={caseData.CrimeMajorHeadID} onChange={(v) => set("CrimeMajorHeadID", v)} options={opts("CrimeHead")} />
          <LookupSelect label="Minor Crime Sub-Head" table="CrimeSubHead" value={caseData.CrimeMinorHeadID} onChange={(v) => set("CrimeMinorHeadID", v)} options={subHeadOptions} />
          <LookupSelect label="Case Status" table="CaseStatusMaster" value={caseData.CaseStatusID} onChange={(v) => set("CaseStatusID", v)} options={opts("CaseStatusMaster")} />
          <LookupSelect label="Court" table="Court" value={caseData.CourtID} onChange={(v) => set("CourtID", v)} options={opts("Court")} />
        </Grid>
      </Section>

      {/* ── B. Incident ────────────────────────────────────────────────── */}
      <Section
        icon={<MapPin style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Incident Details"
        subtitle="When and where the offence occurred"
      >
        <Grid>
          <div>
            <label style={labelStyle}>Incident From</label>
            <input type="datetime-local" value={caseData.IncidentFromDate}
              onChange={(e) => set("IncidentFromDate", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Incident To</label>
            <input type="datetime-local" value={caseData.IncidentToDate}
              onChange={(e) => set("IncidentToDate", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Information Received at PS</label>
            <input type="datetime-local" value={caseData.InfoReceivedPSDate}
              onChange={(e) => set("InfoReceivedPSDate", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Latitude</label>
            <input type="number" step="any" placeholder="e.g. 12.9716" value={caseData.latitude}
              onChange={(e) => set("latitude", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Longitude</label>
            <input type="number" step="any" placeholder="e.g. 77.5946" value={caseData.longitude}
              onChange={(e) => set("longitude", e.target.value)} style={inputStyle} />
          </div>
        </Grid>
      </Section>

      {/* ── C. Acts & sections ─────────────────────────────────────────── */}
      <Section
        icon={<Scale style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Acts & Sections Invoked"
        subtitle="Legal provisions under which the case is registered"
      >
        <RepeatBlock
          rows={actSections}
          setRows={setActSections}
          blank={emptySection}
          addLabel="Add Act / Section"
          render={(row: any, i, update) => (
            <Grid cols="repeat(auto-fit, minmax(240px, 1fr))">
              <div>
                <SearchableSelect
                  label=""
                  value={row.ActID || ""}
                  onChange={(v) => { update("ActID", v); update("SectionID", ""); }}
                  options={opts("Act").map((o) => ({ id: o.id, label: o.label, hint: o.id }))}
                  emptyMessage="— Act has no reference data —"
                  placeholder="— Select Act —"
                />
              </div>
              <div>
                <SearchableSelect
                  label=""
                  value={row.SectionID || ""}
                  onChange={(v) => update("SectionID", v)}
                  options={sectionsForAct(row.ActID).map((o) => ({ id: o.id, label: `${o.id} — ${o.label}` }))}
                  emptyMessage={row.ActID ? "— No sections listed for this Act —" : "— Choose an Act first —"}
                  placeholder="— Select Section —"
                />
              </div>
            </Grid>
          )}
        />
      </Section>

      {/* ── D. Complainants ────────────────────────────────────────────── */}
      <Section
        icon={<Users style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Complainant Details"
        subtitle="One case may carry multiple complainants"
      >
        <RepeatBlock
          rows={complainants}
          setRows={setComplainants}
          blank={emptyComplainant}
          addLabel="Add Complainant"
          render={(row: any, i, update) => (
            <Grid>
              <div><label style={labelStyle}>Full Name</label>{sub(row, update, "ComplainantName", "e.g. Ramesh Kumar")}</div>
              <div><label style={labelStyle}>Age</label>{sub(row, update, "AgeYear", "e.g. 42", "number")}</div>
              <div><label style={labelStyle}>Gender</label>{genderSelect(row, update, true)}</div>
              <div>
                {/* SearchableSelect, not a native <select>: gives the "x of y"
                    footer and in-page scrollbar the rest of the form uses. */}
                <SearchableSelect
                  label="Occupation"
                  value={row.OccupationID || ""}
                  onChange={(v) => update("OccupationID", v)}
                  options={opts("OccupationMaster").map((o) => ({ id: o.id, label: o.label }))}
                  emptyMessage="— no reference data —"
                  placeholder="— Select —"
                />
              </div>
              <div>
                <SearchableSelect
                  label="Religion"
                  value={row.ReligionID || ""}
                  onChange={(v) => update("ReligionID", v)}
                  options={opts("ReligionMaster").map((o) => ({ id: o.id, label: o.label }))}
                  emptyMessage="— no reference data —"
                  placeholder="— Select —"
                />
              </div>
              <div>
                <SearchableSelect
                  label="Caste"
                  value={row.CasteID || ""}
                  onChange={(v) => update("CasteID", v)}
                  options={opts("CasteMaster").map((o) => ({ id: o.id, label: o.label }))}
                  emptyMessage="— no reference data —"
                  placeholder="— Select —"
                />
              </div>
            </Grid>
          )}
        />
      </Section>

      {/* ── E. Victims ─────────────────────────────────────────────────── */}
      <Section
        icon={<ShieldAlert style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Victim Details"
        subtitle="Leave blank where the case has no distinct victim"
      >
        <RepeatBlock
          rows={victims}
          setRows={setVictims}
          blank={emptyVictim}
          addLabel="Add Victim"
          render={(row: any, i, update) => (
            <Grid>
              <div><label style={labelStyle}>Full Name</label>{sub(row, update, "VictimName", "e.g. Lakshmi Devi")}</div>
              <div><label style={labelStyle}>Age</label>{sub(row, update, "AgeYear", "e.g. 29", "number")}</div>
              <div><label style={labelStyle}>Gender</label>{genderSelect(row, update, true)}</div>
              <div>
                <label style={labelStyle}>Serving Police Officer?</label>
                <select value={row.VictimPolice || "0"} onChange={(e) => update("VictimPolice", e.target.value)} style={inputStyle}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
            </Grid>
          )}
        />
      </Section>

      {/* ── F. Accused ─────────────────────────────────────────────────── */}
      <Section
        icon={<UserX style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Accused Details"
        subtitle="Reference codes A1, A2, A3… are assigned in order"
      >
        <RepeatBlock
          rows={accused}
          setRows={setAccused}
          blank={emptyAccused}
          addLabel="Add Accused"
          render={(row: any, i, update) => (
            <Grid>
              <div>
                <label style={labelStyle}>Reference</label>
                <input value={row.PersonID || `A${i + 1}`} onChange={(e) => update("PersonID", e.target.value)}
                  style={{ ...inputStyle, fontFamily: MONO }} />
              </div>
              <div><label style={labelStyle}>Full Name</label>{sub(row, update, "AccusedName", "Full name as recorded")}</div>
              <div><label style={labelStyle}>Age</label>{sub(row, update, "AgeYear", "e.g. 35", "number")}</div>
              <div><label style={labelStyle}>Gender</label>{genderSelect(row, update, false)}</div>
            </Grid>
          )}
        />
      </Section>

      {/* ── G. Brief facts ─────────────────────────────────────────────── */}
      <Section
        icon={<FileText style={{ width: 17, height: 17, color: NAVY_MID }} />}
        title="Brief Facts of the Case"
        right={
          <span style={{ fontSize: 11, color: caseData.BriefFacts.length > 9500 ? "#ef4444" : MUTED, fontFamily: MONO }}>
            {caseData.BriefFacts.length.toLocaleString()} / 10,000
          </span>
        }
      >
        <textarea
          value={caseData.BriefFacts}
          maxLength={10000}
          onChange={(e) => set("BriefFacts", e.target.value)}
          placeholder="Summarise the sequence of events, the manner in which the offence was committed, property involved, and any immediate action taken…"
          style={{ ...inputStyle, minHeight: 150, resize: "vertical", lineHeight: 1.6 }}
        />
      </Section>

      {/* ── Errors ────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid #fca5a5", borderRadius: 6,
          padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: "#991b1b", lineHeight: 1.55 }}>{error}</div>
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────── */}
      {result && (
        <div style={{
          background: "rgba(16,185,129,0.06)", border: "1px solid #6ee7b7", borderRadius: 8, padding: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <CheckCircle2 style={{ width: 22, height: 22, color: "#10b981" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                Case registered in the Catalyst ledger
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                Registered by {result.registeredBy}
              </div>
            </div>
          </div>
          <Grid cols="repeat(auto-fit, minmax(180px, 1fr))">
            {[
              ["Crime Number", result.crimeNo],
              ["Case Number", result.caseNo],
              ["Case Master ID", result.caseMasterId],
              ["Station Serial", result.serial],
            ].map(([k, v]) => (
              <div key={String(k)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, letterSpacing: "0.08em" }}>
                  {String(k).toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: MONO, marginTop: 3 }}>{String(v)}</div>
              </div>
            ))}
          </Grid>
          {/* The printable FIR. globals.css prints .report-frame alone. */}
          {firDocument() && (
            <div style={{
              marginTop: 16, border: `1px solid ${BORDER}`, borderRadius: 6,
              overflow: "hidden", background: "#fff",
            }}>
              <FIRLetterhead data={firDocument() as FIRDocumentData} />
            </div>
          )}

          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={handlePrint} style={{
              display: "flex", alignItems: "center", gap: 7, background: NAVY, color: "#fff",
              border: "none", borderRadius: 4, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <Printer style={{ width: 15, height: 15, color: SAFFRON }} /> Print / Save FIR
            </button>
            <button onClick={handleReset} style={{
              display: "flex", alignItems: "center", gap: 7, background: "#fff", color: NAVY,
              border: `1px solid ${BORDER}`, borderRadius: 4, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              <RotateCcw style={{ width: 15, height: 15 }} /> Register Another
            </button>
          </div>
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      {!result && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", paddingBottom: 8 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: submitting ? "#94a3b8" : NAVY, color: "#fff", border: "none",
              borderRadius: 4, padding: "12px 26px", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? <Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} />
              : <FilePlus2 style={{ width: 17, height: 17, color: SAFFRON }} />}
            {submitting ? "Registering…" : "Register Case"}
          </button>
          <button onClick={handleReset} style={{
            display: "flex", alignItems: "center", gap: 7, background: "#fff", color: MUTED,
            border: `1px solid ${BORDER}`, borderRadius: 4, padding: "12px 18px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <RotateCcw style={{ width: 14, height: 14 }} /> Clear Form
          </button>
        </div>
      )}
      </>)}
    </div>
  );
};
