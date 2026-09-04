"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessTab, getRoleConfig } from "@/lib/rbac";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ORCA_TOKENS } from "@/lib/theme";
import { Telemetry } from "@/components/dynamic/Telemetry";
import { Intercepts } from "@/components/dynamic/Intercepts";
import { MapGrid } from "@/components/dynamic/MapGrid";
import { Network } from "@/components/dynamic/Network";
import { DocumentVerification } from "@/components/dynamic/DocumentVerification";
import { EvidenceRegistration } from "@/components/dynamic/EvidenceRegistration";
import { CaseRegistration } from "@/components/dynamic/CaseRegistration";
import { AIChatbotModule } from "@/components/dynamic/AIChatbotModule";
import { MiniAIAssistant } from "@/components/dynamic/MiniAIAssistant";
import { meetsClearance } from "@/lib/clearance";
import { fetchTelemetry } from "@/lib/officerTelemetryClient";
import { useActiveSession, formatElapsed } from "@/lib/useActiveSession";
import { useOfficerPhoto } from "@/lib/useOfficerPhoto";
import { CommandAdminCenter } from "@/components/dynamic/CommandAdminCenter";
import { DistrictDossier } from "@/components/dynamic/DistrictDossier";
import { PropertyRegister } from "@/components/dynamic/PropertyRegister";
import { TaskAssignment } from "@/components/dynamic/TaskAssignment";
import { TaskSummaryCard } from "@/components/dynamic/TaskSummaryCard";
import { LiveNewsFeeds } from "@/components/dynamic/LiveNewsFeeds";
import { CrimeAnalytics } from "@/components/dynamic/CrimeAnalytics";
import { CaseTimeline } from "@/components/dynamic/CaseTimeline";
import { CourtDeadlines } from "@/components/dynamic/CourtDeadlines";
import { RepeatOffenders } from "@/components/dynamic/RepeatOffenders";
import { AccusedProfile } from "@/components/dynamic/AccusedProfile";
import { StationPerformance } from "@/components/dynamic/StationPerformance";
import { MissingPersons } from "@/components/dynamic/MissingPersons";
import { GeneralDiary } from "@/components/dynamic/GeneralDiary";
import { ArrestRegister } from "@/components/dynamic/ArrestRegister";
import { BailRemandTracker } from "@/components/dynamic/BailRemandTracker";
import { WatchListModule } from "@/components/dynamic/WatchList";
import { WantedPersons } from "@/components/dynamic/WantedPersons";
import { PredictiveAnalytics } from "@/components/dynamic/PredictiveAnalytics";
import { 
  Plus, 
  ChevronRight, 
  AlertTriangle, 
  FileCheck, 
  ShieldAlert, 
  Clock, 
  UserCheck,
  Settings,
  Play,
  RotateCcw,
  CheckCircle,
  Loader2,
  Fingerprint,
  Network as NetworkIcon,
  Map as MapIcon
} from "lucide-react";

// ============================================================
// O.R.C.A Design System Tokens (inline, matching dashboard.html)
// ============================================================
// The palette now lives in src/lib/theme.ts, shared with the admin console —
// which used to carry an identical copy under different names.
const ORCA = ORCA_TOKENS;

