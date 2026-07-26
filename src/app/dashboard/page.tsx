"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessTab, getRoleConfig } from "@/lib/rbac";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Telemetry } from "@/components/dynamic/Telemetry";
import { Intercepts } from "@/components/dynamic/Intercepts";
import { MapGrid } from "@/components/dynamic/MapGrid";
import { Network } from "@/components/dynamic/Network";
import { Letterhead } from "@/components/dynamic/Letterhead";
import { DocumentVerification } from "@/components/dynamic/DocumentVerification";
import { AIChatbotModule } from "@/components/dynamic/AIChatbotModule";
import { MiniAIAssistant } from "@/components/dynamic/MiniAIAssistant";
import { CommandAdminCenter } from "@/components/dynamic/CommandAdminCenter";
import { LiveNewsFeeds } from "@/components/dynamic/LiveNewsFeeds";
import { districtDatabase, suspectDossiers } from "@/lib/mock";
import { 
  Plus, 
  UploadCloud, 
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
  Map as MapIcon,
  FolderLock,
  Cpu
} from "lucide-react";

// ============================================================
// O.R.C.A Design System Tokens (inline, matching dashboard.html)
// ============================================================
const ORCA = {
  navy: "#001f3f",
  navyMid: "#002855",
  navyLight: "#003366",
  gold: "#FF9933",
  white: "#ffffff",
  offWhite: "#f8fafc",
  textDark: "#1e293b",
  textGray: "#475569",
  textMuted: "#94a3b8",
  border: "#cbd5e1",
  red: "#ef4444",
  redDark: "#990000",
  green: "#10b981",
  orange: "#f97316",
  blue: "#1E3A8A",
  shadow: "0 1px 3px rgba(0,0,0,0.1)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.1)",
};

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
// ============================================================
const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, subtitle, action }) => (
  <div className="orca-page-header" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: ORCA.navy, marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: ORCA.textGray }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

// ============================================================
// O.R.C.A Button Styles
// ============================================================
const BtnNavy: React.FC<{ onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }> = ({ onClick, children, style }) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 14px",
      background: ORCA.navy,
      color: "white",
      border: "none",
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Inter', sans-serif",
      ...style
    }}
    onMouseEnter={e => (e.currentTarget.style.background = ORCA.navyMid)}
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
    selectedSuspectId, 
    setSelectedSuspectId,
    selectedDistrictCode,
    firCases,
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

  const [dragOver, setDragOver] = useState(false);
  const [customQueryText, setCustomQueryText] = useState("");
  const [networkSubTab, setNetworkSubTab] = useState<"visualizer" | "heatmap">("visualizer");
  const [forensicSubTab, setForensicSubTab] = useState<"vault" | "copilot">("vault");
  const [profileTab, setProfileTab] = useState<"ingress" | "downloads" | "ai_queries" | "devices">("ingress");
  const [liveSessionLogs, setLiveSessionLogs] = useState<any[]>([]);

  const { officerProfile, dashboardRole } = useAuth();

  useEffect(() => {
    if (activeTab === "settings" || profileTab === "ingress") {
      try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(30));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const logsList: any[] = [];
          snapshot.forEach(docSnap => {
            logsList.push({ id: docSnap.id, ...docSnap.data() });
          });
          if (logsList.length > 0) {
            setLiveSessionLogs(logsList);
          }
        }, (err) => {
          // Fallback to API endpoint
          fetch("/api/admin/rbac/logs")
            .then(res => res.json())
            .then(data => {
              if (data.success && data.logs) setLiveSessionLogs(data.logs);
            })
            .catch(() => {});
        });
        return () => unsubscribe();
      } catch (e) {
        fetch("/api/admin/rbac/logs")
          .then(res => res.json())
          .then(data => {
            if (data.success && data.logs) setLiveSessionLogs(data.logs);
          })
          .catch(() => {});
      }
    }
  }, [activeTab, profileTab]);

  // --- Official Bulletins States ---
  const INITIAL_BULLETINS = [
    {
      id: "BLT-2026-901",
      title: "MHA Directive: Cyber Syndicate Darknet Wallet Tracking",
      category: "HIGH URGENCY",
      date: "Today, 10:30 IST",
      summary: "Ministry of Home Affairs has flag-tagged 12 secure cryptocurrency wallets linked to extortion rackets operating in Bengaluru. Officers must log and cross-reference wallet hashes against financial forensic audits.",
      body: "Operational Guidelines: When auditing digital wallets in suspect files, cross-match public keys with the KSP Financial Forensic Intelligence repository. Any hash similarity above 90% must be escalated to cyber unit immediately.",
      author: "Office of the Superintendent of Police, SCRB",
      attachment: "MHA_Darknet_Tracking_v2.pdf"
    },
    {
      id: "BLT-2026-884",
      title: "SCRB Circular: Standardizing Mobile Intercept Audits",
      category: "INTELLIGENCE ADV",
      date: "Yesterday, 14:15 IST",
      summary: "New protocols for active cell-tower intercept auditing are effective immediately. Every intercept log must be authenticated with ISD session tokens and signed-off by rank Inspector or higher.",
      body: "Administrative Directives: All surveillance logs require automated synchronization with the secure storage backup. Standby mobile ingress terminals must be audited daily under security codes.",
      author: "Internal Security Division (ISD) Headquarters",
      attachment: "KSP_Surveillance_Protocol_98.pdf"
    },
    {
      id: "BLT-2026-850",
      title: "Routine Brief: Inter-State Border Patrol Grid Co-ordination",
      category: "ROUTINE BRIEF",
      date: "02 July 2026, 09:00 IST",
      summary: "Weekly coordination brief with Tamil Nadu and Andhra Pradesh border checkposts. Focus is on tracking cargo transit vehicles matching gang logistics profiles.",
      body: "Security measures: Border checkposts must run automated license plate scans on all container trucks. Cross-check transit registers against the ORCA Organized Crime Database daily.",
      author: "Border Patrol Command Center",
      attachment: "Border_Patrol_Weekly_Brief_26.pdf"
    }
  ];

  const [bulletins, setBulletins] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orca_official_bulletins");
      if (saved) return JSON.parse(saved);
    }
    return INITIAL_BULLETINS;
  });

  useEffect(() => {
    localStorage.setItem("orca_official_bulletins", JSON.stringify(bulletins));
  }, [bulletins]);

  const [bulletinSearch, setBulletinSearch] = useState("");
  const [bulletinFilter, setBulletinFilter] = useState("ALL");
  const [isCreateBulletinOpen, setIsCreateBulletinOpen] = useState(false);
  const [newBTitle, setNewBTitle] = useState("");
  const [newBCategory, setNewBCategory] = useState("INTELLIGENCE ADV");
  const [newBSummary, setNewBSummary] = useState("");
  const [newBBody, setNewBBody] = useState("");
  const [newBAttachment, setNewBAttachment] = useState("");

  const handlePublishBulletin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBTitle || !newBSummary) return;

    const newBulletin = {
      id: `BLT-2026-${Math.floor(100 + Math.random() * 900)}`,
      title: newBTitle,
      category: newBCategory,
      date: "Just now",
      summary: newBSummary,
      body: newBBody,
      author: officerProfile ? `${officerProfile.rank} ${officerProfile.name}` : "Audit Command Node",
      attachment: newBAttachment || "ISD_Security_Notice.pdf"
    };

    setBulletins([newBulletin, ...bulletins]);
    setIsCreateBulletinOpen(false);
    setNewBTitle("");
    setNewBSummary("");
    setNewBBody("");
    setNewBAttachment("");
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
        "fir",
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
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem("orca_pending_query") || localStorage.getItem("orca_pending_query");
      if (pending) {
        setCustomQueryText(pending);
        setActiveTab("fir");
        setForensicSubTab("copilot");
        sessionStorage.removeItem("orca_pending_query");
        localStorage.removeItem("orca_pending_query");
      }
    }

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

  const activeCase = firCases.find(c => c.id === activeFirId) || firCases[0];
  const activeDistrict = districtDatabase[selectedDistrictCode] || districtDatabase["BLR_U"];
  const activeDossier = suspectDossiers[selectedSuspectId] || suspectDossiers["sus-01"];

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await ingestNewCase(files[0]);
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) await ingestNewCase(files[0]);
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

  // 3. Check for valid dashboardRole from custom claims
  const validRoles = ["admin_full", "admin_scrb", "admin_verification", "investigation_l2", "investigation_l1", "admin_l2", "admin_l1", "it_admin", "investigation"];
  if (!dashboardRole || !validRoles.includes(dashboardRole)) {
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
                  action={
                    <BtnNavy onClick={() => setActiveTab("fir")}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Plus style={{ width: 14, height: 14 }} /> Import Incident File
                      </span>
                    </BtnNavy>
                  }
                />

                 {/* Statewide Telemetry */}
                 {["ISD-LEVEL-I", "ISD-LEVEL-II", "ISD-LEVEL-4", "ISD-LEVEL-2"].includes(officerProfile?.clearanceLevel || officerProfile?.isdLevel || "") ? (
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
                    headerRight={<span style={{ color: ORCA.orange, fontSize: 11 }}>REALTIME SYNC</span>}
                    bodyStyle={{ padding: 0, maxHeight: 320, overflowY: "auto" }}
                  >
                    <div style={{ padding: 16 }}>
                      <Intercepts />
                    </div>
                  </Panel>

                  {/* Crime Bulletins */}
                  <Panel header="Crime Bulletins & Notices" bodyStyle={{ maxHeight: 320, overflowY: "auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ borderLeft: `3px solid ${ORCA.orange}`, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${ORCA.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase", marginBottom: 4 }}>
                          <span>Interpol Notice #442</span>
                          <span style={{ color: ORCA.green }}>SECURE</span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.6 }}>
                          Biometric profiles synchronized for domestic maritime borders matching known antiquities smuggling cells entering Karnataka coastal boundaries.
                        </p>
                      </div>
                      <div style={{ borderLeft: "3px solid #1E3A8A", paddingLeft: 12, paddingTop: 8, paddingBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase", marginBottom: 4 }}>
                          <span>Cert-In Advisory</span>
                          <span style={{ color: ORCA.redDark }}>VULN-902</span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.6 }}>
                          Critical zero-day patch released for state government proxy firewalls. Mandating immediate validation of all active municipal terminal links.
                        </p>
                      </div>
                    </div>
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
                  subtitle="Statewide statistics, frequency tables, and geographical crime correlations"
                  action={<BtnNavy>Filter State Records</BtnNavy>}
                />

                <Panel noPadding>
                  {/* Filter bar — matches .filter-bar */}
                  <div style={{
                    display: "flex",
                    gap: 16,
                    padding: "12px 16px",
                    background: "rgba(0,0,0,0.02)",
                    borderBottom: `1px solid ${ORCA.border}`
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: ORCA.textGray, textTransform: "uppercase" }}>
                      <label>Sector District:</label>
                      <select style={{ padding: "4px 8px", border: `1px solid ${ORCA.border}`, borderRadius: 4, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                        <option>All Districts (Karnataka)</option>
                        <option>Bengaluru Urban</option>
                        <option>Mysuru</option>
                        <option>Mangaluru</option>
                        <option>Hubballi-Dharwad</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: ORCA.textGray, textTransform: "uppercase" }}>
                      <label>BNS Classification:</label>
                      <select style={{ padding: "4px 8px", border: `1px solid ${ORCA.border}`, borderRadius: 4, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                        <option>All Classifications</option>
                        <option>BNS Section 308 (Extortion)</option>
                        <option>BNS Section 111 (Organized Crime)</option>
                        <option>BNS Section 318 (Cheating)</option>
                      </select>
                    </div>
                  </div>

                  {/* Data table — matches .data-table */}
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["District", "Severe Crimes (BNS 111)", "Financial Cyber Crimes", "Patrol Dispatch Rate", "Avg Resolution", "Threat Index Score"].map(h => (
                          <th key={h} style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: ORCA.textGray,
                            textTransform: "uppercase",
                            borderBottom: `2px solid ${ORCA.border}`,
                            background: "rgba(0,0,0,0.01)",
                            fontFamily: "'Inter', sans-serif"
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { district: "Bengaluru Urban", severe: "28 Cases", cyber: "1,104 Cases", patrol: "96%", rate: "96% (Optimal)", resolution: "4.2 Hours", threat: "9.4 Critical", threatColor: ORCA.red },
                        { district: "Mysuru", severe: "14 Cases", cyber: "182 Cases", patrol: "88%", rate: "88% (Secured)", resolution: "8.6 Hours", threat: "6.8 High", threatColor: ORCA.orange },
                        { district: "Mangaluru (DK)", severe: "19 Cases", cyber: "241 Cases", patrol: "91%", rate: "91% (Optimal)", resolution: "6.1 Hours", threat: "7.2 High", threatColor: ORCA.orange },
                        { district: "Hubballi-Dharwad", severe: "11 Cases", cyber: "94 Cases", patrol: "82%", rate: "82% (Nominal)", resolution: "12.4 Hours", threat: "5.1 Moderate", threatColor: ORCA.blue },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "16px", fontSize: 13, fontWeight: 600 }}>{row.district}</td>
                          <td style={{ padding: "16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>{row.severe}</td>
                          <td style={{ padding: "16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>{row.cyber}</td>
                          <td style={{ padding: "16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: ORCA.green, fontWeight: 600 }}>{row.rate}</td>
                          <td style={{ padding: "16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>{row.resolution}</td>
                          <td style={{ padding: "16px" }}>
                            <span style={{
                              background: `${row.threatColor}18`,
                              color: row.threatColor,
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600
                            }}>{row.threat}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </div>
            )}

            {/* ============================================================ */}
            {/* 3. FIR EVIDENCE VAULT                                         */}
            {/* ============================================================ */}
            {activeTab === "fir" && (
              <div style={{ animation: "fadeIn 0.3s ease", flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Warning Banner inside Forensic section */}
                <div 
                  className="breathing-alert-banner"
                  style={{
                    color: "#713f12",
                    padding: "8px 16px",
                    textAlign: "center",
                    fontSize: "11px",
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
                  <span>⚠️ COMING SOON: THESE SECTIONS ARE UNDER DEVELOPMENT AND TESTING</span>
                </div>
                <PageHeader
                  title={forensicSubTab === "vault" ? "Forensic Evidence Ingress" : "ISD Intelligence Copilot"}
                  subtitle={forensicSubTab === "vault" ? "Upload and parse official FIR records using semantic OCR extraction engines" : "Structured intelligence query workbench & law enforcement correlation system"}
                  action={
                    <div style={{
                      display: "inline-flex",
                      background: "rgba(0,31,63,0.04)",
                      padding: 4,
                      borderRadius: 8,
                      border: `1px solid ${ORCA.border}`
                    }}>
                      <button
                        onClick={() => setForensicSubTab("vault")}
                        style={{
                          padding: "6px 14px",
                          background: forensicSubTab === "vault" ? ORCA.navy : "transparent",
                          color: forensicSubTab === "vault" ? "white" : ORCA.textGray,
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
                        <FolderLock style={{ width: 14, height: 14 }} />
                        Ingress Vault
                      </button>
                      <button
                        onClick={() => setForensicSubTab("copilot")}
                        style={{
                          padding: "6px 14px",
                          background: forensicSubTab === "copilot" ? ORCA.navy : "transparent",
                          color: forensicSubTab === "copilot" ? "white" : ORCA.textGray,
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
                        <Cpu style={{ width: 14, height: 14 }} />
                        AI Report Generator
                      </button>
                    </div>
                  }
                />

                {forensicSubTab === "vault" ? (
                  /* vault-grid: 300px left, 1fr mid, 350px right */
                  <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 350px", gap: 24, flex: 1, minHeight: 0 }}>

                    {/* Left column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <Panel header="Evidence Vault Ingestion">
                        {uploadingState === "idle" ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById("hidden-file-input")?.click()}
                            style={{
                              textAlign: "center",
                              padding: "40px 20px",
                              border: `2px dashed ${dragOver ? ORCA.gold : ORCA.border}`,
                              borderRadius: 8,
                              cursor: "pointer",
                              background: dragOver ? "rgba(255,153,51,0.05)" : ORCA.offWhite,
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ORCA.gold; }}
                            onMouseLeave={e => { if (!dragOver) (e.currentTarget as HTMLElement).style.borderColor = ORCA.border; }}
                          >
                            <UploadCloud style={{ width: 32, height: 32, color: ORCA.textMuted, margin: "0 auto 8px" }} />
                            <div style={{ fontWeight: 600, fontSize: 14, color: ORCA.navy, marginBottom: 4 }}>Ingest Scanned File</div>
                            <div style={{ fontSize: 11, color: ORCA.textMuted }}>Drag and drop PDF or TXT records here</div>
                            <input type="file" id="hidden-file-input" style={{ display: "none" }} accept=".txt,.pdf" onChange={handleFileChange} />
                          </div>
                        ) : (
                          <div style={{ background: "black", color: "#10b981", fontFamily: "JetBrains Mono, monospace", fontSize: 10, padding: 12, borderRadius: 4, minHeight: 120, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16,185,129,0.3)", paddingBottom: 4, marginBottom: 4, fontSize: 9, color: "#34d399" }}>
                              <span>OCR STREAM ENGINE ACTIVE</span>
                              <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                            </div>
                            {uploadLogs.map((logMsg, idx) => (
                              <div key={idx}>&gt; {logMsg}</div>
                            ))}
                          </div>
                        )}
                      </Panel>

                      <Panel header="Active Incident Warrants" noPadding>
                        <div style={{ padding: "8px 0" }}>
                          {firCases.map(fir => (
                            <div
                              key={fir.id}
                              onClick={() => setActiveFirId(fir.id)}
                              style={{
                                padding: "10px 16px",
                                cursor: "pointer",
                                borderLeft: activeFirId === fir.id ? `3px solid ${ORCA.gold}` : "3px solid transparent",
                                background: activeFirId === fir.id ? "rgba(255,153,51,0.05)" : "transparent",
                                borderBottom: `1px solid ${ORCA.border}`,
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => { if (activeFirId !== fir.id) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"; }}
                              onMouseLeave={e => { if (activeFirId !== fir.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                            >
                              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 700, color: ORCA.navy }}>{fir.id}</div>
                              <div style={{ fontSize: 11, color: ORCA.textDark, marginTop: 2 }}>{fir.title}</div>
                              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, color: ORCA.textGray, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                <span>{fir.district}</span>
                                <span style={{ color: fir.severity === "severe" ? ORCA.redDark : ORCA.orange, fontWeight: 700, textTransform: "uppercase" }}>{fir.severity}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </div>

                    {/* Middle column — case workspace */}
                    <div style={{ background: ORCA.white, border: `1px solid ${ORCA.border}`, borderRadius: 8, boxShadow: ORCA.shadow, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${ORCA.border}`,
                        background: "rgba(0,0,0,0.01)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexShrink: 0
                      }}>
                        <div>
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>{activeCase.id}</div>
                          <div style={{ fontSize: 10, color: ORCA.textGray, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>
                            SECTOR DISTRICT: <strong style={{ color: ORCA.navy }}>{activeCase.district.toUpperCase()}</strong>
                            &nbsp;|&nbsp; UTC RECORDED: {activeCase.datetime}
                            &nbsp;|&nbsp; CLASS: {activeCase.category.toUpperCase()}
                          </div>
                        </div>
                        <BtnOutline onClick={() => window.print()}>Export Sealed Case Summary</BtnOutline>
                      </div>

                      <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>Unified Evidence Summary Brief</div>
                          <p style={{ fontSize: 14, lineHeight: 1.6, color: ORCA.textDark }}>{activeCase.summary}</p>
                        </div>
                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>Operational Modus Operandi (MO)</div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace" }}>{activeCase.modusOperandi}</p>
                        </div>
                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>Extracted Suspect Matrix</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            {activeCase.suspects.map(sus => (
                              <div
                                key={sus.id}
                                onClick={() => { setSelectedSuspectId(sus.id); setActiveTab("networks"); }}
                                style={{
                                  border: `1px solid ${ORCA.border}`,
                                  borderRadius: 6,
                                  padding: 12,
                                  display: "flex",
                                  gap: 12,
                                  alignItems: "center",
                                  cursor: "pointer",
                                  background: "white",
                                  transition: "all 0.15s"
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = ORCA.navyMid; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ORCA.border; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                              >
                                <div style={{ width: 40, height: 40, background: "rgba(0,0,0,0.05)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <UserCheck style={{ width: 20, height: 20, color: ORCA.textGray }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 600 }}>{sus.name}</div>
                                  <div style={{ fontSize: 11, color: ORCA.textGray }}>{sus.role.split(" / ")[0]}</div>
                                  <div style={{ fontSize: 10, color: ORCA.green, marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>Sync match: {sus.confidence}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>Case Sequence Chronology</div>
                          <div style={{ position: "relative", paddingLeft: 16 }}>
                            <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: 1.5, background: ORCA.border }} />
                            {activeCase.timeline.map((item, idx) => (
                              <div key={idx} style={{ position: "relative", marginBottom: 12 }}>
                                <div style={{
                                  position: "absolute",
                                  left: -12,
                                  top: 6,
                                  width: 8, height: 8,
                                  borderRadius: "50%",
                                  background: ORCA.white,
                                  border: `1.5px solid ${item.severe ? ORCA.redDark : ORCA.blue}`
                                }} />
                                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700, color: ORCA.textGray }}>{item.time} IST</div>
                                <p style={{ fontSize: 12, color: ORCA.textDark, marginTop: 2, lineHeight: 1.5 }}>{item.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <Panel header="Evidence Chain of Custody">
                        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: ORCA.textGray, marginBottom: 12, wordBreak: "break-all" }}>
                          PACKET HASH: {activeCase.sha256Hash}
                        </div>
                        {activeCase.chainOfCustody.map((log, idx) => (
                          <div key={idx} style={{ marginBottom: 8, fontSize: 10, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>
                            <span style={{ color: ORCA.textMuted }}>[{log.timestamp}]</span> {log.action}<br/>
                            <strong style={{ color: ORCA.textDark }}>{log.operator}</strong> (Key: {log.hash})
                          </div>
                        ))}
                      </Panel>

                      <Panel header="BNS Codified Charges Mapped">
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {activeCase.legalSections.map((section, idx) => (
                            <div key={idx} style={{ border: `1px solid ${ORCA.border}`, borderRadius: 4, padding: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace" }}>{section.code}: {section.title}</div>
                              <div style={{ fontSize: 11, color: ORCA.textGray, marginTop: 4, lineHeight: 1.5 }}>{section.desc}</div>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    </div>
                  </div>
                ) : (
                  /* AI Copilot Query Workbench */
                  <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, flex: 1, minHeight: 0 }}>
                    {/* Query sidebar */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      <Panel style={{ flex: 1, display: "flex", flexDirection: "column" }} bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc", marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 12, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}>Operational Presets</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {[
                              "QUERY: ORG_FINANCIAL_FLOW (SUSPECT: vikram_hegde)",
                              "QUERY: MATCH_MODUS_OPERANDI (CASE: FIR/2026/BLR/104)",
                              "QUERY: COMPILE_CHARGESHEET (BNS_CODES: FIR/104)"
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => { setCustomQueryText(q); runAiQuery(`preset-${idx + 1}`); }}
                                style={{
                                  background: "white",
                                  border: `1px solid ${ORCA.border}`,
                                  borderRadius: 4,
                                  padding: 8,
                                  textAlign: "left",
                                  fontFamily: "JetBrains Mono, monospace",
                                  fontSize: 10.5,
                                  color: ORCA.textDark,
                                  cursor: "pointer",
                                  lineHeight: 1.4,
                                  transition: "0.2s"
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#e8f0fe"; (e.currentTarget as HTMLElement).style.color = ORCA.blue; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white"; (e.currentTarget as HTMLElement).style.color = ORCA.textDark; }}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: 16, background: "#f8fafc" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 8, fontFamily: "JetBrains Mono, monospace" }}>Custom Analytical Inquiry Console</div>
                          <textarea
                            value={customQueryText}
                            onChange={(e) => setCustomQueryText(e.target.value)}
                            placeholder="COMPILE CHARGESHEET (CASE: ISD-CR-2026-104) or search..."
                            style={{
                              width: "100%",
                              border: `1px solid ${ORCA.border}`,
                              borderRadius: 4,
                              padding: 8,
                              fontSize: 12,
                              fontFamily: "'Inter', sans-serif",
                              height: 96,
                              resize: "none",
                              outline: "none",
                              background: "white"
                            }}
                          />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: ORCA.textGray }}>SECURED ENCRYPTED LINK</span>
                            <BtnNavy onClick={() => runAiQuery(null, customQueryText)}>Run Inquiry</BtnNavy>
                          </div>
                        </div>
                        <div style={{
                          background: ORCA.offWhite,
                          border: `1px solid ${ORCA.border}`,
                          borderRadius: 4,
                          padding: 10,
                          fontSize: 9.5,
                          color: ORCA.textGray,
                          lineHeight: 1.6,
                          fontFamily: "JetBrains Mono, monospace",
                          marginTop: 16
                        }}>
                          <strong>CRITICAL PROTOCOL:</strong> Every dynamic query executed inside O.R.C.A is logged and linked to user IPS credentials. Generates court-admissible audit reports.
                        </div>
                      </Panel>
                    </div>

                    {/* Report output */}
                    <Panel
                      header="Secured Report Output"
                      headerRight={
                        <button
                          onClick={() => window.print()}
                          style={{
                            padding: "6px 14px",
                            background: ORCA.gold,
                            color: ORCA.navy,
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'Inter', sans-serif",
                            boxShadow: "0 2px 4px rgba(255, 153, 51, 0.2)",
                            transition: "background 0.15s ease"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#e68a00"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = ORCA.gold; }}
                        >
                          Print Secure Letterhead
                        </button>
                      }
                      style={{ display: "flex", flexDirection: "column" }}
                      bodyStyle={{ flex: 1, overflowY: "auto", padding: 0 }}
                    >
                      <Letterhead report={activeReport} loading={aiReportLoading} />
                    </Panel>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. CRIMINAL NETWORKS (Combined Tab)                          */}
            {/* ============================================================ */}
            {activeTab === "networks" && (
              <div style={{ animation: "fadeIn 0.3s ease", flex: 1, display: "flex", flexDirection: "column" }}>
                <PageHeader
                  title={networkSubTab === "visualizer" ? "Criminal Networks Visualizer" : "State Incident Density Heatmap"}
                  subtitle={networkSubTab === "visualizer" ? "Relational tracking of connected suspects, phone vectors, financial trails, and physical logistics" : "Geospatial distribution models mapping threat frequencies across Karnataka sectors"}
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
                    </div>
                  }
                />

                {networkSubTab === "visualizer" ? (
                  /* Relations Graph Visualizer */
                  <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 480 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <Network />
                    </div>

                    {/* Intelligence dossier */}
                    <div style={{ width: 350, flexShrink: 0 }}>
                      <Panel header="Official Intelligence Dossier (Form ISD-D-09)" style={{ height: "100%" }} bodyStyle={{ overflowY: "auto" }}>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
                          <div style={{ width: 50, height: 50, background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ORCA.navy, fontSize: 18, flexShrink: 0 }}>
                            {activeDossier.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: ORCA.navy }}>{activeDossier.name}</div>
                            <div style={{ fontSize: 11, color: ORCA.textGray }}>Aliases: {activeDossier.aliases}</div>
                            <div style={{
                              fontSize: 10,
                              background: `${ORCA.red}18`,
                              color: ORCA.red,
                              padding: "2px 6px",
                              borderRadius: 4,
                              display: "inline-block",
                              marginTop: 4,
                              fontWeight: 700,
                              fontFamily: "JetBrains Mono, monospace"
                            }}>{activeDossier.tier}</div>
                          </div>
                        </div>

                        {[
                          { label: "Clearance Status", value: activeDossier.status, color: ORCA.red },
                          { label: "Last Known Location", value: activeDossier.location },
                          { label: "Linked Case Files", value: activeDossier.firs },
                          { label: "Tower Burners Registered", value: activeDossier.contacts },
                          { label: "Linked Fleet Logistics", value: activeDossier.vehicles },
                          { label: "Mule Accounts Logged", value: activeDossier.accounts },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                            <span style={{ color: ORCA.textGray }}>{label}</span>
                            <strong style={{ color: color || ORCA.textDark, fontFamily: "JetBrains Mono, monospace", maxWidth: 200, textAlign: "right" }}>{value}</strong>
                          </div>
                        ))}

                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: ORCA.orange, textTransform: "uppercase", marginBottom: 4 }}>Financial Telemetry Anomaly</div>
                          <p style={{ fontSize: 12, lineHeight: 1.6, color: ORCA.textDark }}>{activeDossier.financialAnomaly}</p>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: ORCA.textGray, textTransform: "uppercase", marginBottom: 4 }}>Operational Case Notes</div>
                          <p style={{ fontSize: 12, lineHeight: 1.6, color: ORCA.textGray }}>{activeDossier.notes}</p>
                        </div>
                      </Panel>
                    </div>
                  </div>
                ) : (
                  /* Geospatial Heatmap Visualizer */
                  <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 480 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <MapGrid />
                    </div>

                    {/* Dossier panel */}
                    <div style={{ width: 350, flexShrink: 0 }}>
                      <Panel header="District Geospatial Dossier" style={{ height: "100%" }} bodyStyle={{ overflowY: "auto" }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: ORCA.navy, textTransform: "uppercase" }}>{activeDistrict.name}</h2>
                        <div style={{ color: ORCA.red, fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 24 }}>{activeDistrict.level}</div>

                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                          <span style={{ color: ORCA.textGray }}>Crime Density Rating</span>
                          <strong style={{ color: ORCA.red }}>{activeDistrict.density}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                          <span style={{ color: ORCA.textGray }}>Total FIRs (Last 30 Days)</span>
                          <strong>{activeDistrict.firs}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                          <span style={{ color: ORCA.textGray }}>Force Grid Coverage</span>
                          <strong style={{ color: ORCA.green }}>{activeDistrict.patrol}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${ORCA.border}`, fontSize: 13 }}>
                          <span style={{ color: ORCA.textGray }}>ISD Special Squads</span>
                          <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>{activeDistrict.squads}</strong>
                        </div>
                        <div style={{ marginTop: 16, background: "rgba(255,153,51,0.08)", border: `1px solid rgba(255,153,51,0.3)`, borderRadius: 4, padding: 12 }}>
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: 11.5, color: "#b45309", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <AlertTriangle style={{ width: 14, height: 14, color: "#b45309" }} /> AI Advisory Dispatch Directive
                          </div>
                          <p style={{ fontSize: 12, lineHeight: 1.6, color: ORCA.textDark }}>{activeDistrict.advisory}</p>
                        </div>
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
              const MOCK_REPORTS = [
                { id: "REP-2026-004", title: "KSP ISD Annual Counter-Terrorism Intelligence Assessment", classification: "SECRET", date: "04 July 2026", size: "2.4 MB", type: "PDF", author: "Internal Security Division" },
                { id: "REP-2026-003", title: "Cyber Syndicate & Darknet Financial Vector Mapping", classification: "SECRET", date: "03 July 2026", size: "1.8 MB", type: "PDF", author: "Cyber Crime Cell, CID" },
                { id: "REP-2026-002", title: "Standardized Standing Order: Mobile Intercept Compliance", classification: "CONFIDENTIAL", date: "02 July 2026", size: "480 KB", type: "PDF", author: "DG & IGP Office" },
                { id: "REP-2026-001", title: "Inter-State Border Patrol Grid Logistics Mapping Data", classification: "RESTRICTED", date: "30 June 2026", size: "14.2 MB", type: "XLSX", author: "Border Security Command" },
                { id: "REP-2026-015", title: "State Intelligence Advisory: High-Profile Convict Escape Risk", classification: "SECRET", date: "28 June 2026", size: "1.1 MB", type: "PDF", author: "Intelligence Department" }
              ];

              const getReportData = (title: string) => {
                switch (title) {
                  case "KSP ISD Annual Counter-Terrorism Intelligence Assessment":
                    return {
                      headers: ["Threat Vector", "Target Profile", "Activity Score", "Countermeasure", "Risk Index"],
                      rows: [
                        ["Border Crossing Vectors", "Level III Alert", "84.2", "Patrol Grid Sync", "HIGH"],
                        ["Encrypted Telegram Cells", "Financial Vectors", "92.1", "Core Decrypt Sweeps", "CRITICAL"],
                        ["UAV Ingress Surveillance", "Air Corridor 2", "44.8", "Ground Radar Lock", "MEDIUM"]
                      ],
                      desc: "Annual internal intelligence brief mapping active insurgent/extremist cells, financial indicators, and regional alert vectors within state jurisdictions."
                    };
                  case "Cyber Syndicate & Darknet Financial Vector Mapping":
                    return {
                      headers: ["Financial Node", "Cryptocurrency Wallet", "Estimated Flow", "Primary IP Source", "Status"],
                      rows: [
                        ["Launder Syndicate 1", "0x9a2f...10ce", "4.2M USD equivalent", "Tor Exit Node 12", "AUDITED"],
                        ["Darknet Host Vectors", "1BitcoinWallet...", "12.8M USD equivalent", "Spoofed ISP range", "INTERCEPTED"],
                        ["Adversary P2P Sync", "0x14ea...b931", "840k USD equivalent", "VPN Loop Bangalore", "FLAGGED"]
                      ],
                      desc: "Cryptology analysis monitoring decentralised escrow flows, coinjoin mixers, and primary IP origins of state extortion networks."
                    };
                  case "Standardized Standing Order: Mobile Intercept Compliance":
                    return {
                      headers: ["Compliance Standard", "Audit Requirement", "Enforcement Agency", "Logs Checked", "Index"],
                      rows: [
                        ["IMEI Registry Verification", "Automated check on connect", "ISD Network Div", "1.4M records", "99.8%"],
                        ["Legal Authorization Sign", "Cryptographic Magistrate Check", "DG-IGP Office", "128 keys", "100.0%"],
                        ["Encrypted Storage Policy", "AES-256 local partitions", "SCRB Audit Unit", "18 nodes", "98.4%"]
                      ],
                      desc: "Standardized protocols regulating lawful interception procedures, audit schedules, and cryptography compliance across telecommunication buffers."
                    };
                  case "Inter-State Border Patrol Grid Logistics Mapping Data":
                    return {
                      headers: ["Border Segment", "Patrol Frequency", "Personnel Count", "Active Vehicles", "UHF Radio Link"],
                      rows: [
                        ["North Sector Border KA-MH", "Hourly sweep", "142 officers", "18 interceptors", "SECURE"],
                        ["East Sector Border KA-AP", "Semi-hourly sweep", "180 officers", "22 interceptors", "SECURE"],
                        ["South Sector Border KA-TN", "Continuous check", "210 officers", "28 interceptors", "STANDBY"]
                      ],
                      desc: "Logistics grid tracking border checkpoint deployments, personnel shifting schedules, and hardware telemetry sync."
                    };
                  case "State Intelligence Advisory: High-Profile Convict Escape Risk":
                  default:
                    return {
                      headers: ["Subject Name", "Alias / Case Ref", "Threat Level", "Last Location Alert", "Advisory Actions"],
                      rows: [
                        ["Vikram 'Slash' Gowda", "SC-40192", "EXTREMELY HIGH", "Belagavi District Border", "Immediate APB"],
                        ["Harish 'Net' Murthy", "SC-98214", "HIGH", "Bengaluru City Core", "Surveillance Sweep"],
                        ["Ananth 'Cipher' Patil", "SC-84192", "MEDIUM", "Mysore Prison Ingress", "Guard Alert"]
                      ],
                      desc: "Statewide alert briefing warden details, suspected transit routes, and emergency containment operations for escaped high-profile inmates."
                    };
                }
              };

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

              const filteredReports = MOCK_REPORTS.filter(r => {
                const matchesSearch = r.title.toLowerCase().includes(bulletinSearch.toLowerCase()) || 
                                      r.author.toLowerCase().includes(bulletinSearch.toLowerCase());
                let matchesFilter = true;
                if (bulletinFilter === "HIGH URGENCY") matchesFilter = r.classification === "SECRET";
                else if (bulletinFilter === "INTELLIGENCE ADV") matchesFilter = r.classification === "CONFIDENTIAL";
                else if (bulletinFilter === "ROUTINE BRIEF") matchesFilter = r.classification === "RESTRICTED";
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

                        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
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
                                  <span>Publisher: <strong>{highlightText(report.author, bulletinSearch)}</strong></span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span>{report.size}</span>
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
                                      [DOWNLOAD {report.type}]
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {filteredReports.length === 0 && (
                            <div style={{ textAlign: "center", padding: "40px 20px", color: ORCA.textMuted, fontSize: 12.5 }}>
                              No official reports match the search parameters.
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
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● SECURE CONNECTION
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Live operational alerts and advisory directives published under credential authority. Click items to inspect guidelines.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
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
                              No security bulletins match the search parameters.
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
                            style={{ background: ORCA.navy, color: "white", border: "none", borderRadius: 4, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                          >
                            Publish Alert
                          </button>
                        </div>
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
                  subtitle="Manage active identity profiles, view secure terminal access records, and verify cryptographic ingress history."
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
                        {officerProfile?.name
                          ? officerProfile.name.split(" ").filter(n => n.length > 0 && /^[a-zA-Z]/.test(n)).map(n => n[0]).join("").substring(0, 3).toUpperCase()
                          : "RKS"
                        }
                      </div>

                      <h3 style={{ fontSize: 16, fontWeight: 800, color: ORCA.navy, margin: 0 }}>
                        {officerProfile?.name || "Command Administrator"}
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
                        {officerProfile?.rank || "Superintendent of Police"}
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${ORCA.border}`, paddingTop: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                          { label: "Clearance Level", value: officerProfile?.clearanceLevel || "None", code: true },
                          { label: "State Audit District", value: officerProfile?.district || "Bengaluru Urban" },
                          { label: "Assigned Unit / Station", value: officerProfile?.station || "Central Command Headquarters" },
                          { label: "Mobile Ingress Phone", value: officerProfile?.mobile || "+91 94808-01001", code: true },
                          { label: "Secure Intranet Email", value: officerProfile?.email || "admin@orca.gov" },
                          { label: "Console Authorization Role", value: officerProfile?.role || "ADMIN", code: true }
                        ].map((item, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12.5 }}>
                            <span style={{ color: ORCA.textMuted, fontWeight: 500 }}>{item.label}</span>
                            <span style={{
                              color: ORCA.navy,
                              fontWeight: 600,
                              textAlign: "right",
                              fontFamily: item.code ? "JetBrains Mono, monospace" : "inherit",
                              fontSize: item.code ? 11.5 : 12.5
                            }}>{item.value}</span>
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
                            {(() => {
                              const start = Number(typeof window !== "undefined" ? sessionStorage.getItem("orca_session_start") || Date.now() : Date.now());
                              const diffSecs = Math.floor((Date.now() - start) / 1000);
                              const h = Math.floor(diffSecs / 3600);
                              const m = Math.floor((diffSecs % 3600) / 60);
                              const s = diffSecs % 60;
                              return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
                            })()}
                          </strong>
                          <span style={{ fontSize: 9.5, color: "#10b981", fontWeight: 700, marginTop: 2, display: "block" }}>● Live Ingress Active</span>
                        </div>

                        {(() => {
                          let localHist: any[] = [];
                          try {
                            localHist = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("orca_session_history") || "[]") : [];
                          } catch (e) {}

                          const totalCount = Math.max(1, localHist.length);
                          const lastCompleted = localHist.find((s: any) => s.status !== "ACTIVE" && s.duration);
                          const lastDuration = lastCompleted?.duration || "First Session";
                          const lastLabel = lastCompleted ? "Logged Session" : "Live Ingress";

                          let totalSeconds = 0;
                          localHist.forEach((s: any) => {
                            if (s.duration && typeof s.duration === "string") {
                              const match = s.duration.match(/(\d+)h\s*(\d+)m/);
                              if (match) {
                                totalSeconds += parseInt(match[1]) * 3600 + parseInt(match[2]) * 60;
                              }
                            }
                          });
                          const totalHrs = (totalSeconds / 3600).toFixed(1);
                          const avgShift = totalCount > 0 ? (totalSeconds / 3600 / totalCount).toFixed(1) : "0.0";

                          return (
                            <>
                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>MONTHLY DUTY LOGGED</span>
                                <strong style={{ fontSize: 14, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {totalHrs} Hrs
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>Avg {avgShift} Hrs / Shift</span>
                              </div>

                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>LAST SESSION DURATION</span>
                                <strong style={{ fontSize: 13, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {lastDuration}
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>{lastLabel}</span>
                              </div>

                              <div style={{ background: "rgba(0,31,63,0.04)", padding: 10, borderRadius: 6, border: `1px solid ${ORCA.border}` }}>
                                <span style={{ fontSize: 10, color: ORCA.textMuted, display: "block", fontWeight: 600 }}>TOTAL LOGIN COUNT</span>
                                <strong style={{ fontSize: 13, color: ORCA.navy, fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: 2 }}>
                                  {totalCount} Ingresses
                                </strong>
                                <span style={{ fontSize: 9.5, color: ORCA.textMuted, display: "block", marginTop: 2 }}>Zero Auth Violations</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ marginTop: 20, padding: 12, background: "rgba(255,153,51,0.05)", border: "1px dashed rgba(255,153,51,0.2)", borderRadius: 6, display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <Fingerprint style={{ width: 20, height: 20, color: "#FF9933", flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: "#b45309", lineHeight: 1.5 }}>
                        <strong>Active Session Cryptographic Key:</strong><br/>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                          ISD_SHA256_CERT_{officerProfile?.uid?.substring(0, 10).toUpperCase() || "DEMO"}_AUDIT
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
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Terminal Ingress Audit Log</h3>
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● SECURE CONNECTION
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Recent login ingress timestamps registered under Badge credentials. Audit logs are legally binding and archived for 90 days.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Login Time (IST)</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Logout / End Time</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Session Duration</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Terminal Node</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Auth Method</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const activeSessionRow = { 
                                  loginTime: (() => {
                                    const startStr = typeof window !== "undefined" ? sessionStorage.getItem("orca_login_time") : null;
                                    const startDate = startStr ? new Date(startStr) : (officerProfile?.lastLogin ? new Date(officerProfile.lastLogin) : new Date());
                                    return startDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';
                                  })(), 
                                  logoutTime: "Active Session Now",
                                  duration: (() => {
                                    const start = Number(typeof window !== "undefined" ? sessionStorage.getItem("orca_session_start") || Date.now() : Date.now());
                                    const diffSecs = Math.floor((Date.now() - start) / 1000);
                                    const h = Math.floor(diffSecs / 3600);
                                    const m = Math.floor((diffSecs % 3600) / 60);
                                    const s = diffSecs % 60;
                                    return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
                                  })(),
                                  ip: "Secure Local Ingress", 
                                  term: `ISD-NODE-${officerProfile?.uid?.substring(0, 6).toUpperCase() || "LIVE"}`, 
                                  method: "Encrypted PKI Handshake", 
                                  active: true 
                                };

                                // Local browser history entries
                                let localHistory: any[] = [];
                                try {
                                  localHistory = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("orca_session_history") || "[]") : [];
                                } catch (e) {}

                                const formattedLocalRows = localHistory.slice(1).map((item: any) => {
                                  const loginDate = new Date(item.loginTime);
                                  const logoutDate = item.logoutTime && item.logoutTime !== "Active Session Now" ? new Date(item.logoutTime) : null;
                                  let cleanMethod = item.method || "Biometric Ingress Token";
                                  if (cleanMethod === "Firebase Token") cleanMethod = "Encrypted PKI Handshake";
                                  return {
                                    loginTime: !isNaN(loginDate.getTime()) ? loginDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST' : "Recorded Ingress",
                                    logoutTime: logoutDate && !isNaN(logoutDate.getTime()) ? logoutDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST' : item.logoutTime,
                                    duration: item.duration || "Recorded",
                                    term: item.term || `ISD-NODE-${officerProfile?.uid?.substring(0, 6).toUpperCase() || "T402"}`,
                                    method: cleanMethod,
                                    status: item.status,
                                    reason: item.reason,
                                    active: false
                                  };
                                });

                                const historicalRows = liveSessionLogs
                                  .filter((log: any) => log.status !== "ACTIVE")
                                  .map((log: any) => {
                                    const rawLogin = log.loginTime || (log.timestamp && log.timestamp.toDate ? log.timestamp.toDate() : log.timestamp);
                                    const loginDate = rawLogin ? new Date(rawLogin) : null;
                                    const formattedLogin = (loginDate && !isNaN(loginDate.getTime())) 
                                      ? loginDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST'
                                      : "Recorded Session";

                                    const rawLogout = log.logoutTime;
                                    const logoutDate = rawLogout ? new Date(rawLogout) : null;
                                    const formattedLogout = (logoutDate && !isNaN(logoutDate.getTime()))
                                      ? logoutDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST'
                                      : (log.status || "Session Ended");

                                    const nodeStr = log.uid ? `ISD-NODE-${log.uid.substring(0,6).toUpperCase()}` : (log.targetUid ? `ISD-NODE-${log.targetUid.substring(0,6).toUpperCase()}` : "KSP-ISD-LIVE");

                                    let cleanMethod = "Biometric Ingress Token";
                                    if (log.action === "USER_LOGIN_SUCCESS" || log.action?.includes("LOGIN")) cleanMethod = "Encrypted PKI Handshake";
                                    else if (log.action === "USER_LOGOUT") cleanMethod = "Officer Badge Logout";
                                    else if (log.action === "VPN_FORCED_LOCKDOWN") cleanMethod = "Security Guard Disconnect";
                                    else if (log.changedBy) cleanMethod = `Officer ${log.changedBy}`;

                                    let statusVal = log.status || log.newRole;
                                    let reasonVal = log.reason;
                                    if (log.action === "VPN_FORCED_LOCKDOWN" || log.status === "VPN_FORCED_LOCKDOWN" || log.status === "VPN_LOCKDOWN_FORCED") {
                                      statusVal = "VPN_LOCKDOWN_FORCED";
                                      reasonVal = "VPN_LOCKDOWN";
                                    }

                                    return {
                                      loginTime: formattedLogin,
                                      logoutTime: formattedLogout,
                                      duration: log.duration || "Recorded",
                                      term: nodeStr,
                                      method: cleanMethod,
                                      status: statusVal,
                                      reason: reasonVal,
                                      active: false
                                    };
                                  });

                                const allRowsRaw = [activeSessionRow, ...formattedLocalRows, ...historicalRows];
                                const seenMap = new Map<string, any>();

                                allRowsRaw.forEach(row => {
                                  const key = row.loginTime;
                                  if (!seenMap.has(key)) {
                                    seenMap.set(key, row);
                                  } else {
                                    const existing = seenMap.get(key);
                                    if (existing.duration === "Recorded" && row.duration !== "Recorded") {
                                      seenMap.set(key, row);
                                    }
                                  }
                                });

                                const allRows = Array.from(seenMap.values());

                                return allRows.map((log, idx) => (
                                  <tr key={idx} style={{ borderBottom: `1px solid ${ORCA.border}`, background: log.active ? "rgba(16,185,129,0.03)" : "transparent" }}>
                                    <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: log.active ? 700 : 500 }}>
                                      {log.loginTime}
                                    </td>
                                    <td style={{ padding: "10px 12px", color: log.active ? "#10b981" : ORCA.textGray, fontWeight: log.active ? 700 : 400, fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>
                                      {log.logoutTime}
                                    </td>
                                    <td style={{ padding: "10px 12px", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: log.active ? "#10b981" : ORCA.navy, fontWeight: 700 }}>
                                      {log.duration}
                                    </td>
                                    <td style={{ padding: "10px 12px", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: ORCA.textMuted }}>{log.term}</td>
                                    <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{log.method}</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                                      {(() => {
                                        if (log.active) {
                                          return (
                                            <span style={{ 
                                              color: "#10b981", 
                                              fontWeight: 700, 
                                              fontSize: 10, 
                                              background: "rgba(16,185,129,0.15)", 
                                              padding: "4px 8px", 
                                              borderRadius: 4, 
                                              fontFamily: "JetBrains Mono, monospace",
                                              border: "1px solid rgba(16,185,129,0.3)",
                                              display: "inline-block"
                                            }}>
                                              ● ACTIVE NOW
                                            </span>
                                          );
                                        }
                                        if (log.status === "VPN_LOCKDOWN_FORCED" || log.reason === "VPN_LOCKDOWN" || (log.method && String(log.method).includes("VPN"))) {
                                          return (
                                            <span style={{ 
                                              color: "#dc2626", 
                                              fontWeight: 800, 
                                              fontSize: 10, 
                                              background: "rgba(220,38,38,0.12)", 
                                              padding: "4px 8px", 
                                              borderRadius: 4, 
                                              fontFamily: "JetBrains Mono, monospace",
                                              border: "1px solid rgba(220,38,38,0.3)",
                                              display: "inline-block"
                                            }}>
                                              🔴 VPN LOCKDOWN FORCED
                                            </span>
                                          );
                                        }
                                        return (
                                          <span style={{ 
                                            color: "#64748b", 
                                            fontWeight: 700, 
                                            fontSize: 10, 
                                            background: "#f1f5f9", 
                                            padding: "4px 8px", 
                                            borderRadius: 4, 
                                            fontFamily: "JetBrains Mono, monospace",
                                            border: "1px solid #cbd5e1",
                                            display: "inline-block"
                                          }}>
                                            ⚪ NORMAL LOGOUT
                                          </span>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab content 2: File Downloads */}
                    {profileTab === "downloads" && (
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, animation: "fadeIn 0.2s ease" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Cryptographic File Exports</h3>
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
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Cryptographic Hash</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { time: "Today, 22:46:11", name: "ORCA_Briefing_Generate_a_structured_police_intelligence", ext: "PDF", size: "142 KB", hash: "4f8a...92b3" },
                                { time: "Yesterday, 16:15:30", name: "ISD_Case_Audit_FIR_2026_BLR_104", ext: "PDF", size: "85 KB", hash: "8e1b...f120" },
                                { time: "02 July, 14:10:45", name: "O.R.C.A_Network_Map_Ingress_Matrix", ext: "PNG", size: "1.4 MB", hash: "2c4d...e32a" },
                                { time: "30 June, 10:05:12", name: "Criminal_Profile_Dossier_Sandeep_B", ext: "PDF", size: "210 KB", hash: "9f12...b998" }
                              ].map((file, idx) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                  <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 500 }}>{file.time}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textGray, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>{file.name}</td>
                                  <td style={{ padding: "10px 12px" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                                      {file.ext}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textMuted }}>{file.size}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: ORCA.orange }}>{file.hash}</td>
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
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>AI Copilot Transaction Ledger</h3>
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
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Tokens</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Audit Node</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { time: "Today, 22:45:00", cat: "Forensic Audit", focus: "FIR/2026/BLR/104 operational facts", tokens: "320 tkn", node: "KSP-ISD-T402" },
                                { time: "Today, 22:42:15", cat: "Chatbot Inquiry", focus: "Retrieve matching suspects for FIR", tokens: "185 tkn", node: "KSP-ISD-T402" },
                                { time: "Yesterday, 09:30:10", cat: "Network Mapping", focus: "Cross-reference suspect syndicate ties", tokens: "512 tkn", node: "KSP-ISD-T402" },
                                { time: "02 July, 14:05:00", cat: "Verification Audit", focus: "Officer Register validation ID 772", tokens: "90 tkn", node: "KSP-CHQ-T801" }
                              ].map((query, idx) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                  <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 500 }}>{query.time}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{query.cat}</td>
                                  <td style={{ padding: "10px 12px", fontStyle: "italic" }}>"{query.focus}"</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textMuted }}>{query.tokens}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>{query.node}</td>
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
                          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: ORCA.navy, margin: 0 }}>Device Ingress Oversight</h3>
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 700, background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace" }}>
                            ● 2 SECURE ENDPOINTS
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                          Active web browsers and terminal configurations authenticated under this officer profile. Revoke standby sessions if suspicious.
                        </p>
                        <div style={{ overflowX: "auto", flex: 1 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: `2px solid ${ORCA.border}`, color: ORCA.textMuted }}>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Terminal ID</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Connection Scope</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Last Location</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600 }}>Authentication Scope</th>
                                <th style={{ padding: "8px 12px", fontWeight: 600, textAlign: "right" }}>Revocation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { term: "KSP-ISD-T402", active: true, net: "Intranet Loop", loc: "Central ISD Command", auth: "Biometric Ingress (Current)" },
                                { term: "KSP-MOB-LINK", active: false, net: "Secure VPN", loc: "Bengaluru Urban Area", auth: "Ingress Standby (RFID/OTP)" }
                              ].map((device, idx) => (
                                <tr key={idx} style={{ borderBottom: `1px solid ${ORCA.border}` }}>
                                  <td style={{ padding: "10px 12px", color: ORCA.navy, fontWeight: 700, fontFamily: "JetBrains Mono" }}>{device.term}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textGray }}>{device.net}</td>
                                  <td style={{ padding: "10px 12px", color: ORCA.textMuted }}>{device.loc}</td>
                                  <td style={{ padding: "10px 12px" }}>
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: device.active ? "#10b981" : "#f59e0b" }}>
                                      {device.auth}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                    {device.active ? (
                                      <span style={{ fontSize: 10, color: ORCA.textMuted, fontStyle: "italic" }}>Protected</span>
                                    ) : (
                                      <button
                                        onClick={() => alert(`Standby connection scope revoked for terminal node [${device.term}]. Security signal dispatched.`)}
                                        style={{
                                          background: "#ef4444",
                                          color: "white",
                                          border: "none",
                                          borderRadius: 4,
                                          padding: "4px 8px",
                                          fontSize: 10,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          transition: "background 0.2s"
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#dc2626"}
                                        onMouseLeave={e => e.currentTarget.style.background = "#ef4444"}
                                      >
                                        REVOKE
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
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

        {/* Hidden layout trigger */}
        <span id="fir-tab-trigger" style={{ display: "none" }} onClick={() => setActiveTab("fir")} />
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
              <div><strong>Ingress Node:</strong> <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11.5 }}>KSP-ISD-T402</span></div>
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