// ============================================================
// O.R.C.A Panel Component (matches .panel, .panel-header, .panel-body)
// ============================================================
const Panel: React.FC<{
  header?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  noPadding?: boolean;
}> = ({ header, headerRight, children, style, bodyStyle, noPadding }) => (
  <div className="orca-panel" style={{
    background: ORCA.white,
    border: `1px solid ${ORCA.border}`,
    borderRadius: 8,
    boxShadow: ORCA.shadow,
    overflow: "hidden",
    ...style
  }}>
    {header && (
      <div className="orca-panel-header" style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${ORCA.border}`,
        fontSize: 12,
        fontWeight: 700,
        color: ORCA.navy,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(0,0,0,0.01)",
        fontFamily: "JetBrains Mono, monospace"
      }}>
        <span>{header}</span>
        {headerRight && <span>{headerRight}</span>}
      </div>
    )}
    <div className="orca-panel-body" style={{ padding: noPadding ? 0 : 16, ...bodyStyle }}>
      {children}
    </div>
  </div>
);

// ============================================================
// O.R.C.A Page Header Component (matches .page-header)
// Now lives in components/layout/PageHeader so the sections that render their
// own shell can use the same heading instead of inventing one.
// ============================================================

// ============================================================
// O.R.C.A Button Styles
// ============================================================
const BtnNavy: React.FC<{ onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties; disabled?: boolean }> = ({ onClick, children, style, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "6px 14px",
      background: ORCA.navy,
      color: "white",
      border: "none",
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: "'Inter', sans-serif",
      ...style
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = ORCA.navyMid; }}
    onMouseLeave={e => (e.currentTarget.style.background = ORCA.navy)}
  >
    {children}
  </button>
);

const BtnOutline: React.FC<{ onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }> = ({ onClick, children, style }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 12px",
      border: `1px solid ${ORCA.border}`,
      background: ORCA.white,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: ORCA.textGray,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      ...style
    }}
  >
    {children}
  </button>
);

const BtnOrange: React.FC<{ onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }> = ({ onClick, children, style }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 12px",
      border: "none",
      background: ORCA.orange,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: "white",
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      alignItems: "center",
      gap: 6,
      ...style
    }}
  >
    {children}
  </button>
);

;

// ============================================================
// Main Content — all 8 tabs with O.R.C.A visual system
// ============================================================
const MainContent: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab,
    activeFirId, 
    setActiveFirId,
    selectedDistrictCode,
    firCases,
    activeCase,
    activeCaseLoading,
    aiReportLoading,
    activeReport,
    runAiQuery,
    ingestNewCase,
    demoStep,
    advanceDemo,
    resetDemo,
    isLoggedIn,
    setIsLoggedIn,
    telemetryLogs,
    officerLogs,
    uploadingState,
    uploadLogs
  } = useIntelligence();

  const [customQueryText, setCustomQueryText] = useState("");
  // Heatmap opens first: it reads real district counts and is legible with no
  // data selected, whereas the relation graph needs an accused record chosen
  // before it shows anything.
  const [networkSubTab, setNetworkSubTab] = useState<"heatmap" | "visualizer">("heatmap");
  // Relation graph — real-data, from src/lib/networkGraph.ts via /api/network/*.
  const [graphMode, setGraphMode] = useState<"case" | "notes">("case");
  const [graphHops, setGraphHops] = useState<1 | 2>(1);
  const [caseQuery, setCaseQuery] = useState("");
  const [notesText, setNotesText] = useState("");
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);
  const [graphMeta, setGraphMeta] = useState<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [graphNode, setGraphNode] = useState<any>(null);
  const graphSeq = useRef(0);
  const [profileTab, setProfileTab] = useState<"ingress" | "downloads" | "ai_queries" | "devices">("ingress");

  // Officer Audit Profile data, all from Catalyst. Before this, the profile card
  // fell back to invented values ("Superintendent of Police", "+91 94808-01001",
  // "admin@orca.gov") and the Downloads / AI Audits tabs rendered hardcoded rows.
  const [catalystProfile, setCatalystProfile] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<{
    configured: boolean;
    sessions: any[];
    downloads: any[];
    aiQueries: any[];
  }>({ configured: false, sessions: [], downloads: [], aiQueries: [] });
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  const { officerProfile, dashboardRole } = useAuth();
  const activeSession = useActiveSession();
  const officerPhoto = useOfficerPhoto();

  useEffect(() => {
    if (activeTab !== "settings") return;
    let cancelled = false;
    setTelemetryLoading(true);
    (async () => {
      try {
        const [profileRes, telemetryRes] = await Promise.all([
          fetch("/api/officer/profile").then((r) => r.json()),
          // Shared with useActiveSession, which reads the same endpoint.
          fetchTelemetry(),
        ]);
        if (cancelled) return;
        setCatalystProfile(profileRes?.profile || null);
        setTelemetry(telemetryRes);
      } catch {
        // Leave the empty state in place rather than showing anything invented.
      } finally {
        if (!cancelled) setTelemetryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  /**
   * Catalyst is the ONLY source for the profile card.
   *
   * There used to be a Firestore fallback here, from before the officers were
   * migrated. It had to go: with it in place the card silently mixed sources,
   * so a value that failed to map to a reference row (e.g. station
   * "Central Command", which matched no Unit) still displayed - and looked
   * exactly like a properly linked record. Every such value is now either
   * mapped to a real reference row or genuinely absent.
   *
   * An unset field reads "Not on record" rather than a plausible placeholder,
   * which in a police console is indistinguishable from real data.
   *
   * If an officer has no OfficerAccount row at all the whole card reads
   * "Not on record" - correct, and a visible signal that the account was never
   * provisioned, rather than Firestore quietly covering for it.
   */
  const profileField = (catalystKey: string, _legacyKey?: string): string => {
    const value = catalystProfile?.[catalystKey];
    if (value) return String(value);
    // Before the fetch resolves every field would otherwise flash
    // "Not on record", which reads as data loss rather than loading.
    return telemetryLoading && !catalystProfile ? "…" : "Not on record";
  };

  /**
   * Console role, presented for a human. `getRoleConfig` already carries a label
   * for every role in RBAC_CONFIG; the screen was printing the enum slug instead.
   * The scope line is counted from the same config, so it cannot drift from what
   * the role actually grants.
   */
  const roleSlug = profileField("dashboardRole", "role");
  const profileRoleConfig = getRoleConfig(roleSlug);
  const roleLabel = profileRoleConfig?.label || (roleSlug === "Not on record" ? roleSlug : "Unrecognised role");
  const roleScope = profileRoleConfig
    ? `${profileRoleConfig.allowedTabs.length} console section${profileRoleConfig.allowedTabs.length === 1 ? "" : "s"}` +
      (profileRoleConfig.allowedAdminSubSections.length ? " · admin controls" : "")
    : "";

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || !Number.isFinite(seconds)) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  };

  const formatCatalystUtcAsIst = (value: string): string => {
    if (!value) return "—";
    const ms = new Date(`${String(value).replace(" ", "T")}Z`).getTime();
    if (!Number.isFinite(ms)) return value;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms));
    const part = (type: string) => parts.find((p) => p.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
  };

  // The audit_logs snapshot listener that used to live here fed the old Login
  // History tab. That tab now reads the officer's own sessions from Catalyst
  // (OfficerSession), and the listener additionally pulled EVERY officer's
  // audit rows into one console — so it is gone rather than left running.


  // --- Official Bulletins States ---
  /**
   * No seeded bulletins.
   *
   * Three invented circulars used to be written into localStorage on first
   * load and rendered as official advisories: an "MHA Directive" naming twelve
   * flagged cryptocurrency wallets, an "SCRB Circular" on intercept audits, and
   * a border-coordination brief — each attributed to a real office ("Office of
   * the Superintendent of Police, SCRB", "DG & IGP Office") with a named PDF
   * attachment that did not exist.
   *
   * The panel carried a "SAMPLE DATA" chip, which is not enough: the chip sat
   * in the corner while the content read as genuine departmental instruction.
   * Bulletins an officer publishes are still kept; nothing is seeded.
   */
  const INITIAL_BULLETINS: any[] = [];

  /**
   * The three seeded bulletins are purged from localStorage, not just
   * un-seeded.
   *
   * Emptying INITIAL_BULLETINS only stops NEW browsers being seeded. Anyone who
   * has already opened this console has the invented circulars saved under
   * `orca_official_bulletins`, and they would keep rendering as official
   * advisories indefinitely.
   *
   * They are identifiable with certainty: the seed used the fixed ids
   * BLT-2026-901, BLT-2026-884 and BLT-2026-850, while a bulletin an officer
   * publishes is keyed `BLT-${Date.now()}`. Only those three are dropped.
   */
  /**
   * Bulletins come from Catalyst, shared across the force.
   *
   * They were held in `localStorage`, which made "Publish Bulletin" a private
   * note: the officer who published saw it and nobody else ever did — on a
   * screen whose whole purpose is telling other officers something. The list
   * was also seeded with three invented circulars attributed to real offices.
   *
   * The stale localStorage key is cleared on load so the old seeded entries
   * cannot reappear in a browser that still holds them.
   */
  const [bulletins, setBulletins] = useState<any[]>([]);
  const [bulletinsLoaded, setBulletinsLoaded] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [publishError, setPublishError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("orca_official_bulletins");
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bulletins", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data?.success) setBulletins(data.bulletins || []);
      } catch {
        /* empty list is the honest answer */
      } finally {
        if (!cancelled) setBulletinsLoaded(true);
      }

      try {
        const res = await fetch("/api/reports", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data?.success) setReports(data.reports || []);
      } catch {
        /* empty list is the honest answer */
      } finally {
        if (!cancelled) setReportsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [bulletinSearch, setBulletinSearch] = useState("");
  const [bulletinFilter, setBulletinFilter] = useState("ALL");
  const [isCreateBulletinOpen, setIsCreateBulletinOpen] = useState(false);
  const [newBTitle, setNewBTitle] = useState("");
  const [newBCategory, setNewBCategory] = useState("INTELLIGENCE ADV");
  const [newBSummary, setNewBSummary] = useState("");
  const [newBBody, setNewBBody] = useState("");
  const [newBAttachment, setNewBAttachment] = useState("");
  const [publishing, setPublishing] = useState(false);

  /**
   * Publishing writes to Catalyst and only then updates the list.
   *
   * It used to push straight into local state with an id built from
   * `Math.random()`, a date of "Just now", and a default attachment name of
   * "ISD_Security_Notice.pdf" for a file that did not exist — so a bulletin
   * always LOOKED published whether or not anything had been stored.
   */
  const handlePublishBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBTitle || !newBSummary || publishing) return;
    setPublishing(true);
    setPublishError("");

    try {
      const res = await fetch("/api/bulletins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newBTitle,
          category: newBCategory,
          summary: newBSummary,
          body: newBBody,
          // No invented default filename — blank means no attachment.
          attachment: newBAttachment,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Publish failed (${res.status})`);
      }
      setBulletins((prev) => [data.bulletin, ...prev]);
      setIsCreateBulletinOpen(false);
      setNewBTitle("");
      setNewBSummary("");
      setNewBBody("");
      setNewBAttachment("");
    } catch (err: any) {
      setPublishError(err?.message || "Could not publish the bulletin.");
    } finally {
      setPublishing(false);
    }
  };

  const [expandedBulletinId, setExpandedBulletinId] = useState<string | null>(null);

  const hasAccess = (tabId: string) => {
    if (!officerProfile) return false;
    return true;
  };

  useEffect(() => {
    if (officerProfile && !hasAccess(activeTab)) {
      const allPossibleTabs = [
        "dashboard",
        "analytics",
        "heatmap",
        "networks",
        "chatbot",
        "verification-document",
        "reports",
        "settings",
        "admin-dashboard"
      ];
      const fallbackTab = allPossibleTabs.find(t => hasAccess(t));
      if (fallbackTab) {
        setActiveTab(fallbackTab);
      }
    }
  }, [activeTab, officerProfile]);

  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const query = (e as CustomEvent).detail;
      if (query) {
        setActiveTab("chatbot");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("orca_chatbot_search", { detail: query }));
        }, 50);
      }
    };
    window.addEventListener("orca_search", handleGlobalSearch);
    return () => window.removeEventListener("orca_search", handleGlobalSearch);
  }, [setActiveTab]);

  /*
   * `activeCase` now comes from the context, which fetches the full record.
   * It used to be `firCases.find(c => c.id === activeFirId) || firCases[0]`,
   * over a list of RAW Catalyst rows that carried none of the fields read
   * below — so the fallback handed back a row whose `.district` was undefined
   * and the tab threw on `.toUpperCase()`. Empty tables were all that hid it.
   */
  const buildCaseGraph = async () => {
    const q = caseQuery.trim();
    if (!q) return;
    const seq = ++graphSeq.current;
    setGraphLoading(true); setGraphError(""); setGraphNode(null);
    try {
      const res = await fetch(`/api/network/case?q=${encodeURIComponent(q)}&hops=${graphHops}`, { credentials: "include" });
      const data = await res.json();
      if (seq !== graphSeq.current) return;
      if (!data?.success) { setGraphError(data?.error || "Could not build the graph."); setGraphData(null); setGraphMeta(null); }
      else { setGraphData(data.graph); setGraphMeta(data.graph.meta); }
    } catch (e: any) {
      if (seq === graphSeq.current) { setGraphError(e?.message || "Could not reach the records store."); setGraphData(null); }
    } finally {
      if (seq === graphSeq.current) setGraphLoading(false);
    }
  };

  const buildNotesGraph = async () => {
    const text = notesText.trim();
    if (!text) return;
    const seq = ++graphSeq.current;
    setGraphLoading(true); setGraphError(""); setGraphNode(null);
    try {
      const res = await fetch("/api/network/notes", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (seq !== graphSeq.current) return;
      if (!data?.success) { setGraphError(data?.error || "Could not read the notes."); setGraphData(null); setGraphMeta(null); }
      else if (!data.graph.nodes.length) { setGraphError("No people or links were found in those notes."); setGraphData(null); }
      else { setGraphData(data.graph); setGraphMeta(data.graph.meta); }
    } catch (e: any) {
      if (seq === graphSeq.current) { setGraphError(e?.message || "Could not reach the AI service."); setGraphData(null); }
    } finally {
      if (seq === graphSeq.current) setGraphLoading(false);
    }
  };


  const demoStepDescriptions = [
    "",
    "1 / 8: Officer Ingress Portal Biometric Authentication",
    "2 / 8: Command Overview & Live Ticker Telemetries",
    "3 / 8: Ingesting scanned FIR Evidence into Secure Ingress Vault",
    "4 / 8: Real-time OCR Text Scan & Legal Mappings Complete",
    "5 / 8: Case Incident Forensic Timeline Reconstruction",
    "6 / 8: Suspect Association Relational Target Network Graph",
    "7 / 8: District Geospatial heatmaps & surveillance geofencing alerts",
    "8 / 8: Sealed Cryptographic Court Exhibits PDF Print Export"
  ];

  const isFullView = activeTab === "chatbot" || activeTab === "news";

  // O.R.C.A .content-area styles
  const contentAreaStyle: React.CSSProperties = isFullView ? {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "100%"
  } : {
    flex: 1,
    padding: "24px 32px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column"
  };

  // 3. Check for valid dashboardRole — use getRoleConfig as the single source of truth
  if (!dashboardRole || !getRoleConfig(dashboardRole)) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: ORCA.offWhite }}>
        <div style={{ maxWidth: 460, background: "white", border: `1px solid ${ORCA.border}`, padding: 36, borderRadius: 8, textAlign: "center", boxShadow: ORCA.shadowMd }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", color: ORCA.red, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
            <AlertTriangle style={{ width: 24, height: 24 }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: ORCA.navy, marginBottom: 8 }}>Clearance Verification Pending</h2>
          <p style={{ fontSize: 13, color: ORCA.textGray, lineHeight: 1.6, marginBottom: 20 }}>
            Your account credentials do not have a verified Dashboard Role claim attached to your cryptographic token. Access to O.R.C.A operational modules requires explicit role authorization from state command.
          </p>
          <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 6, border: `1px solid ${ORCA.border}`, fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: ORCA.textMuted }}>
            CLAIM STATUS: UNRECOGNIZED / PENDING ASSIGNMENT
          </div>
        </div>
      </div>
    );
  }

  const roleConfig = getRoleConfig(dashboardRole);
  if (roleConfig && !canAccessTab(dashboardRole, activeTab)) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: ORCA.offWhite }}>
        <div style={{ maxWidth: 480, background: "white", border: `1px solid ${ORCA.red}`, padding: 36, borderRadius: 8, textAlign: "center", boxShadow: ORCA.shadowMd }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", color: ORCA.red, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
            <AlertTriangle style={{ width: 24, height: 24 }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: ORCA.navy, marginBottom: 8 }}>Access Denied: Restricted Route</h2>
          <p style={{ fontSize: 13, color: ORCA.textGray, lineHeight: 1.6, marginBottom: 20 }}>
            Your role ({roleConfig.label || dashboardRole}) does not grant clearance to view the requested command module ({activeTab}). All access attempts are logged under ISD telemetry audits.
          </p>
          <button
            onClick={() => setActiveTab(roleConfig.defaultTab || "dashboard")}
            style={{ padding: "10px 20px", background: ORCA.gold, color: "white", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer", textTransform: "uppercase" }}
          >
            Return to Authorized Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, background: ORCA.offWhite }}>
      {isLoggedIn && <Sidebar />}

      <main style={{ flex: 1, overflowY: isFullView ? "hidden" : "auto", display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <style>{`
          @keyframes breathing-banner {
            0% {
              background: #fef08a; /* yellow-200 */
              border-bottom: 1.5px solid #fde047; /* yellow-300 */
              box-shadow: 0 1px 3px rgba(253, 224, 71, 0.1);
            }
            50% {
              background: #fef9c3; /* yellow-100 */
              border-bottom: 1.5px solid #fef08a; /* yellow-200 */
              box-shadow: 0 4px 12px rgba(254, 240, 138, 0.4);
            }
            100% {
              background: #fef08a;
              border-bottom: 1.5px solid #fde047;
              box-shadow: 0 1px 3px rgba(253, 224, 71, 0.1);
            }
          }
          .breathing-alert-banner {
            animation: breathing-banner 3.5s ease-in-out infinite;
          }
        `}</style>

        {/* Content */}
        <div style={contentAreaStyle}>

            {/* ============================================================ */}
            {/* 1. COMMAND OVERVIEW                                           */}
            {/* ============================================================ */}
            {activeTab === "dashboard" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Internal Security Division Command Center"
                  subtitle={<>State Intelligence Directorate <span style={{ background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4, fontWeight: 600, fontSize: 11, marginLeft: 8 }}>INTERNAL SECURITY FORCE DISPATCH</span></>}
                />

                 {/*
                   The officer's own workload, before the statewide figures.
                   Compact by design — Command Overview is a briefing, not the
                   Task module, and every number here is fetched from the same
                   authorized endpoint the module uses.
                 */}
                 <div style={{ marginBottom: 20 }}>
                   <TaskSummaryCard />
                 </div>

                 {/* Statewide Telemetry */}
                 {/* Level II and above. Compared through meetsClearance, not a list of
                     spellings: the old check listed ISD-LEVEL-4 alongside the roman
                     forms to cope with inconsistent data, which let the LOWEST
                     clearance through. See src/lib/clearance.ts. */}
                 {meetsClearance(officerProfile?.clearanceLevel || officerProfile?.isdLevel, "ISD-LEVEL-II") ? (
                   <Telemetry />
                 ) : (
                   <div style={{
                     background: "rgba(255, 153, 51, 0.04)",
                     border: "1px dashed rgba(255, 153, 51, 0.25)",
                     borderRadius: 8,
                     padding: "16px 24px",
                     marginBottom: 24,
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "space-between",
                     color: ORCA.navy
                   }}>
                     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                       <span style={{ fontSize: 18 }}>🔒</span>
                       <div>
                         <strong style={{ display: "block", fontSize: 13, color: ORCA.navy }}>Operational Intelligence Telemetry Locked</strong>
                         <span style={{ fontSize: 11, color: ORCA.textMuted }}>Statewide telemetry metrics are restricted to ISD Level II (IPS Officers) and above. Your clearance: {officerProfile?.clearanceLevel || "None"}.</span>
                       </div>
                     </div>
                   </div>
                 )}

                {/* 3-column feeds grid — matches .feeds-grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

                  {/* Live intercept log */}
                  <Panel
                    header="Live State Threat Intercept Log"
                    // "REALTIME SYNC" contradicted the panel below it, which now
                    // states there is no feed connected. The badge only appears
                    // when something is actually arriving.
                    headerRight={
                      telemetryLogs.length > 0
                        ? <span style={{ color: ORCA.orange, fontSize: 11 }}>REALTIME SYNC</span>
                        : <span style={{ color: ORCA.textMuted, fontSize: 11 }}>NO FEED</span>
                    }
                    bodyStyle={{ padding: 0, maxHeight: 320, overflowY: "auto" }}
                  >
                    <div style={{ padding: 16 }}>
                      {/*
                        Empty until a real feed exists. This panel used to fill
                        with invented pings every six seconds — tower anomalies,
                        threat-index moves, border watch activations — none of
                        which came from anywhere.
                      */}
                      {telemetryLogs.length === 0 ? (
                        <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: ORCA.textMuted }}>
                          No intercept telemetry. This console has no live state feed connected.
                        </div>
                      ) : (
                        <Intercepts />
                      )}
                    </div>
                  </Panel>

                  {/*
                    Crime Bulletins — empty state.

                    Two notices were hard-coded into this panel and shown to
                    every officer as live intelligence: an "Interpol Notice #442"
                    about antiquities smuggling on the Karnataka coast, marked
                    SECURE, and a "Cert-In Advisory VULN-902" mandating
                    immediate validation of municipal terminal links. Both were
                    invented, neither could ever change, and the second gave an
                    instruction an officer might actually carry out.

                    Bulletins officers publish are listed under Official
                    Bulletins; nothing is seeded here.
                  */}
                  <Panel header="Crime Bulletins & Notices" bodyStyle={{ maxHeight: 320, overflowY: "auto" }}>
                    {bulletins.length === 0 ? (
                      <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 12, color: ORCA.textMuted }}>
                        No bulletins or notices published.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {bulletins.slice(0, 6).map((b: any) => (
                          <div key={b.id} style={{ borderLeft: `3px solid ${ORCA.orange}`, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${ORCA.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase", marginBottom: 4 }}>
                              <span>{b.category}</span>
                              <span style={{ color: ORCA.textMuted }}>{b.date}</span>
                            </div>
                            <p style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.6 }}>{b.summary}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  {/* Officer Activity Stream */}
                  <Panel header="Officer Activity Stream" bodyStyle={{ maxHeight: 320, overflowY: "auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {officerLogs.map((item, idx) => (
                        <div key={idx} style={{ borderBottom: `1px solid ${ORCA.border}`, paddingBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: ORCA.textMuted, marginBottom: 4 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock style={{ width: 10, height: 10 }} /> {item.time}</span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: ORCA.textDark }}>{item.message}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. CRIME ANALYTICS                                            */}
            {/* ============================================================ */}
            {activeTab === "analytics" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Crime Analytics Directorate"
                  subtitle="District statistics counted from registered cases"
                />

                {/* Mounted bare, like CaseRegistration, and NOT inside <Panel>:
                    Panel sets overflow:hidden for its rounded corners, which
                    clips the filter dropdowns half way down. CrimeAnalytics
                    carries the panel styling itself. */}
                <CrimeAnalytics />
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. CRIMINAL NETWORKS (Combined Tab)                          */}
            {/* ============================================================ */}
            {activeTab === "networks" && (
              <div style={{ animation: "fadeIn 0.3s ease", flex: 1, display: "flex", flexDirection: "column" }}>
                <PageHeader
                  title={networkSubTab === "visualizer" ? "Relation Graph" : "State Incident Density Heatmap"}
                  subtitle={networkSubTab === "visualizer" ? "People and cases connected through registered records — enter a case to map its network, or extract a graph from notes" : "Geospatial distribution models mapping threat frequencies across Karnataka sectors"}
                  action={
                    /* Segmented Sub-Tab Switcher */
                    <div style={{
                      display: "inline-flex",
                      background: "rgba(0,31,63,0.04)",
                      padding: 4,
                      borderRadius: 8,
                      border: `1px solid ${ORCA.border}`
                    }}>
                      <button
                        onClick={() => setNetworkSubTab("heatmap")}
                        style={{
                          padding: "6px 14px",
                          background: networkSubTab === "heatmap" ? ORCA.navy : "transparent",
                          color: networkSubTab === "heatmap" ? "white" : ORCA.textGray,
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s"
                        }}
                      >
                        <MapIcon style={{ width: 14, height: 14 }} />
                        Threat Heatmap
                      </button>
                      <button
                        onClick={() => setNetworkSubTab("visualizer")}
                        style={{
                          padding: "6px 14px",
                          background: networkSubTab === "visualizer" ? ORCA.navy : "transparent",
                          color: networkSubTab === "visualizer" ? "white" : ORCA.textGray,
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s"
                        }}
                      >
                        <NetworkIcon style={{ width: 14, height: 14 }} />
                        Relation Graph
                      </button>
                    </div>
                  }
                />

                {networkSubTab === "visualizer" ? (
                  /* Relation Graph — real records, one hop */
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 480 }}>
                    {/* Input toolbar */}
                    <div style={{ background: ORCA.white, border: `1px solid ${ORCA.border}`, borderRadius: 8, boxShadow: ORCA.shadow, padding: 16 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                        {([["case", "By Case Number"], ["notes", "From Notes"]] as const).map(([m, label]) => (
                          <button key={m} onClick={() => setGraphMode(m)}
                            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: `1px solid ${graphMode === m ? ORCA.navy : ORCA.border}`,
                              background: graphMode === m ? ORCA.navy : "transparent",
                              color: graphMode === m ? "white" : ORCA.textGray }}>
                            {label}
                          </button>
                        ))}
                        {/* Hop depth toggle — only meaningful in case mode */}
                        {graphMode === "case" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                            <span style={{ fontSize: 11, color: ORCA.textGray, fontWeight: 600 }}>Depth:</span>
                            {([1, 2] as const).map((h) => (
                              <button key={h}
                                onClick={() => setGraphHops(h)}
                                title={h === 1 ? "Direct connections only" : "Extend to cases reachable through hop-1 accused (organised crime analysis)"}
                                style={{
                                  padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                  border: `1px solid ${graphHops === h ? ORCA.navy : ORCA.border}`,
                                  background: graphHops === h ? ORCA.navy : "transparent",
                                  color: graphHops === h ? "white" : ORCA.textGray,
                                }}>
                                {h}-hop
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {graphMode === "case" ? (
                        <div style={{ display: "flex", gap: 10 }}>
                          <input
                            value={caseQuery}
                            onChange={(e) => setCaseQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") buildCaseGraph(); }}
                            placeholder="Enter a Crime Number, Case Number, or Case ID…"
                            style={{ flex: 1, border: `1px solid ${ORCA.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", outline: "none" }}
                          />
                          <BtnNavy onClick={buildCaseGraph} disabled={graphLoading || !caseQuery.trim()}>
                            {graphLoading ? "Building…" : "Build Graph"}
                          </BtnNavy>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <textarea
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            placeholder="Paste investigation notes. The AI extracts only the people, vehicles and links you have written; the records then confirm which are real."
                            style={{ width: "100%", minHeight: 90, border: `1px solid ${ORCA.border}`, borderRadius: 6, padding: "10px 12px", fontSize: 13, fontFamily: "'Inter', sans-serif", outline: "none", resize: "vertical" }}
                          />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
                              Extraction only — nothing is invented. Solid = matched a record, hollow = notes only.
                            </span>
                            <BtnNavy onClick={buildNotesGraph} disabled={graphLoading || !notesText.trim()}>
                              {graphLoading ? "Analysing…" : "Generate Graph"}
                            </BtnNavy>
                          </div>
                        </div>
                      )}

                      {graphError && (
                        <div style={{ marginTop: 10, fontSize: 12, color: ORCA.redDark, fontWeight: 600 }}>{graphError}</div>
                      )}
                      {graphMeta && !graphError && (
                        <div style={{ marginTop: 10, fontSize: 11, color: ORCA.textGray, display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "JetBrains Mono, monospace" }}>
                          {graphMode === "case" ? (
                            <>
                              <span>ROOT: {graphMeta.rootCrimeNo}</span>
                              <span>ACCUSED: {graphMeta.counts?.accused ?? 0}</span>
                              <span>HOP-1 CASES: {graphMeta.otherCaseCount ?? 0}</span>
                              {(graphMeta.twoHopCaseCount ?? 0) > 0 && (
                                <span style={{ color: "#94a3b8" }}>HOP-2 CASES: {graphMeta.twoHopCaseCount}</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span>ENTITIES: {graphMeta.counts?.entities ?? 0}</span>
                              <span>CONFIRMED: {graphMeta.counts?.confirmed ?? 0}</span>
                              <span>UNVERIFIED: {graphMeta.counts?.unverified ?? 0}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Graph + dossier */}
                    <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 420 }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        {graphLoading ? (
                          <div style={{ flex: 1, background: "#080f1e", border: "1px solid #1e293b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94a3b8", fontSize: 13 }}>
                              <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                              {graphMode === "case" ? "Reading records…" : "Extracting entities…"}
                            </div>
                          </div>
                        ) : graphData ? (
                          <Network data={graphData} selectedId={graphNode?.id} onSelect={setGraphNode} />
                        ) : (
                          <div style={{ flex: 1, background: "#080f1e", border: "1px solid #1e293b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420, padding: 32 }}>
                            <div style={{ textAlign: "center", maxWidth: 380 }}>
                              <NetworkIcon style={{ width: 34, height: 34, color: "#334155", margin: "0 auto 12px" }} />
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>
                                {graphMode === "case" ? "Enter a case to map its network" : "Paste notes to map them"}
                              </div>
                              <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#64748b", margin: 0 }}>
                                {graphMode === "case"
                                  ? graphHops === 2
                                    ? "2-hop mode: the root case, its people and direct linked cases (hop 1), and then the cases those accused also appear on (hop 2 — faded nodes). Useful for organised-crime network analysis."
                                    : "The graph shows the case, the people named on it, and any other case those accused also appear on — all from registered records. Switch to 2-hop to extend the network further."
                                  : "The AI reads only what you wrote; the records confirm which people are real."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Selected-node record panel */}
                      <div style={{ width: 350, flexShrink: 0 }}>
                        <Panel header="Record Detail" style={{ height: "100%" }} bodyStyle={{ overflowY: "auto" }}>
                          {!graphNode ? (
                            <div style={{ padding: "28px 8px", textAlign: "center" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: ORCA.navy, marginBottom: 8 }}>No node selected</div>
                              <p style={{ fontSize: 12, lineHeight: 1.6, color: ORCA.textGray, margin: 0 }}>
                                Click any node on the graph to see the record behind it.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                                <div style={{ width: 46, height: 46, background: "rgba(0,0,0,0.05)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ORCA.navy, fontSize: 16, flexShrink: 0, textTransform: "uppercase" }}>
                                  {String(graphNode.label || "?").split(" ").filter(Boolean).map((n: string) => n[0]).join("").slice(0, 2) || "?"}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: ORCA.navy, wordBreak: "break-word" }}>{graphNode.label}</div>
                                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", padding: "2px 6px", borderRadius: 3, background: "rgba(0,31,63,0.08)", color: ORCA.navy }}>{graphNode.kind}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", padding: "2px 6px", borderRadius: 3,
                                      background: graphNode.verified ? "rgba(16,185,129,0.12)" : "rgba(180,83,9,0.12)",
                                      color: graphNode.verified ? "#047857" : "#b45309" }}>
                                      {graphNode.verified ? "VERIFIED RECORD" : "FROM NOTES"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {(graphNode.detail || []).map(({ label, value }: any, i: number) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                                  <span style={{ color: ORCA.textGray, flexShrink: 0 }}>{label}</span>
                                  <strong style={{ color: ORCA.textDark, fontFamily: "JetBrains Mono, monospace", textAlign: "right", wordBreak: "break-word" }}>{value}</strong>
                                </div>
                              ))}

                              {graphMeta && (
                                <div style={{ marginTop: 16, background: "rgba(0,31,63,0.04)", border: `1px solid ${ORCA.border}`, borderRadius: 4, padding: 12 }}>
                                  <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 6 }}>
                                    What this graph is
                                  </div>
                                  <p style={{ fontSize: 11.5, lineHeight: 1.6, color: ORCA.textGray, margin: 0 }}>{graphMeta.note}</p>
                                  <p style={{ fontSize: 11.5, lineHeight: 1.6, color: ORCA.textGray, margin: "6px 0 0 0" }}>{graphMeta.identityBasis}</p>
                                </div>
                              )}
                            </>
                          )}
                        </Panel>
                      </div>
                    </div>
                  </div>
                ) : (

                  /* Geospatial Heatmap Visualizer */
                  <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 480 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <MapGrid />
                    </div>

                    {/*
                      District dossier.

                      This showed `districtDatabase` from mock.ts: an invented
                      crime density rating, a 30-day FIR count, "Force Grid
                      Coverage", a count of ISD special squads and an "AI
                      Advisory Dispatch Directive" — all presented as
                      operational intelligence for a real Karnataka district.

                      It now carries the REAL counts for whichever district is
                      selected, read from the same hook the map uses so the
                      panel can never explain a colour the map is no longer
                      showing. Those counts were briefly in a card floating over
                      the map; it covered the shapes it described and had to be
                      tiny to stay out of the way.
                    */}
                    <div style={{ width: 350, flexShrink: 0 }}>
                      <Panel header="District Geospatial Dossier" style={{ height: "100%" }} bodyStyle={{ overflowY: "auto" }}>
                        <DistrictDossier />
                      </Panel>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B. STATE LIVE NEWS & MEDIA FEEDS                            */}
            {/* ============================================================ */}
            {activeTab === "news" && (
              <LiveNewsFeeds />
            )}

            {/* ============================================================ */}
            {/* 7B. CASE REGISTRATION (FIR / UDR / PAR / Zero FIR)            */}
            {/* ============================================================ */}
            {activeTab === "case-registration" && (
              <CaseRegistration />
            )}

            {/* ============================================================ */}
            {/* 7B2. CASE TIMELINE RECONSTRUCTOR                              */}
            {/* ============================================================ */}
            {activeTab === "case-timeline" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Case Timeline Reconstructor"
                  subtitle="Chronological event history for a registered case — registration, offence period, IPC sections, tasks, and documents"
                />
                <CaseTimeline />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B3. COURT DEADLINE TRACKER                                   */}
            {/* ============================================================ */}
            {activeTab === "court-deadlines" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Court Deadline Tracker"
                  subtitle="Charge-sheet filing deadlines under CrPC §167(2) — 60 days for heinous offences, 90 days for others"
                />
                <CourtDeadlines />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B3b. GENERAL DIARY                                           */}
            {/* ============================================================ */}
            {activeTab === "general-diary" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="General Diary"
                  subtitle="Station daily log — complaints, incidents, patrol notes, visitors, and information entries"
                />
                <GeneralDiary />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B4. ARREST REGISTER                                          */}
            {/* ============================================================ */}
            {activeTab === "arrest-register" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Arrest Register"
                  subtitle="Record arrests, custody status, and generate official arrest memoranda with signatures"
                />
                <ArrestRegister />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B5. BAIL & REMAND TRACKER                                    */}
            {/* ============================================================ */}
            {activeTab === "bail-remand" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Bail & Remand Tracker"
                  subtitle="Track court-ordered remands, judicial custody, bail conditions, and expiry alerts"
                />
                <BailRemandTracker />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B6. WATCH LIST                                               */}
            {/* ============================================================ */}
            {activeTab === "watch-list" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Surveillance Watch List"
                  subtitle="Persons under active surveillance — threat-level ranked, review-date tracked"
                />
                <WatchListModule />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B7. WANTED PERSONS                                           */}
            {/* ============================================================ */}
            {activeTab === "wanted-persons" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Wanted Persons & Absconders"
                  subtitle="Active warrants, absconders at large — threat level, reward, linked FIR"
                />
                <WantedPersons />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B8. PREDICTIVE ANALYTICS                                     */}
            {/* ============================================================ */}
            {activeTab === "predictive-analytics" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Predictive Analytics"
                  subtitle="AI-powered crime trend forecasting, risk indicators, and geographic hotspot analysis"
                />
                <PredictiveAnalytics />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B9. MISSING PERSONS REGISTER                                 */}
            {/* ============================================================ */}
            {activeTab === "missing-persons" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Missing Persons Register"
                  subtitle="Log and track missing person cases; link to an FIR where one has been registered"
                />
                <MissingPersons />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B5. REPEAT OFFENDERS FLAG                                    */}
            {/* ============================================================ */}
            {activeTab === "repeat-offenders" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Repeat Offenders Flag"
                  subtitle="Accused persons appearing on multiple registered cases, ranked by case count and gravity"
                />
                <RepeatOffenders />
              </div>
            )}

            {activeTab === "accused-profile" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Accused Profile"
                  subtitle="Unified profile: cases, arrests, bail orders and known associates"
                />
                <AccusedProfile />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7B6. STATION PERFORMANCE DASHBOARD                            */}
            {/* ============================================================ */}
            {activeTab === "station-performance" && (
              <div style={{ animation: "fadeIn 0.3s ease" }}>
                <PageHeader
                  title="Station Performance Dashboard"
                  subtitle="Closure rates, charge-sheet rates, and case aging per police station"
                />
                <StationPerformance />
              </div>
            )}

            {/* ============================================================ */}
            {/* 7C. EVIDENCE REGISTRATION (+ chain of custody)                */}
            {/* ============================================================ */}
            {/* Mounted bare, NOT inside <Panel>: Panel's overflow:hidden
                clips the searchable dropdowns. Same rule as CaseRegistration. */}
            {activeTab === "evidence" && (
              <EvidenceRegistration />
            )}

            {/* ============================================================ */}
            {/* 7D. LOST & STOLEN PROPERTY REGISTER                           */}
            {/* ============================================================ */}
            {/* Bare, not inside <Panel>: Panel's overflow:hidden clips the
                searchable dropdowns. Same rule as CaseRegistration. */}
            {activeTab === "property-register" && (
              <PropertyRegister />
            )}

            {/* ============================================================ */}
            {/* 7E. TASK & ASSIGNMENT                                         */}
            {/* ============================================================ */}
            {/* Bare, not inside <Panel>: Panel's overflow:hidden clips the
                searchable dropdowns. Same rule as CaseRegistration. */}
            {activeTab === "tasks" && (
              <TaskAssignment />
            )}

            {/* ============================================================ */}
            {/* 8. DOCUMENT VERIFICATION                                      */}
            {/* ============================================================ */}
            {activeTab === "verification-document" && (
              <DocumentVerification />
            )}

            {/* ============================================================ */}
            {/* 9B. AI CHATBOT                                               */}
            {/* ============================================================ */}
            {activeTab === "chatbot" && (
              <AIChatbotModule />
            )}

            {/* ============================================================ */}
            {/* 9C. OFFICIAL SECURITY BULLETINS                              */}
            {/* ============================================================ */}
            {activeTab === "reports" && (() => {
              /**
               * No fabricated reports.
               *
               * Five invented documents used to be listed here as downloadable
               * departmental intelligence — "KSP ISD Annual Counter-Terrorism
               * Intelligence Assessment" (SECRET, 2.4 MB), a darknet financial
               * mapping, a standing order on lawful interception, a border
               * logistics grid, and a convict escape advisory.
               *
               * Each opened a printable document built from `getReportData`,
               * complete with data tables. The escape advisory named three
               * individuals with case references, threat levels and last-known
               * locations, and recommended "Immediate APB" — a page an officer
               * could print on O.R.C.A letterhead and act on. None of them were
               * real people or real cases.
               *
               * There is no report repository behind this screen yet, so it
               * lists only what officers publish through Publish Bulletin.
               */
              /**
               * Real sealed documents from the verification ledger.
               *
               * `reports` is loaded from /api/reports, which reads the Catalyst
               * `VerifiedDocument` table — one row per document actually sealed,
               * carrying its crime number, SHA-256 and issuer.
               *
               * `size` and `type` are not stored, so they are not claimed: the
               * old list invented "2.4 MB / PDF" per row alongside invented
               * SECRET classifications.
               */
              const PUBLISHED_REPORTS = reports;

              // The ledger records a document's identity, not its contents, so
              // there is no table to print. A report opens its verification
              // record rather than a fabricated data sheet.
              const getReportData = (_title: string) => ({
                headers: [] as string[],
                rows: [] as string[][],
                desc: "",
              });

              const triggerDownload = (report: any) => {
                const reportData = getReportData(report.title);
                
                if (report.type === "PDF") {
                  const printWindow = window.open("", "_blank");
                  if (!printWindow) {
                    alert("Popup blocker prevented printing. Please allow popups for this site.");
                    return;
                  }
                  
                  const dateStr = report.date;
                  const authority = "Organized Crime Analysis Authority (O.R.C.A)";
                  const classification = `${report.classification} // COPS INTERNAL USE ONLY`;
                  
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>${report.title} - PDF Export</title>
                        <style>
                          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
                          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #001f3f; padding-bottom: 12px; margin-bottom: 16px; }
                          .logo { font-size: 20px; font-weight: 800; color: #001f3f; letter-spacing: 1px; }
                          .classification { background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid #fca5a5; padding: 4px 10px; font-size: 10px; font-weight: 700; border-radius: 4px; font-family: monospace; }
                          .title { font-size: 18px; font-weight: 700; color: #001f3f; margin-bottom: 10px; }
                          .metadata { margin-bottom: 16px; font-size: 11.5px; color: #64748b; background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.4; }
                          .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                          .table th { background: #001f3f; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
                          .table td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-size: 11px; }
                          .table tr:nth-child(even) { background: #f8fafc; }
                          .footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; }
                          .watermark {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            z-index: 0;
                            pointer-events: none;
                            text-align: center;
                          }
                          .watermark img {
                            width: 180px;
                            opacity: 0.08;
                            margin-bottom: 12px;
                          }
                          @media print {
                            @page { size: auto; margin: 12mm 15mm; }
                            body { padding: 0; background: #fff; }
                            .footer { position: fixed; bottom: 0; left: 0; right: 0; margin-top: 0; border-top: 1px solid #cbd5e1; padding-top: 8px; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="watermark">
                          <img src="/logo.png" alt="Emblem"/>
                          <div style="font-size: 3.5rem; font-weight: 900; color: rgba(0, 31, 63, 0.08); letter-spacing: 0.08em; line-height: 1;">O.R.C.A</div>
                          <div style="font-size: 1.8rem; margin-top: 6px; color: rgba(0, 31, 63, 0.08); font-weight: bold; letter-spacing: 0.12em; line-height: 1;">CONFIDENTIAL</div>
                        </div>
                        
                        <div style="position: relative; z-index: 1;">
                          <div class="header">
                            <div class="logo">O.R.C.A. SECURITY BRIEF</div>
                            <div class="classification">${classification}</div>
                          </div>
                          <div class="title">${report.title}</div>
                          <div class="metadata">
                            <strong>REPORT ID:</strong> ${report.id}<br/>
                            <strong>DATE GENERATED:</strong> ${dateStr} IST<br/>
                            <strong>ISSUING AUTHORITY:</strong> ${authority}<br/>
                            <strong>PUBLISHER:</strong> ${report.author}<br/>
                            <strong>VERIFICATION CHECKSUM:</strong> SHA-256 [${Math.random().toString(16).slice(2, 10).toUpperCase()}...${Math.random().toString(16).slice(2, 10).toUpperCase()}]
                          </div>
                          
                          <h3>Operational Log Analysis</h3>
                          <table class="table">
                            <thead>
                              <tr>
                                ${reportData.headers.map(h => `<th>${h}</th>`).join("")}
                              </tr>
                            </thead>
                            <tbody>
                              ${reportData.rows.map(row => `
                                <tr>
                                  ${row.map(val => `<td>${val}</td>`).join("")}
                                </tr>
                              `).join("")}
                            </tbody>
                          </table>

                          <p style="font-size: 12px; color: #475569; margin-top: 20px;">
                            ${reportData.desc} This document represents a certified cryptographic export of O.R.C.A. database metrics. All records are stored and audited on secured state servers. Any tampering with official police records is punishable under the Information Technology Act.
                          </p>

                          <div class="footer">
                            CONFIDENTIAL STATE GOVERNMENT PROPERTY • DISCLOSURE OR DISTRIBUTION PROHIBITED
                          </div>
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          }
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  return;
                }
                
                // For XLSX/other, download a CSV
                const fileContent = `O.R.C.A Admin Report\n` +
                  `Report ID,${report.id}\n` +
                  `Report Name,${report.title}\n` +
                  `File Format,${report.type}\n` +
                  `Export Date,${report.date}\n` +
                  `Authority,Organized Crime Analysis Authority (O.R.C.A)\n` +
                  `Classification,${report.classification} // COPS INTERNAL USE ONLY\n\n` +
                  `${reportData.headers.join(",")}\n` +
                  `${reportData.rows.map(row => row.join(",")).join("\n")}`;
                
                const blob = new Blob([fileContent], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${report.title.toLowerCase().replace(/\s+/g, "_")}_report.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };

              const filteredBulletins = bulletins.filter((b: any) => {
                const matchesSearch = b.title.toLowerCase().includes(bulletinSearch.toLowerCase()) ||
                                      b.summary.toLowerCase().includes(bulletinSearch.toLowerCase());
                const matchesFilter = bulletinFilter === "ALL" || b.category === bulletinFilter;
                return matchesSearch && matchesFilter;
              });

              const filteredReports = PUBLISHED_REPORTS.filter(r => {
                const matchesSearch = r.title.toLowerCase().includes(bulletinSearch.toLowerCase()) || 
                                      r.author.toLowerCase().includes(bulletinSearch.toLowerCase());
                let matchesFilter = true;
                // The ledger has verification statuses, not classifications —
                // the old SECRET/CONFIDENTIAL/RESTRICTED buckets described
                // invented rows. Only the revoked filter means anything here.
                if (bulletinFilter === "HIGH URGENCY") matchesFilter = r.classification === "REVOKED";
                else if (bulletinFilter !== "ALL") matchesFilter = false;
                return matchesSearch && matchesFilter;
              });

              const highlightText = (text: string, search: string) => {
                if (!search.trim()) return <span>{text}</span>;
                const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
                const parts = text.split(regex);
                return (
                  <span>
                    {parts.map((part, idx) => 
                      regex.test(part) ? (
                        <mark key={idx} style={{ background: "#fde047", color: "#000000", padding: "0 2px", borderRadius: 2 }}>{part}</mark>
                      ) : (
                        part
                      )
                    )}
                  </span>
                );
              };

              return (
                <div style={{ animation: "fadeIn 0.3s ease", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Top Alert Banner - styled like yellow Coming Soon banner */}
                  <div
                    className="breathing-alert-banner"
                    style={{
                      background: "#fef9c3",
                      color: "#713f12",
                      padding: "8px 16px",
                      textAlign: "center",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      fontFamily: "var(--font-sans), sans-serif",
                      letterSpacing: "0.04em",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      userSelect: "none",
                      flexShrink: 0,
                      borderRadius: "6px",
                      marginBottom: "16px",
                      border: "1px solid #fde047"
                    }}
                  >
                    <span>⚠️ SECURE BULLETIN & REPORTING CHANNEL: LOGS AND ATTACHMENTS ARE CRYPTOGRAPHICALLY SIGNED AND AUDITED UNDER POLICE DATA PROTECTION DIRECTIVES</span>
                  </div>

                  <PageHeader
                    title="Official Bulletins & Security Reports"
                    subtitle="Secure intelligence advisories, administrative bulletins, and official analytical dossiers published by SCRB and ISD."
                  />

                  {/* Top Horizontal Auditing & Search Filter Bar */}
                  <Panel style={{ marginBottom: 16, marginTop: 4 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase" }}>Audit & Search:</span>
                        <div style={{ position: "relative", width: 240 }}>
                          <input
                            type="text"
                            placeholder="Search reports or bulletins..."
                            value={bulletinSearch}
                            onChange={e => setBulletinSearch(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "6px 12px",
                              fontSize: 12,
                              border: `1px solid ${ORCA.border}`,
                              borderRadius: 6,
                              outline: "none",
                              color: ORCA.navy,
                              background: "#f8fafc"
                            }}
                          />
                        </div>
                        
                        {/* Horizontal Filter Buttons */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {[
                            { id: "ALL", label: "All Documents" },
                            { id: "HIGH URGENCY", label: "🔴 High Urgency / Secret" },
                            { id: "INTELLIGENCE ADV", label: "🟡 Intelligence / Confidential" },
                            { id: "ROUTINE BRIEF", label: "🔵 Routine / Restricted" }
                          ].map(cat => (
                            <button
                              key={cat.id}
                              onClick={() => setBulletinFilter(cat.id)}
                              style={{
                                padding: "6px 14px",
                                fontSize: 11.5,
                                borderRadius: 20,
                                border: bulletinFilter === cat.id ? `1px solid ${ORCA.navy}` : `1px solid ${ORCA.border}`,
                                background: bulletinFilter === cat.id ? ORCA.navy : "rgba(255,255,255,0.8)",
                                color: bulletinFilter === cat.id ? "white" : ORCA.textMuted,
                                fontWeight: bulletinFilter === cat.id ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => setIsCreateBulletinOpen(true)}
                        style={{
                          background: ORCA.navy,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: ORCA.shadow,
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = ORCA.navyMid}
                        onMouseLeave={e => e.currentTarget.style.background = ORCA.navy}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                        Publish Bulletin
                      </button>
                    </div>
                  </Panel>
                  
                  {/* Side-by-side Sections Container */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20, flex: 1 }}>
                    {/* Section Left: Official Reports & Bulletins (Directory) */}
                    <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: 16 }}>
                      <Panel style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Official Reports & Bulletins</h3>
                          <span style={{ fontSize: 10, color: ORCA.navy, fontWeight: 700, background: "rgba(0,31,63,0.06)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            SECURE REPOSITORY
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Authorized department circulars, operational reports, and case studies published by State Police Headquarters.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                          {filteredReports.map((report: any) => {
                            const isSecret = report.classification === "SECRET";
                            const isConfidential = report.classification === "CONFIDENTIAL";
                            const badgeColor = isSecret ? "#ef4444" : isConfidential ? "#f59e0b" : "#3b82f6";
                            const badgeBg = isSecret ? "rgba(239,68,68,0.08)" : isConfidential ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)";

                            return (
                              <div 
                                key={report.id}
                                style={{
                                  border: `1px solid ${ORCA.border}`,
                                  borderRadius: 6,
                                  padding: 12,
                                  background: "#f8fafc",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                  transition: "border 0.2s"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: badgeColor, background: badgeBg, padding: "2px 6px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>
                                    {report.classification}
                                  </span>
                                  <span style={{ fontSize: 11, color: ORCA.textMuted, fontFamily: "JetBrains Mono" }}>{report.id}</span>
                                </div>
                                <h4 style={{ fontSize: 13, fontWeight: 700, color: ORCA.navy, margin: 0 }}>
                                  {highlightText(report.title, bulletinSearch)}
                                </h4>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: ORCA.textMuted, marginTop: 4 }}>
                                  {/*
                                    Issuer and crime number — both recorded.
                                    `report.size` and `report.type` are gone:
                                    the ledger stores a document's identity, not
                                    its bytes, and the old list printed an
                                    invented "2.4 MB / PDF" against every row.
                                  */}
                                  <span>Issued by: <strong>{highlightText(report.author, bulletinSearch)}</strong></span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {report.crimeNo && <span>Crime No. {report.crimeNo}</span>}
                                    <button
                                      onClick={() => triggerDownload(report)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: ORCA.orange,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        padding: 0,
                                        fontSize: 11
                                      }}
                                    >
                                      [OPEN RECORD]
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {filteredReports.length === 0 && (
                            <div style={{ textAlign: "center", padding: "40px 20px", color: ORCA.textMuted, fontSize: 12.5 }}>
                              {!reportsLoaded
                                ? "Reading the verification ledger..."
                                : bulletinSearch || bulletinFilter !== "ALL"
                                  ? "No official reports match the search parameters."
                                  : "No documents have been sealed into the ledger yet."}
                            </div>
                          )}
                        </div>
                      </Panel>
                    </div>

                    {/* Section Right: Official Security Bulletins (Feed) */}
                    <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: 16 }}>
                      <Panel style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Official Security Bulletins</h3>
                          {/*
                            The "SAMPLE DATA" chip is gone with the seeded
                            bulletins it was labelling. Everything in this feed
                            is now published by an officer through this console.
                          */}
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Live operational alerts and advisory directives published under credential authority. Click items to inspect guidelines.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                          {filteredBulletins.map((bulletin: any) => {
                            const isExpanded = expandedBulletinId === bulletin.id;
                            const catColors = bulletin.category === "HIGH URGENCY" 
                              ? { text: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" }
                              : bulletin.category === "INTELLIGENCE ADV"
                              ? { text: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" }
                              : { text: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" };

                            return (
                              <div 
                                key={bulletin.id}
                                onClick={() => setExpandedBulletinId(isExpanded ? null : bulletin.id)}
                                style={{
                                  border: `1px solid ${ORCA.border}`,
                                  borderLeft: `4px solid ${catColors.text}`,
                                  borderRadius: 6,
                                  padding: 12,
                                  background: "#f8fafc",
                                  cursor: "pointer",
                                  transition: "transform 0.2s"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <span style={{ fontSize: 9.5, fontWeight: 800, color: catColors.text, background: catColors.bg, padding: "2px 6px", borderRadius: 4, fontFamily: "JetBrains Mono" }}>
                                    {bulletin.category}
                                  </span>
                                  <span style={{ fontSize: 11, color: ORCA.textMuted }}>{bulletin.date}</span>
                                </div>
                                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: "0 0 4px 0" }}>
                                  {highlightText(bulletin.title, bulletinSearch)}
                                </h4>
                                <p style={{ fontSize: 12, color: ORCA.textGray, margin: 0, lineHeight: 1.4 }}>
                                  {highlightText(bulletin.summary, bulletinSearch)}
                                </p>

                                {isExpanded && (
                                  <div 
                                    style={{
                                      marginTop: 10,
                                      paddingTop: 10,
                                      borderTop: `1px solid ${ORCA.border}`,
                                      fontSize: 12.5,
                                      color: ORCA.navy,
                                      lineHeight: 1.5,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 8
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <div style={{ background: "#ffffff", padding: 10, borderRadius: 4, border: `1px solid ${ORCA.border}`, fontStyle: "normal" }}>
                                      {highlightText(bulletin.body, bulletinSearch)}
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: ORCA.textMuted, marginTop: 4 }}>
                                      <span>By: <strong>{highlightText(bulletin.author, bulletinSearch)}</strong></span>
                                      {bulletin.attachment && (
                                        <button
                                          onClick={() => alert(`Downloading attachment: ${bulletin.attachment}`)}
                                          style={{ background: "none", border: "none", color: ORCA.orange, fontWeight: 700, cursor: "pointer", fontSize: 11 }}
                                        >
                                          [PDF DIRECTIVE]
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {filteredBulletins.length === 0 && (
                            <div style={{ textAlign: "center", padding: "40px 20px", color: ORCA.textMuted, fontSize: 12.5 }}>
                              {!bulletinsLoaded
                                ? "Reading bulletins..."
                                : bulletinSearch || bulletinFilter !== "ALL"
                                  ? "No security bulletins match the search parameters."
                                  : "No security bulletins have been published yet."}
                            </div>
                          )}
                        </div>
                      </Panel>
                    </div>
                  </div>

                  {/* Publish Bulletin Modal */}
                  {isCreateBulletinOpen && (
                    <div style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: "100vw",
                      height: "100vh",
                      background: "rgba(0,31,63,0.4)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 1000,
                      animation: "fadeIn 0.2s ease"
                    }}>
                      <form 
                        onSubmit={handlePublishBulletin}
                        style={{
                          background: "white",
                          border: `1px solid ${ORCA.border}`,
                          borderRadius: 8,
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                          width: "100%",
                          maxWidth: 500,
                          padding: 24,
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                          animation: "scaleUp 0.2s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${ORCA.border}`, paddingBottom: 12 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 800, color: ORCA.navy, margin: 0 }}>Publish Security Bulletin</h3>
                          <button 
                            type="button" 
                            onClick={() => setIsCreateBulletinOpen(false)}
                            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: ORCA.textMuted }}
                          >&times;</button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: ORCA.textMuted }}>Bulletin Title</label>
                          <input
                            type="text"
                            required
                            value={newBTitle}
                            onChange={e => setNewBTitle(e.target.value)}
                            placeholder="e.g. Interpol Red Notice: Gold Smuggling Syndicate"
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: `1px solid ${ORCA.border}`, borderRadius: 4, outline: "none" }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: ORCA.textMuted }}>Urgency Level</label>
                          <select
                            value={newBCategory}
                            onChange={e => setNewBCategory(e.target.value)}
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: `1px solid ${ORCA.border}`, borderRadius: 4, outline: "none" }}
                          >
                            <option value="HIGH URGENCY">🔴 High Urgency Alert</option>
                            <option value="INTELLIGENCE ADV">🟡 Intelligence Advisory</option>
                            <option value="ROUTINE BRIEF">🔵 Routine Briefing</option>
                          </select>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: ORCA.textMuted }}>Summary Overview</label>
                          <textarea
                            required
                            rows={2}
                            value={newBSummary}
                            onChange={e => setNewBSummary(e.target.value)}
                            placeholder="Provide a brief one-paragraph executive summary..."
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: `1px solid ${ORCA.border}`, borderRadius: 4, outline: "none", resize: "none" }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: ORCA.textMuted }}>Full Directive Body</label>
                          <textarea
                            rows={4}
                            value={newBBody}
                            onChange={e => setNewBBody(e.target.value)}
                            placeholder="Detailed operational steps, public keys, or directives..."
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: `1px solid ${ORCA.border}`, borderRadius: 4, outline: "none", resize: "none" }}
                          />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 600, color: ORCA.textMuted }}>Directive Attachment Filename (Optional)</label>
                          <input
                            type="text"
                            value={newBAttachment}
                            onChange={e => setNewBAttachment(e.target.value)}
                            placeholder="e.g. Security_Advisory_TN_Border.pdf"
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: `1px solid ${ORCA.border}`, borderRadius: 4, outline: "none" }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, borderTop: `1px solid ${ORCA.border}`, paddingTop: 12 }}>
                          <button 
                            type="button" 
                            onClick={() => setIsCreateBulletinOpen(false)}
                            style={{ background: "none", border: `1px solid ${ORCA.border}`, color: ORCA.textMuted, borderRadius: 4, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            disabled={publishing}
                            style={{ background: ORCA.navy, color: "white", border: "none", borderRadius: 4, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: publishing ? "default" : "pointer", opacity: publishing ? 0.6 : 1 }}
                          >
                            {publishing ? "Publishing..." : "Publish Alert"}
                          </button>
                        </div>
                        {/*
                          A failed publish has to say so. This wrote straight
                          into local state, so it always looked like it had
                          worked — including when nothing was stored anywhere.
                        */}
                        {publishError && (
                          <div style={{ marginTop: 10, background: "rgba(153,0,0,0.06)", border: "1px solid rgba(153,0,0,0.25)", borderRadius: 4, padding: "8px 12px", fontSize: 12, color: ORCA.redDark }}>
                            {publishError}
                          </div>
                        )}
                      </form>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ============================================================ */}
            {/* 10. PROFILE SETTINGS                                         */}
            {/* ============================================================ */}
            {/* ============================================================ */}
            {/* 10. PROFILE SETTINGS                                         */}
            {/* ============================================================ */}
            {activeTab === "settings" && (
              <div style={{ animation: "fadeIn 0.3s ease", flex: 1, display: "flex", flexDirection: "column" }}>
                <PageHeader
                  title="Officer Audit Profile & Credentials"
                  subtitle="Your officer record, sign-in history, and audit trail of downloads and AI queries."
                />
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start", marginTop: 4 }}>
                  {/* Left Column: Profile Card */}
                  <Panel style={{ flex: "1 1 380px", maxWidth: 440, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "12px 0 20px" }}>
                      {/* Avatar */}
                      <div style={{
                        width: 72,
                        height: 72,
                        background: "#FF9933",
                        color: "#001f3f",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 22,
                        marginBottom: 14,
                        boxShadow: "0 4px 10px rgba(255, 153, 51, 0.2)",
                        border: "3px solid #002855"
                      }}>
                        {officerPhoto ? (
                          <img src={officerPhoto} alt="Officer profile photo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        ) : (() => {
                          // Initials from the real name only. No stand-in: "RKS"
                          // looked like a genuine officer's initials.
                          const nm = catalystProfile?.name || "";
                          const initials = nm.split(" ").filter((n: string) => n.length > 0 && /^[a-zA-Z]/.test(n))
                            .map((n: string) => n[0]).join("").substring(0, 3).toUpperCase();
                          return initials || "—";
                        })()}
                      </div>

                      <h3 style={{ fontSize: 16, fontWeight: 800, color: ORCA.navy, margin: 0 }}>
                        {catalystProfile?.name || (telemetryLoading ? "…" : "Name not on record")}
                      </h3>
                      <div style={{
                        marginTop: 6,
                        background: "rgba(0,31,63,0.06)",
                        color: "#001f3f",
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontFamily: "JetBrains Mono, monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em"
                      }}>
                        {catalystProfile?.rank || catalystProfile?.designation || "Not on record"}
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${ORCA.border}`, paddingTop: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                          // Every value comes from Catalyst (falling back to the
                          // Firestore profile until migration completes). Unset
                          // fields read "Not on record" - the old defaults were
                          // plausible enough to be mistaken for real records.
                          { label: "KGID", value: profileField("kgid", "badgeId"), code: true },
                          { label: "Clearance Level", value: profileField("clearanceLevel", "clearanceLevel"), code: true },
                          { label: "Designation", value: profileField("designation", "designation") },
                          { label: "State Audit District", value: profileField("district", "district") },
                          { label: "Assigned Unit / Station", value: profileField("station", "station") },
                          { label: "Mobile Ingress Phone", value: profileField("mobile", "mobile"), code: true },
                          { label: "Secure Intranet Email", value: profileField("email", "email") },
                          // The raw slug ("admin_full") is an internal identifier and means
                          // nothing to an officer. Show the label RBAC_CONFIG already
                          // defines, with the slug kept as a tooltip so support can still
                          // read it, and the access breadth derived from the same config.
                          {
                            label: "Console Authorization Role",
                            value: roleLabel,
                            hint: roleScope,
                            title: roleSlug,
                          }
                        ].map((item, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12.5, gap: 12 }}>
                            <span style={{ color: ORCA.textMuted, fontWeight: 500, flexShrink: 0 }}>{item.label}</span>
                            <span style={{ textAlign: "right" }} title={(item as any).title || undefined}>
                              <span style={{
                                color: ORCA.navy,
                                fontWeight: 600,
                                fontFamily: item.code ? "JetBrains Mono, monospace" : "inherit",
                                fontSize: item.code ? 11.5 : 12.5
                              }}>{item.value}</span>
                              {(item as any).hint ? (
                                <span style={{ display: "block", color: ORCA.textMuted, fontWeight: 500, fontSize: 10.5, marginTop: 2 }}>
                                  {(item as any).hint}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Duty Session & Time Analytics Box */}
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${ORCA.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6, fontFamily: "JetBrains Mono, monospace" }}>
                        <Clock style={{ width: 14, height: 14, color: "#FF9933" }} />
                        <span>Duty Session & Time Telemetry</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                          <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>ACTIVE SESSION TIME</span>
                          <strong style={{ fontSize: 14, color: "#10b981", fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                            {/* Measured from the open OfficerSession row's LoginAt, not from a
                                per-tab sessionStorage timestamp that restarted in a second tab. */}
                            {activeSession.known ? formatElapsed(activeSession.elapsedSeconds || 0) : "—"}
                          </strong>
                          <span style={{ fontSize: 9.5, color: activeSession.known ? "#10b981" : ORCA.textMuted, fontWeight: 700, marginTop: 2, display: "block" }}>
                            {activeSession.known ? "Since sign-in" : "No open session recorded"}
                          </span>
                        </div>

                        {(() => {
                          // Duty figures computed from the Catalyst session table,
                          // not localStorage - which was per-browser, so an officer
                          // on a second machine saw a blank history and a "first
                          // session" that was not their first.
                          const sessions = telemetry.sessions;
                          const completed = sessions.filter((x: any) => Number.isFinite(x.durationSeconds));
                          const totalSeconds = completed.reduce((sum: number, x: any) => sum + Number(x.durationSeconds || 0), 0);
                          const totalHrs = (totalSeconds / 3600).toFixed(1);
                          const avgShift = completed.length ? (totalSeconds / 3600 / completed.length).toFixed(1) : "0.0";
                          const last = completed[0];

                          return (
                            <>
                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>DUTY LOGGED</span>
                                <strong style={{ fontSize: 14, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {totalHrs} Hrs
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>
                                  {completed.length ? `Avg ${avgShift} Hrs / Shift` : "No completed sessions yet"}
                                </span>
                              </div>

                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>LAST SESSION DURATION</span>
                                <strong style={{ fontSize: 13, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {last ? formatDuration(last.durationSeconds) : "—"}
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>
                                  {last ? "Logged Session" : "Current session is the first"}
                                </span>
                              </div>

                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>TOTAL LOGIN COUNT</span>
                                <strong style={{ fontSize: 13, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {sessions.length} {sessions.length === 1 ? "Ingress" : "Ingresses"}
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>
                                  {telemetry.configured ? "Recorded statewide" : "Session log unavailable"}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ marginTop: 20, padding: 12, background: "rgba(255,153,51,0.05)", border: "1px dashed rgba(255,153,51,0.2)", borderRadius: 6, display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Fingerprint style={{ width: 20, height: 20, color: "#FF9933", flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.5 }}>
                        {/* This used to read "Active Session Cryptographic Key" and
                            display ISD_SHA256_CERT_<uid>_AUDIT. Nothing was signed or
                            hashed - it was the officer's UID dressed up as a
                            certificate. Labelled for what it actually is. */}
                        <strong>Session Identifier:</strong><br/>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                          {officerProfile?.uid || "Not signed in"}
                        </span>
                      </div>
                    </div>
                  </Panel>

                  {/* Right Column: Audit Logs & Histories (Tabbed Panel) */}
                  <Panel style={{ flex: "1 1 500px", display: "flex", flexDirection: "column" }}>
                    {/* Tab Navigation header */}
                    <div style={{ display: "flex", borderBottom: `1px solid ${ORCA.border}`, marginBottom: 16, overflowX: "auto" }}>
                      {[
                        { id: "ingress", label: "Login History" },
                        { id: "downloads", label: "File Downloads" },
                        { id: "ai_queries", label: "AI Audits" },
                        { id: "devices", label: "Active Sessions" }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setProfileTab(tab.id as any)}
                          style={{
                            padding: "10px 16px",
                            background: "none",
                            border: "none",
                            borderBottom: profileTab === tab.id ? `2px solid ${ORCA.orange}` : "2px solid transparent",
                            color: profileTab === tab.id ? ORCA.navy : ORCA.textMuted,
                            fontWeight: profileTab === tab.id ? 700 : 500,
                            fontSize: 12.5,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s"
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab content 1: Login Ingress History */}
                    {profileTab === "ingress" && (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Sign-in History</h3>
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            {telemetry.configured ? "● CATALYST" : "○ LOG UNAVAILABLE"}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Sign-in history for this officer, recorded server-side at each authentication.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Login Time (IST)</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Logout / End Time</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Session Duration</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>IP Address</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Browser / Device</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* One source: the Catalyst OfficerSession table.
                                  This previously merged a synthesised "current session"
                                  row, localStorage history and Firestore audit_logs, and
                                  labelled every row with invented values - "Encrypted PKI
                                  Handshake", "Biometric Ingress Token", "ISD-NODE-xxxxxx",
                                  "Secure Local Ingress". None of those were measured. */}
                              {telemetry.sessions.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ padding: "24px 12px", textAlign: "center", color: ORCA.textMuted, fontSize: 12 }}>
                                    {telemetryLoading
                                      ? "Loading login history…"
                                      : telemetry.configured
                                        ? "No sessions recorded for this officer yet."
                                        : "Login history is unavailable — the session log could not be reached."}
                                  </td>
                                </tr>
                              ) : telemetry.sessions.map((sess: any, idx: number) => {
                                // `abandoned` is derived at read time: the row is
                                // still ACTIVE because nothing closed it, or it
                                // was superseded by a later sign-in.
                                const isOpen = sess.status === "ACTIVE" && !sess.abandoned;
                                const forced = sess.status === "VPN_FORCED_LOCKDOWN";
                                return (
                                  <tr key={sess.rowId || idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                    <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 500 }}>{formatCatalystUtcAsIst(sess.loginAt)}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{sess.logoutAt ? formatCatalystUtcAsIst(sess.logoutAt) : (isOpen ? "Session open" : sess.abandoned ? "No sign-out recorded" : "—")}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>
                                      {isOpen ? "—" : formatDuration(sess.durationSeconds)}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>{sess.ipAddress || "—"}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sess.userAgent}>
                                      {sess.userAgent || "—"}
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                      <span style={{
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        color: forced ? "#ef4444" : isOpen ? "#10b981" : sess.abandoned ? "#f59e0b" : ORCA.textMuted
                                      }}>
                                        {forced
                                          ? "VPN LOCKDOWN"
                                          : isOpen
                                          ? "ACTIVE"
                                          : sess.abandoned
                                          ? "STALE"
                                          : "CLOSED"}
                                      </span>
                                      {sess.endReason ? (
                                        <div style={{ fontSize: 9.5, color: ORCA.textMuted, marginTop: 2 }}>{sess.endReason}</div>
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab content 2: File Downloads */}
                    {profileTab === "downloads" && (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Document Downloads</h3>
                          <span style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, background: "rgba(59,130,246,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● ENCRYPTED EXPORTS
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Authorized dossier exports, printed reports, and criminal database downloads generated by this account.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Date/Time (IST)</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Dossier/File Ref</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Format</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Size</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Detail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {telemetry.downloads.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: "24px 12px", textAlign: "center", color: ORCA.textMuted, fontSize: 12 }}>
                                    {telemetryLoading
                                      ? "Loading download history…"
                                      : telemetry.configured
                                        ? "No document downloads recorded for this officer yet."
                                        : "Download history is unavailable — the activity log could not be reached."}
                                  </td>
                                </tr>
                              ) : telemetry.downloads.map((file: any, idx: number) => (
                                <tr key={file.activityId ?? idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                  <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 500 }}>{file.occurredAt || "—"}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textGray, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.title}>{file.title}</td>
                                  <td style={{ padding: "10px 12px" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                                      {file.category || "—"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textMuted }}>
                                    {Number.isFinite(file.sizeBytes) && file.sizeBytes !== null ? `${Math.round(file.sizeBytes / 1024)} KB` : "—"}
                                  </td>
                                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: ORCA.orange }}>{file.detail || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab content 3: AI Activity Audits */}
                    {profileTab === "ai_queries" && (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>AI Query Log</h3>
                          <span style={{ fontSize: 10, color: "#FF9933", fontWeight: 700, background: "rgba(255,153,51,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● CONTEXT LOGGED
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Audit trails of prompt telemetry, pattern analyses, and semantic lookups executed on backend O.R.C.A models.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Audit Time (IST)</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Audited Category</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Query Telemetry Focus</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Context</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Entry #</th>
                              </tr>
                            </thead>
                            <tbody>
                              {telemetry.aiQueries.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: "24px 12px", textAlign: "center", color: ORCA.textMuted, fontSize: 12 }}>
                                    {telemetryLoading
                                      ? "Loading AI audit trail…"
                                      : telemetry.configured
                                        ? "No AI queries recorded for this officer yet."
                                        : "AI audit trail is unavailable — the activity log could not be reached."}
                                  </td>
                                </tr>
                              ) : telemetry.aiQueries.map((q: any, idx: number) => (
                                <tr key={q.activityId ?? idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                  <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 500 }}>{q.occurredAt || "—"}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{q.category || "Chatbot Inquiry"}</td>
                                  <td style={{ padding: "10px 12px", fontStyle: "italic" }}>&quot;{q.title}&quot;</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textMuted }}>{q.detail || "—"}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>{q.activityId ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab content 4: Active Session Devices */}
                    {profileTab === "devices" && (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Recorded Sessions</h3>
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● {telemetry.sessions.filter((x: any) => x.status === "ACTIVE" && !x.abandoned).length} OPEN SESSION(S)
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Sessions opened under this officer profile, newest first, recorded server-side at sign-in.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Session #</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Signed In</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>IP Address</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Browser / Device</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {telemetry.sessions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: "24px 12px", textAlign: "center", color: ORCA.textMuted, fontSize: 12 }}>
                                    {telemetryLoading
                                      ? "Loading sessions…"
                                      : telemetry.configured
                                        ? "No sessions recorded for this officer yet."
                                        : "Session history is unavailable — the session log could not be reached."}
                                  </td>
                                </tr>
                              ) : telemetry.sessions.map((sess: any, idx: number) => {
                                // See the Login History table: a session left
                                // open by a closed tab is not a live one.
                                const isOpen = sess.status === "ACTIVE" && !sess.abandoned;
                                return (
                                  <tr key={sess.rowId || idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                    <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 700, fontFamily: "JetBrains Mono" }}>{sess.sessionId ?? "—"}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{formatCatalystUtcAsIst(sess.loginAt)}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textMuted, fontFamily: "JetBrains Mono", fontSize: 11.5 }}>{sess.ipAddress || "—"}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textMuted, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sess.userAgent}>
                                      {sess.userAgent || "—"}
                                    </td>
                                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                      <span style={{ fontSize: 10.5, fontWeight: 600, color: isOpen ? "#10b981" : sess.abandoned ? "#f59e0b" : ORCA.textMuted }}>
                                        {isOpen
                                          ? "Open"
                                          : sess.abandoned
                                          ? "Stale"
                                          : `Closed · ${formatDuration(sess.durationSeconds)}`}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            {activeTab.startsWith("admin-") && (
              <CommandAdminCenter adminTab={activeTab} />
            )}

          </div>

      </main>
    </div>
  );
};

// ============================================================
// Auth Loading Skeleton
// ============================================================
const AuthLoadingSkeleton: React.FC = () => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: ORCA.offWhite }}>
    <div style={{
      width: "100%",
      maxWidth: 400,
      border: `1px solid ${ORCA.border}`,
      background: ORCA.white,
      padding: 32,
      borderRadius: 8,
      boxShadow: ORCA.shadowMd,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      textAlign: "center"
    }}>
      <Loader2 style={{ width: 40, height: 40, color: ORCA.gold, animation: "spin 1s linear infinite" }} />
      <div>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ISD Mainframe Connection
        </h3>
        <p style={{ fontSize: 10, color: ORCA.textGray, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
          Restoring encrypted officer session node...
        </p>
      </div>
      <div style={{
        width: "100%",
        background: ORCA.offWhite,
        border: `1px solid ${ORCA.border}`,
        borderRadius: 4,
        padding: 12,
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 9.5,
        color: ORCA.green,
        fontFamily: "JetBrains Mono, monospace",
        lineHeight: 1.6
      }}>
        <div>&gt; SYNCING SECURE TOKEN... SUCCESS</div>
        <div>&gt; DECRYPTING PROFILE CACHE... RUNNING</div>
        <div>&gt; INITIATING COMMAND TELEMETRY... PENDING</div>
      </div>
    </div>
  </div>
);

// ============================================================
// Dashboard page export
// ============================================================
export default function DashboardPage() {
  const { isLoggedIn, loading, officerProfile, logout } = useAuth();
  const router = useRouter();

  // State to control session termination overlay
  const [logoutOverlay, setLogoutOverlay] = useState<{ active: boolean; username: string; time: string } | null>(null);

  useEffect(() => {
    const handleLogoutTrigger = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " IST";
      const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      
      setLogoutOverlay({
        active: true,
        username: officerProfile ? `${officerProfile.rank} ${officerProfile.name}` : "Command Administrator",
        time: `${timeStr} on ${dateStr}`
      });

      // Maintain screen blur for 3.5 seconds, then perform signout (which will redirect to login page)
      setTimeout(() => {
        logout().catch(() => {});
      }, 3500);
    };

    window.addEventListener("orca_initiate_logout", handleLogoutTrigger);
    return () => window.removeEventListener("orca_initiate_logout", handleLogoutTrigger);
  }, [officerProfile, logout]);

  useEffect(() => {
    if (!loading && !isLoggedIn && !logoutOverlay) {
      router.push("/login");
    }
  }, [isLoggedIn, loading, router, logoutOverlay]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
        <Topbar />
        <AuthLoadingSkeleton />
      </div>
    );
  }

  if (!isLoggedIn && !logoutOverlay) {
    return null; // Let the redirect happen
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", position: "relative" }}>
      {/* Blurred background layout during logout */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        flex: 1, 
        height: "100%", 
        width: "100%",
        filter: logoutOverlay?.active ? "blur(10px) grayscale(40%)" : "none",
        transition: "filter 0.5s ease"
      }}>
        <Topbar />
        <MainContent />
        <MiniAIAssistant />
      </div>

      {/* Logout Overlay */}
      {logoutOverlay?.active && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0, 31, 63, 0.45)", // secure dark overlay
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999, // on top of everything including dropdowns
          animation: "fadeIn 0.3s ease"
        }}>
          <div style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            width: "90%",
            maxWidth: 460,
            padding: 32,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            animation: "scaleUp 0.3s ease"
          }}>
            <Fingerprint style={{ width: 44, height: 44, color: "#f97316", animation: "pulse 1.5s infinite" }} />
            
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#001f3f", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Session Securely Terminated
              </h3>
              <p style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>
                O.R.C.A INTERNAL SECURITY DIVISION
              </p>
            </div>

            <div style={{
              width: "100%",
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: 16,
              textAlign: "left",
              fontSize: 12.5,
              color: "#475569",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              lineHeight: 1.5
            }}>
              <div><strong>Status:</strong> <span style={{ color: "#ef4444", fontWeight: 700 }}>LOGGED OUT</span></div>
              <div><strong>Officer Credentials:</strong> <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: "#001f3f" }}>{logoutOverlay.username}</span></div>
              <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 8, marginTop: 4 }}>
                <strong>Log-out Time:</strong> <span style={{ color: "#001f3f", fontWeight: 600 }}>{logoutOverlay.time}</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#475569" }}>
              <Loader2 style={{ width: 16, height: 16, color: "#001f3f", animation: "spin 1s linear infinite" }} />
              <span>Disconnecting crypt link & redirecting...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
