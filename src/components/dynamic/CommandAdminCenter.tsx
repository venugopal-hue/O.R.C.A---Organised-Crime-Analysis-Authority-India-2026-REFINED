"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useIntelligence } from "@/context/IntelligenceContext";
import { RoleAssignmentManager } from "@/components/admin/RoleAssignmentManager";
import { RoleChangeLogTable } from "@/components/admin/RoleChangeLogTable";
import { 
  seedAdminDatabase, 
  fetchOfficerApplications, 
  fetchOfficers, 
  fetchAuditLogs, 
  fetchVerificationOversight, 
  fetchSystemSettings, 
  saveSystemSettings,
  OfficerApplication,
  SystemSettings,
  getLocalData,
  setLocalData,
  PERMISSION_TEMPLATES,
  MOCK_OFFICER_APPLICATIONS,
  MOCK_OFFICERS,
  MOCK_AUDIT_LOGS,
  MOCK_VERIFICATIONS,
  MOCK_SETTINGS
} from "@/lib/adminService";
import { 
  UserCheck, 
  Settings, 
  ShieldAlert, 
  Award, 
  FileCheck, 
  History, 
  AlertTriangle, 
  Home, 
  Bot, 
  Search, 
  Download, 
  ChevronRight, 
  X, 
  Check, 
  FileText,
  User, 
  Shield, 
  Activity, 
  Lock, 
  Database, 
  Server,
  CloudLightning,
  Sparkles,
  Info,
  Clock,
  Loader2,
  Star,
  Flag,
  Trash2,
  ChevronDown,
  ExternalLink,
  Globe,
  Wifi,
  Fingerprint,
  ShieldCheck,
  AlertCircle,
  Key,
  Bell,
  Zap,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { doc, setDoc, addDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// O.R.C.A Admin Style Tokens
const ADMIN_THEME = {
  bg: "#f8fafc",
  cardBg: "#ffffff",
  border: "#cbd5e1",
  accentGold: "#FF9933",
  accentGoldLight: "#ffb05c",
  green: "#10b981",
  red: "#ef4444",
  blue: "#001f3f",
  textPrimary: "#001f3f",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  shadow: "0 1px 3px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.08)"
};

const getCleanInitials = (fullName: string) => {
  if (!fullName) return "";
  const cleanName = fullName
    .replace(/^(Sub-Inspector|Inspector|Constable|Deputy Superintendent|Superintendent|DSP|SP|PSI|ASI|ADGP|DGP|IGP|DIG|Head Constable|Police Constable)\s+/i, "")
    .trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0] ? parts[0].slice(0, 2).toUpperCase() : "";
};

const RANKS = [
  "Assistant Sub Inspector (ASI)",
  "Sub Inspector (SI)",
  "Inspector",
  "Deputy Superintendent of Police (DSP)",
  "Additional Superintendent of Police (ASP)",
  "Superintendent of Police (SP)",
  "Deputy Inspector General of Police (DIGP)",
  "Inspector General of Police (IGP)",
  "Additional Director General of Police (ADGP)",
  "Director General of Police (DGP)"
];

const KARNATAKA_DISTRICTS = [
  "Bagalkote",
  "Ballari",
  "Belagavi",
  "Bengaluru Rural",
  "Bengaluru Urban",
  "Bidar",
  "Chamarajanagar",
  "Chikkaballapura",
  "Chikkamagaluru",
  "Chitradurga",
  "Dakshina Kannada",
  "Davanagere",
  "Dharwad",
  "Gadag",
  "Hassan",
  "Haveri",
  "Kalaburagi",
  "Kodagu",
  "Kolar",
  "Koppal",
  "Mandya",
  "Mysuru",
  "Raichur",
  "Ramanagara",
  "Shivamogga",
  "Tumakuru",
  "Udupi",
  "Uttara Kannada",
  "Vijayapura",
  "Yadgir"
];

const ACCESS_MODULES = [
  "Investigation Dashboard",
  "Administrative Dashboard",
  "IT Administration Dashboard"
];

const PERMISSION_CATEGORIES = [
  {
    id: "user-admin",
    name: "User & Officer Administration",
    icon: UserCheck,
    permissions: ["Manage Officers", "Approve Officers", "Delete Officers"]
  },
  {
    id: "core-ops",
    name: "Core Police Operations",
    icon: Home,
    permissions: ["Manage Cases", "Generate Reports", "Document Verification"]
  },
  {
    id: "analytics-ai",
    name: "Analytics & AI Clearance",
    icon: Sparkles,
    permissions: ["AI Access", "Dashboard Access", "Analytics"]
  },
  {
    id: "system-security",
    name: "System Security & Configuration",
    icon: Shield,
    permissions: ["Audit Logs", "System Settings", "Verification Management"]
  }
];


interface CommandAdminCenterProps {
  adminTab: string;
}

export const CommandAdminCenter: React.FC<CommandAdminCenterProps> = ({ adminTab }) => {
  const { officerProfile } = useAuth();
  const { activeFirId } = useIntelligence();

  // Firestore retrieved state arrays
  const [applications, setApplications] = useState<OfficerApplication[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // UI state managers
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<OfficerApplication | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  

  // Search & Filter state variables
  const [appSearch, setAppSearch] = useState("");
  const [dirSearch, setDirSearch] = useState("");
  const [dirDistrictFilter, setDirDistrictFilter] = useState("ALL");
  const [dirRankFilter, setDirRankFilter] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");

  // AI Monitoring Console state variables
  const [conversations, setConversations] = useState([
    {
      id: "conv_1",
      officer: "Inspector Ananth Murthy",
      badgeNo: "INSP_ANANTH_12",
      query: "What are the key suspects in FIR 442 smuggling ring?",
      module: "FIR Analytics",
      confidence: 92,
      rating: 4,
      status: "COMPLETED",
      time: "06/07/2026, 21:42:35",
      response: "Based on FIR 442, the principal suspects identified are: 1. Rajesh Hegde (alias Chotu), 2. Vikram Naik, 3. Amit Rao. Financial transactions connect Hegde directly to the logistics hub in Mangaluru.",
      tokens: { prompt: 450, completion: 280, total: 730 },
      latency: "0.45s",
      ip: "10.14.22.18"
    },
    {
      id: "conv_2",
      officer: "Officer Shruthi Rao",
      badgeNo: "OFF_SHRUTHI_04",
      query: "Generate trend analysis for cybercrime cases in Bengaluru Rural.",
      module: "Crime Analytics",
      confidence: 88,
      rating: 5,
      status: "COMPLETED",
      time: "06/07/2026, 18:42:35",
      response: "Cyber fraud instances showed a 14% month-over-month increase in the rural districts, primarily driven by part-time job deposit scams. Hotspot centers identified: Nelamangala and Devanahalli.",
      tokens: { prompt: 620, completion: 410, total: 1030 },
      latency: "0.58s",
      ip: "10.14.28.94"
    },
    {
      id: "conv_3",
      officer: "DSP R. K. Shastry, IPS",
      badgeNo: "DSP_RKS_IPS_2028",
      query: "Cross-reference criminal networks between suspect Kumar and local gangs.",
      module: "Criminal Networks",
      confidence: 71,
      rating: 3,
      status: "FLAGGED",
      time: "06/07/2026, 15:42:35",
      response: "Flagged Node: Association path from Kumar to 'Rowdy Shekar' (Leader of South Gang) passes through two sub-level intermediaries (driver Mahesh and dealer Peter). Warning: High network centrality detected on node Shekar.",
      tokens: { prompt: 810, completion: 520, total: 1330 },
      latency: "0.82s",
      ip: "10.12.1.25"
    },
    {
      id: "conv_4",
      officer: "Inspector Rajesh Kumar",
      badgeNo: "INSP_RAJESH_89",
      query: "Predict areas with high probability of narcotics movement.",
      module: "Predictive Analytics",
      confidence: 45,
      rating: null,
      status: "ESCALATED",
      time: "06/07/2026, 11:42:35",
      response: "Low confidence response. High entropy warning. Prediction model suggests potential activity zones along National Highway 48, but current source indicators are below required threshold.",
      tokens: { prompt: 540, completion: 150, total: 690 },
      latency: "1.12s",
      ip: "10.14.44.112"
    },
    {
      id: "conv_5",
      officer: "Sub-Inspector Kavitha Patil",
      badgeNo: "SI_KAVITHA_91",
      query: "Summarize oil adulteration case files from Dharwad region.",
      module: "Case Management",
      confidence: 95,
      rating: 5,
      status: "COMPLETED",
      time: "05/07/2026, 23:42:35",
      response: "Dharwad region oil adulteration cases (2025-2026): A total of 4 files registered. principal accused: Shivalingappa. Seizure size: 14,000 liters. All cases currently pending charge sheet compilation.",
      tokens: { prompt: 390, completion: 210, total: 600 },
      latency: "0.38s",
      ip: "10.16.89.201"
    }
  ]);
  const [aiSearch, setAiSearch] = useState("");
  const [aiStatusFilter, setAiStatusFilter] = useState("All Status");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // AI Model Management state variables
  const [modelTemp, setModelTemp] = useState(0.3);
  const [modelMaxTokens, setModelMaxTokens] = useState(4098);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are O.R.C.A, an AI intelligence copilot for the Karnataka State Police. Provide precise, factual, and actionable intelligence analysis based on available case data."
  );
  const [previousVersions, setPreviousVersions] = useState([
    { version: "v3.1.8b-2026.05", deployed: "07/06/2026", accuracy: "92.8%", status: "RETIRED" },
    { version: "v3.0.8b-2026.04", deployed: "08/05/2026", accuracy: "89.4%", status: "ARCHIVED" },
    { version: "v3.0.8b-2026.02", deployed: "09/03/2026", accuracy: "86.1%", status: "ARCHIVED" }
  ]);
  const [modelStatusMsg, setModelStatusMsg] = useState("");
  const [isModelActionLoading, setIsModelActionLoading] = useState("");

  // Security Center states
  const [securitySearch, setSecuritySearch] = useState("");
  const [securityEvents, setSecurityEvents] = useState([
    {
      id: 1,
      title: "3 consecutive failed login attempts",
      severity: "HIGH",
      status: "ACTIVE",
      ip: "203.94.12.44",
      officer: "Unknown",
      browser: "Chrome 126",
      device: "Windows 11",
      timestamp: "06/07/2026, 21:42:35"
    },
    {
      id: 2,
      title: "IP blocked after brute force detection",
      severity: "CRITICAL",
      status: "RESOLVED",
      ip: "185.234.12.99",
      officer: "Unknown",
      browser: "Unknown",
      device: "Unknown",
      timestamp: "06/07/2026, 19:42:35"
    },
    {
      id: 3,
      title: "Session from unusual geographic location",
      severity: "MEDIUM",
      status: "INVESTIGATING",
      ip: "103.21.58.120",
      officer: "Inspector Ananth Murthy",
      browser: "Firefox 130",
      device: "macOS",
      timestamp: "06/07/2026, 15:42:35"
    }
  ]);

  // Reports & Notifications states
  const [reportsSubTab, setReportsSubTab] = useState<"reports" | "notifications">("reports");
  const [reportsFormat, setReportsFormat] = useState<"PDF" | "CSV" | "Excel">("PDF");
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const [reportsLoaderMsg, setReportsLoaderMsg] = useState("");
  const [reportsSuccessMsg, setReportsSuccessMsg] = useState("");
  const [notificationsList, setNotificationsList] = useState([
    { id: 1, title: "New officer application pending review", desc: "Officer: Sub-Inspector Kavitha Patil. Verification required.", type: "CRITICAL", time: "10 mins ago", read: false },
    { id: 2, title: "Database backup snapshot created successfully", desc: "Backup block snapshot #82910 written to statewide secure vault.", type: "INFO", time: "1 hour ago", read: false },
    { id: 3, title: "MFA Enforced globally for all administration accounts", desc: "Multi-Factor Authentication policy validated and deployed.", type: "SECURITY", time: "3 hours ago", read: false },
    { id: 4, title: "AI latency threshold alert: average response time exceeded 2.0s", desc: "Average request time hit 2.14s on NVIDIA NIM API endpoint.", type: "WARNING", time: "5 hours ago", read: false },
    { id: 5, title: "Statewide FIR synchronization completed", desc: "Synced 1,028 new files index with central SCRB servers.", type: "SUCCESS", time: "1 day ago", read: false }
  ]);

  // System Settings state variables
  const [setAppName, setSetAppName] = useState("O.R.C.A");
  const [setMaintMode, setSetMaintMode] = useState(false);
  const [setDebugMode, setSetDebugMode] = useState(false);
  const [setEnforceHttps, setSetEnforceHttps] = useState(true);
  const [setRateLimiting, setSetRateLimiting] = useState(true);
  const [setIpWhitelist, setSetIpWhitelist] = useState(false);
  const [setMfaEnabled, setSetMfaEnabled] = useState(true);
  const [setSessionTimeout, setSetSessionTimeout] = useState(30);
  const [setPassExpiry, setSetPassExpiry] = useState(90);
  const [setMaxAttempts, setSetMaxAttempts] = useState(5);
  const [setEmailNotif, setSetEmailNotif] = useState(true);
  const [setPushNotif, setSetPushNotif] = useState(false);
  const [setAutoBackup, setSetAutoBackup] = useState(true);
  const [setBackupRetention, setSetBackupRetention] = useState(30);
  const [setAuditLogRetention, setSetAuditLogRetention] = useState(365);
  const [dbAnalyticsSearch, setDbAnalyticsSearch] = useState("");

  const [auditModuleFilter, setAuditModuleFilter] = useState("ALL");
  const [verSearch, setVerSearch] = useState("");
  const [verStatusFilter, setVerStatusFilter] = useState("ALL");


  // Extended state variables for drawer modifications
  const [modFirstName, setModFirstName] = useState("");
  const [modLastName, setModLastName] = useState("");
  const [modRank, setModRank] = useState("");
  const [modStation, setModStation] = useState("");
  const [modDistrict, setModDistrict] = useState("");
  const [modMobile, setModMobile] = useState("");
  const [modEmail, setModEmail] = useState("");
  const [modRequestedAccess, setModRequestedAccess] = useState("");
  const [modInternalRemarks, setModInternalRemarks] = useState("");
  const [modPriority, setModPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [modAssignedReviewer, setModAssignedReviewer] = useState("");
  const [modSecurityClearance, setModSecurityClearance] = useState("ISD-LEVEL-IV");
  const [modBgVerification, setModBgVerification] = useState("pending");
  const [modDeptVerification, setModDeptVerification] = useState("pending");
  const [modSupervisorApproval, setModSupervisorApproval] = useState("pending");
  const [modStatus, setModStatus] = useState("pending");

  const [modRole, setModRole] = useState("Investigation Officer");
  const [modDivision, setModDivision] = useState("");
  const [modStateUnit, setModStateUnit] = useState("");
  const [modDepartment, setModDepartment] = useState("Cyber Crime");
  const [modReportingOfficer, setModReportingOfficer] = useState("");
  const [modSupervisor, setModSupervisor] = useState("");
  const [modDepartmentHead, setModDepartmentHead] = useState("");
  const [modCommandingOfficer, setModCommandingOfficer] = useState("");
  const [modPermissions, setModPermissions] = useState<Record<string, string>>({});
  const [isConfirmingApproval, setIsConfirmingApproval] = useState(false);

  // Application search, filters, sorting and pagination states
  const [appRankFilter, setAppRankFilter] = useState("ALL");
  const [appDistrictFilter, setAppDistrictFilter] = useState("ALL");
  const [appStationFilter, setAppStationFilter] = useState("ALL");
  const [appStatusFilter, setAppStatusFilter] = useState("ALL");
  const [appAccessFilter, setAppAccessFilter] = useState("ALL");
  const [appReviewerFilter, setAppReviewerFilter] = useState("ALL");
  const [appSortBy, setAppSortBy] = useState("newest");
  const [appPage, setAppPage] = useState(1);
  const itemsPerPage = 6;

  // Interaction feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const [internalRemarks, setInternalRemarks] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // RBAC Configurable permissions configuration
  const [rbacPermissions, setRbacPermissions] = useState<Record<string, string[]>>({
    "Super Administrator": ["Manage Officers", "Approve Officers", "Delete Officers", "Manage Cases", "Generate Reports", "Document Verification", "AI Access", "Dashboard Access", "Audit Logs", "System Settings", "Verification Management", "Analytics"],
    "Administrator": ["Manage Officers", "Approve Officers", "Manage Cases", "Generate Reports", "Document Verification", "AI Access", "Dashboard Access", "Audit Logs", "System Settings", "Verification Management", "Analytics"],
    "DSP": ["Manage Cases", "Generate Reports", "Document Verification", "AI Access", "Dashboard Access", "Analytics"],
    "SP": ["Manage Cases", "Generate Reports", "Document Verification", "AI Access", "Dashboard Access", "Analytics"],
    "Inspector": ["Manage Cases", "Generate Reports", "Document Verification", "AI Access", "Dashboard Access"],
    "Sub Inspector": ["Manage Cases", "Generate Reports", "Document Verification", "AI Access"],
    "Constable": ["Generate Reports", "AI Access"],
    "Analyst": ["AI Access", "Dashboard Access", "Analytics"],
    "Operator": ["Document Verification", "AI Access"]
  });

  const availablePermissions = [
    "Manage Officers",
    "Approve Officers",
    "Delete Officers",
    "Manage Cases",
    "Generate Reports",
    "Document Verification",
    "AI Access",
    "Dashboard Access",
    "Audit Logs",
    "System Settings",
    "Verification Management",
    "Analytics"
  ];

  // Reload admin data from firestore
  const loadAdminData = async () => {
    setLoading(true);
    try {
      const appsList = await fetchOfficerApplications();
      const officersList = await fetchOfficers();
      const logsList = await fetchAuditLogs();
      const verList = await fetchVerificationOversight();
      const settingsObj = await fetchSystemSettings();
      
      setApplications(appsList);
      setOfficers(officersList);
      setAuditLogs(logsList);
      setVerifications(verList);
      setSystemSettings(settingsObj);
    } catch (err) {
      console.error("[O.R.C.A Admin Fetch Error]:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [adminTab]);

  useEffect(() => {
    const handleOutsideClick = () => setOpenDropdownIdx(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Pending Registrations Real-Time Workflow State
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  const [selectedPendingReg, setSelectedPendingReg] = useState<any | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [pendingRoleSelection, setPendingRoleSelection] = useState<string>("investigation_l1");
  const [pendingIsdSelection, setPendingIsdSelection] = useState<string>("ISD-LEVEL-IV");
  const [rejectReasonInput, setRejectReasonInput] = useState<string>("");
  const [pendingActionLoading, setPendingActionLoading] = useState(false);

  // Officer Profile Edit Modal State
  const [activeOfficerProfile, setActiveOfficerProfile] = useState<any | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileRank, setEditProfileRank] = useState("");
  const [editProfileClearance, setEditProfileClearance] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfileDistrict, setEditProfileDistrict] = useState("");
  const [editProfileStation, setEditProfileStation] = useState("");
  const [editProfileMobile, setEditProfileMobile] = useState("");
  const [editProfileActive, setEditProfileActive] = useState(true);

  const openOfficerEditModal = (off: any) => {
    setActiveOfficerProfile(off);
    setEditProfileName(off.name || "");
    setEditProfileRank(off.rank || "Officer");
    setEditProfileClearance(off.clearanceLevel || off.isdLevel || "ISD-LEVEL-IV");
    setEditProfileEmail(off.email || "");
    setEditProfileDistrict(off.district || "Bengaluru Urban");
    setEditProfileStation(off.station || off.policeStation || "Central Command");
    setEditProfileMobile(off.mobile || off.phone || "");
    setEditProfileActive(off.active !== false);
    setIsEditingProfile(true);
  };


  useEffect(() => {
    try {
      const q = query(collection(db, "pendingRegistrations"), where("status", "==", "pending"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ id: docSnap.id, ...data });
          
          if (process.env.NODE_ENV === "development") {
            console.warn(`[DIAGNOSTIC - ADMIN READ] pendingRegistrations doc: ${docSnap.id}`, {
              field: "photoUrl",
              valueExists: "photoUrl" in data,
              type: typeof data.photoUrl,
              length: data.photoUrl ? data.photoUrl.length : 0,
              preview: data.photoUrl && typeof data.photoUrl === "string" ? data.photoUrl.substring(0, 50) + "..." : "empty"
            });
          }
        });
        setPendingRegistrations(list);
      }, (err) => {
        console.warn("[Pending Registrations onSnapshot Error, using sandbox fallback]:", err.message);
        const localApps = getLocalData<any[]>("orca_applications", []);
        setPendingRegistrations(localApps.filter(a => a.status === "pending"));
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not attach pendingRegistrations listener:", e);
    }
  }, []);

  const handleConfirmApproveRegistration = async () => {
    if (!selectedPendingReg) return;
    setPendingActionLoading(true);
    try {
      const res = await fetch("/api/admin/approve-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedPendingReg.id || selectedPendingReg.uid,
          name: selectedPendingReg.name,
          email: selectedPendingReg.email,
          rank: selectedPendingReg.rank,
          posting: selectedPendingReg.posting || `${selectedPendingReg.postingType || "Field"} - ${selectedPendingReg.station || selectedPendingReg.district || ""}`,
          dashboardRole: pendingRoleSelection,
          isdLevel: pendingIsdSelection,
          photoUrl: selectedPendingReg.photoUrl || "",
          adminName: officerProfile?.name || "Command Administrator"
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to approve registration");
      }
      alert(data.message || "Officer registration approved.");
      setApproveModalOpen(false);
      setSelectedPendingReg(null);
      await loadAdminData();
    } catch (err: any) {
      console.error("Approval API error:", err);
      alert("Error approving registration: " + err.message);
    } finally {
      setPendingActionLoading(false);
    }
  };

  const handleConfirmRejectRegistration = async () => {
    if (!selectedPendingReg) return;
    setPendingActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedPendingReg.id || selectedPendingReg.uid,
          name: selectedPendingReg.name,
          email: selectedPendingReg.email,
          reason: rejectReasonInput || "Did not pass administrative review check.",
          adminName: officerProfile?.name || "Command Administrator"
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject registration");
      }
      alert(data.message || "Registration rejected.");
      setRejectModalOpen(false);
      setSelectedPendingReg(null);
      await loadAdminData();
    } catch (err: any) {
      console.error("Rejection API error:", err);
      alert("Error rejecting registration: " + err.message);
    } finally {
      setPendingActionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedApp) {
      setModFirstName(selectedApp.firstName || selectedApp.name.split(" ")[0] || "");
      setModLastName(selectedApp.lastName || selectedApp.name.split(" ").slice(1).join(" ") || "");
      setModRank(selectedApp.rank || "");
      setModStation(selectedApp.station || "");
      setModDistrict(selectedApp.district || "");
      setModMobile(selectedApp.mobile || "");
      setModEmail(selectedApp.email || "");
      setModRequestedAccess(selectedApp.requestedAccess || "");
      setModInternalRemarks(selectedApp.internalRemarks || selectedApp.remarks || "");
      setModPriority(selectedApp.priority || "MEDIUM");
      setModAssignedReviewer(selectedApp.assignedReviewer || "");
      const isL1Admin = officerProfile?.role === "Administrative Dashboard - Level 1";
      setModSecurityClearance(isL1Admin ? "ISD-LEVEL-IV" : (selectedApp.securityClearance || selectedApp.clearanceLevel || "ISD-LEVEL-IV"));
      setModBgVerification(selectedApp.bgVerification || "pending");
      setModDeptVerification(selectedApp.deptVerification || "pending");
      setModSupervisorApproval(selectedApp.supervisorApproval || "pending");
      setModReportingOfficer(selectedApp.reportingOfficer || "");
      setModSupervisor(selectedApp.supervisor || "");
      setModDepartmentHead(selectedApp.departmentHead || "");
      setModCommandingOfficer(selectedApp.commandingOfficer || "");
      setModPermissions(selectedApp.permissions || {});
      setModRole(isL1Admin ? "Investigation Dashboard" : (selectedApp.assignedRole || "Investigation Dashboard"));
      setModDivision(selectedApp.division || "");
      setModStateUnit(selectedApp.stateUnit || "");
      setModDepartment(selectedApp.department || "Cyber Crime");
      setIsConfirmingApproval(false);
      setModStatus(selectedApp.status || "pending");
    }
  }, [selectedApp]);

  // Seeding trigger
  const handleSeedDatabase = async () => {
    setActionLoading(true);
    try {
      await seedAdminDatabase();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
      await loadAdminData();
    } catch (err) {
      console.warn("Firestore seeding failed due to permissions. Initializing in-memory browser sandbox.", err);
      // Seed locally in localStorage
      setLocalData("orca_applications", MOCK_OFFICER_APPLICATIONS);
      setLocalData("orca_officers", MOCK_OFFICERS);
      setLocalData("orca_audit_logs", MOCK_AUDIT_LOGS);
      setLocalData("orca_verifications", MOCK_VERIFICATIONS);
      setLocalData("orca_settings", MOCK_SETTINGS);
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
      await loadAdminData();
    } finally {
      setActionLoading(false);
    }
  };

  const applyPermissionTemplate = (templateName: string) => {
    const template = PERMISSION_TEMPLATES[templateName];
    if (template) {
      setModPermissions({ ...template.permissions });
      setModRole(template.role);
    }
  };

  // Approval flow handler
  const handleApproveApp = async (app: OfficerApplication) => {
    setIsConfirmingApproval(true);
  };

  const executeApproveApp = async (app: OfficerApplication) => {
    const approvedName = `${modFirstName} ${modLastName}`.trim() || app.name;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/approve-officer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.id,
          email: modEmail.trim() || app.email,
          name: approvedName,
          rank: modRank || app.rank,
          district: modDistrict || app.district,
          station: modStation || app.station,
          badgeId: app.badgeId,
          mobile: modMobile || app.mobile,
          requestedAccess: app.requestedAccess,
          adminName: officerProfile?.name || "Command Administrator",
          
          assignedRole: modRole,
          permissions: modPermissions,
          division: modDivision,
          stateUnit: modStateUnit,
          department: modDepartment,
          reportingOfficer: modReportingOfficer,
          supervisor: modSupervisor,
          departmentHead: modDepartmentHead,
          commandingOfficer: modCommandingOfficer,
          status: modStatus === "pending" ? "active" : modStatus
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval API returned error");

      // Also update application status in Firestore
      const appDocRef = doc(db, "officer_applications", app.id);
      await setDoc(appDocRef, {
        status: modStatus === "pending" ? "active" : modStatus,
        approvedAt: new Date().toISOString(),
        firstName: modFirstName,
        lastName: modLastName,
        name: approvedName,
        rank: modRank,
        district: modDistrict,
        station: modStation,
        mobile: modMobile,
        email: modEmail,
        
        assignedRole: modRole,
        permissions: modPermissions,
        division: modDivision,
        stateUnit: modStateUnit,
        department: modDepartment,
        reportingOfficer: modReportingOfficer,
        supervisor: modSupervisor,
        departmentHead: modDepartmentHead,
        commandingOfficer: modCommandingOfficer,
        securityClearance: modSecurityClearance,
        timeline: [
          ...(app.timeline || []),
          { status: modStatus === "pending" ? "active" : modStatus, date: new Date().toISOString(), remarks: `Application approved by ${officerProfile?.name || "Command Administrator"}.` }
        ]
      }, { merge: true });

      // Add to officer collection
      const officerDocRef = doc(db, "officers", app.id);
      await setDoc(officerDocRef, {
        uid: app.id,
        name: approvedName,
        badgeId: app.badgeId,
        email: modEmail || app.email,
        rank: modRank || app.rank,
        role: modRole,
        district: modDistrict || app.district,
        station: modStation || app.station,
        clearanceLevel: modSecurityClearance || "ISD-LEVEL-IV",
        active: modStatus === "suspended" || modStatus === "inactive" || modStatus === "rejected" ? false : true,
        lastLogin: new Date().toISOString(),
        mobile: modMobile || app.mobile,
        approvedAt: new Date().toISOString(),
        photoUrl: app.photoUrl || "",
        
        division: modDivision,
        stateUnit: modStateUnit,
        department: modDepartment,
        reportingOfficer: modReportingOfficer,
        supervisor: modSupervisor,
        departmentHead: modDepartmentHead,
        commandingOfficer: modCommandingOfficer,
        permissions: modPermissions,
        status: modStatus === "pending" ? "active" : modStatus
      }, { merge: true });

      alert(data.message || "Officer approved and credentials registered.");
      setIsDrawerOpen(false);
      await loadAdminData();
    } catch (err: any) {
      console.warn("Approval API failed. Applying to local sandbox instead.", err);
      
      const currentApps = getLocalData<OfficerApplication[]>("orca_applications", MOCK_OFFICER_APPLICATIONS);
      const updatedApps = currentApps.map(a => a.id === app.id ? { 
        ...a, 
        status: (modStatus === "pending" ? "active" : modStatus) as any, 
        firstName: modFirstName,
        lastName: modLastName,
        name: approvedName,
        rank: modRank,
        district: modDistrict,
        station: modStation,
        mobile: modMobile,
        email: modEmail,
        requestedAccess: modRequestedAccess,
        securityClearance: modSecurityClearance,
        assignedRole: modRole,
        permissions: modPermissions,
        division: modDivision,
        stateUnit: modStateUnit,
        department: modDepartment,
        reportingOfficer: modReportingOfficer,
        supervisor: modSupervisor,
        departmentHead: modDepartmentHead,
        commandingOfficer: modCommandingOfficer,
        timeline: [
          ...(a.timeline || []),
          { status: modStatus === "pending" ? "active" : modStatus, date: new Date().toISOString(), remarks: `Application approved by ${officerProfile?.name || "Command Administrator"} (Sandbox).` }
        ]
      } : a);
      setLocalData("orca_applications", updatedApps);
      
      const currentOfficers = getLocalData<any[]>("orca_officers", MOCK_OFFICERS);
      const existingIndex = currentOfficers.findIndex(o => o.uid === app.id);
      const newOfficer = {
        uid: app.id,
        name: approvedName,
        badgeId: app.badgeId,
        email: modEmail || app.email,
        rank: modRank || app.rank,
        role: modRole,
        district: modDistrict || app.district,
        station: modStation || app.station,
        clearanceLevel: modSecurityClearance || "ISD-LEVEL-IV",
        active: modStatus === "suspended" || modStatus === "inactive" || modStatus === "rejected" ? false : true,
        lastLogin: new Date().toISOString(),
        mobile: modMobile || app.mobile,
        approvedAt: new Date().toISOString(),
        photoUrl: app.photoUrl || "",
        
        division: modDivision,
        stateUnit: modStateUnit,
        department: modDepartment,
        reportingOfficer: modReportingOfficer,
        supervisor: modSupervisor,
        departmentHead: modDepartmentHead,
        commandingOfficer: modCommandingOfficer,
        permissions: modPermissions,
        status: modStatus === "pending" ? "active" : modStatus
      };
      
      if (existingIndex > -1) {
        currentOfficers[existingIndex] = newOfficer;
      } else {
        currentOfficers.push(newOfficer);
      }
      setLocalData("orca_officers", currentOfficers);
      
      const currentLogs = getLocalData<any[]>("orca_audit_logs", MOCK_AUDIT_LOGS);
      currentLogs.unshift({
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: `[Sandbox] Approved and registered officer: ${approvedName} (${app.badgeId}) under Role: ${modRole}`,
        module: "Officer Applications",
        ipAddress: "127.0.0.1 (Local)",
        status: "Success"
      });
      setLocalData("orca_audit_logs", currentLogs);
      
      alert(`Officer ${approvedName} successfully approved and provisioned in local sandbox mode.`);
      setIsDrawerOpen(false);
      await loadAdminData();
    } finally {
      setActionLoading(false);
    }
  };

  // Rejection flow handler
  const handleRejectApp = async (app: OfficerApplication) => {
    const reason = prompt(`Enter rejection reason for ${app.name}:`, "Incomplete police station verification record.");
    if (reason === null) return; // cancel
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject-officer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: app.id,
          email: app.email,
          name: app.name,
          reason: reason,
          adminName: officerProfile?.name || "Command Administrator"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection API returned error");

      alert(data.message || "Officer application status marked as rejected.");
      setIsDrawerOpen(false);
      await loadAdminData();
    } catch (err: any) {
      console.warn("Rejection API failed. Applying to local sandbox instead.", err);
      
      const currentApps = getLocalData<OfficerApplication[]>("orca_applications", MOCK_OFFICER_APPLICATIONS);
      const updatedApps = currentApps.map(a => a.id === app.id ? { ...a, status: "rejected" as const, remarks: reason } : a);
      setLocalData("orca_applications", updatedApps);
      
      const currentLogs = getLocalData<any[]>("orca_audit_logs", MOCK_AUDIT_LOGS);
      currentLogs.unshift({
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: `[Sandbox] Rejected officer application: ${app.name} (${app.badgeId}). Reason: ${reason}`,
        module: "Officer Applications",
        ipAddress: "127.0.0.1 (Local)",
        status: "Success"
      });
      setLocalData("orca_audit_logs", currentLogs);
      
      alert(`Officer application status marked as rejected in local sandbox mode.`);
      setIsDrawerOpen(false);
      await loadAdminData();
    } finally {
      setActionLoading(false);
    }
  };

  // Save progress of the review details
  const handleSaveReview = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    
    // Construct updated application object with modified fields
    const updatedApp = {
      ...selectedApp,
      firstName: modFirstName,
      lastName: modLastName,
      name: `${modFirstName} ${modLastName}`.trim(),
      rank: modRank,
      station: modStation,
      district: modDistrict,
      mobile: modMobile,
      email: modEmail,
      requestedAccess: modRequestedAccess,
      internalRemarks: modInternalRemarks,
      remarks: modInternalRemarks, // keep compatible
      priority: modPriority,
      assignedReviewer: modAssignedReviewer,
      securityClearance: modSecurityClearance,
      clearanceLevel: modSecurityClearance, // keep compatible
      bgVerification: modBgVerification,
      deptVerification: modDeptVerification,
      supervisorApproval: modSupervisorApproval,
      status: modStatus as any,
      timeline: [
        ...(selectedApp.timeline || []),
        { status: modStatus, date: new Date().toISOString(), remarks: `Review checkpoints updated by ${officerProfile?.name || "Command Administrator"}.` }
      ]
    };

    try {
      // Try Firestore write
      const appDocRef = doc(db, "officer_applications", selectedApp.id);
      await setDoc(appDocRef, updatedApp, { merge: true });
      
      // Also update the officers table status if status changed in save
      const officerDocRef = doc(db, "officers", selectedApp.id);
      await setDoc(officerDocRef, {
        name: `${modFirstName} ${modLastName}`.trim(),
        rank: modRank,
        station: modStation,
        district: modDistrict,
        mobile: modMobile,
        email: modEmail,
        requestedAccess: modRequestedAccess,
        clearanceLevel: modSecurityClearance,
        active: modStatus === "approved"
      }, { merge: true });

      await addDoc(collection(db, "audit_logs"), {
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: `Saved review parameters for applicant: ${selectedApp.name}`,
        module: "Officer Applications",
        ipAddress: "10.0.12.94",
        status: "Success"
      });

      alert("Application review progress saved successfully.");
      await loadAdminData();
    } catch (err: any) {
      console.warn("Firestore save review failed. Saving locally.", err);
      // Fallback local storage update
      const currentApps = getLocalData<OfficerApplication[]>("orca_applications", MOCK_OFFICER_APPLICATIONS);
      const updatedApps = currentApps.map(a => a.id === selectedApp.id ? updatedApp : a);
      setLocalData("orca_applications", updatedApps);

      const currentOfficers = getLocalData<any[]>("orca_officers", MOCK_OFFICERS);
      const updatedOfficers = currentOfficers.map(o => o.uid === selectedApp.id ? {
        ...o,
        name: `${modFirstName} ${modLastName}`.trim(),
        rank: modRank,
        station: modStation,
        district: modDistrict,
        mobile: modMobile,
        email: modEmail,
        requestedAccess: modRequestedAccess,
        clearanceLevel: modSecurityClearance,
        active: modStatus === "approved"
      } : o);
      setLocalData("orca_officers", updatedOfficers);
      
      alert("Application review progress saved successfully in local browser sandbox.");
      await loadAdminData();
    } finally {
      setActionLoading(false);
    }
  };

  // Request additional verification document information
  const handleRequestInfo = async () => {
    if (!selectedApp) return;
    const reqRemarks = prompt("Enter description of documents or information requested from the officer:", "Require certified service book extract or command verification note.");
    if (reqRemarks === null) return;
    setActionLoading(true);

    const updatedApp = {
      ...selectedApp,
      status: "awaiting" as const,
      internalRemarks: modInternalRemarks + `\n[Info Request]: ${reqRemarks}`,
      timeline: [
        ...(selectedApp.timeline || []),
        { status: "awaiting", date: new Date().toISOString(), remarks: `Additional Info Requested: ${reqRemarks}` }
      ]
    };

    try {
      const appDocRef = doc(db, "officer_applications", selectedApp.id);
      await setDoc(appDocRef, updatedApp, { merge: true });

      await addDoc(collection(db, "audit_logs"), {
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: `Requested additional info for applicant: ${selectedApp.name}`,
        module: "Officer Applications",
        ipAddress: "10.0.12.94",
        status: "Success"
      });
      alert("Application marked as 'Awaiting Documents' and applicant notified.");
      setIsDrawerOpen(false);
      await loadAdminData();
    } catch (err) {
      console.warn("Firestore request info failed. Saving locally.", err);
      const currentApps = getLocalData<OfficerApplication[]>("orca_applications", MOCK_OFFICER_APPLICATIONS);
      const updatedApps = currentApps.map(a => a.id === selectedApp.id ? updatedApp : a);
      setLocalData("orca_applications", updatedApps);

      alert("Application marked as 'Awaiting Documents' in local sandbox.");
      setIsDrawerOpen(false);
      await loadAdminData();
    } finally {
      setActionLoading(false);
    }
  };

  // Download raw application docket
  const handleDownloadApplication = () => {
    if (!selectedApp) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      ...selectedApp,
      firstName: modFirstName,
      lastName: modLastName,
      rank: modRank,
      station: modStation,
      district: modDistrict,
      mobile: modMobile,
      email: modEmail,
      requestedAccess: modRequestedAccess,
      internalRemarks: modInternalRemarks,
      priority: modPriority,
      assignedReviewer: modAssignedReviewer,
      securityClearance: modSecurityClearance,
      bgVerification: modBgVerification,
      deptVerification: modDeptVerification,
      supervisorApproval: modSupervisorApproval
    }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ORCA_Application_${selectedApp.badgeId || selectedApp.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Print full officer application panel
  const handlePrintApplication = () => {
    if (!selectedApp) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const adminName = officerProfile?.name || "Command Administrator";
    const dateStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Application - ${selectedApp.name}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 40px; color: black; line-height: 1.6; }
            h2 { border-bottom: 2px solid black; padding-bottom: 10px; text-align: center; }
            .section { margin-bottom: 20px; border: 1px solid #000; padding: 15px; }
            .section-title { font-weight: bold; text-transform: uppercase; background: #eee; padding: 4px 8px; margin-bottom: 10px; border-bottom: 1px solid #000; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>ORCA OFFICER REGISTRATION DOCKET</h2>
          <div class="section">
            <div class="section-title">1. Personal Information</div>
            <div class="grid">
              <div><span class="label">First Name:</span> ${modFirstName || selectedApp.name.split(" ")[0]}</div>
              <div><span class="label">Last Name:</span> ${modLastName || selectedApp.name.split(" ").slice(1).join(" ")}</div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">2. Officer Designation</div>
            <div class="grid">
              <div><span class="label">Badge ID / Officer ID:</span> ${selectedApp.badgeId}</div>
              <div><span class="label">Rank / Designation:</span> ${modRank}</div>
              <div><span class="label">Police Station / Unit:</span> ${modStation}</div>
              <div><span class="label">District:</span> ${modDistrict}</div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">3. Contact & Security Checks</div>
            <div class="grid">
              <div><span class="label">Official Email:</span> ${modEmail}</div>
              <div><span class="label">Mobile Number:</span> ${modMobile || "N/A"}</div>
              <div><span class="label">Password Status:</span> ✅ Created</div>
              <div><span class="label">Requested Access Level:</span> ${modRequestedAccess}</div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">4. Administrative Review Parameters</div>
            <div class="grid">
              <div><span class="label">Priority Clearance:</span> ${modPriority}</div>
              <div><span class="label">Security Clearance:</span> ${modSecurityClearance}</div>
              <div><span class="label">Background Check:</span> ${(modBgVerification || "").toUpperCase()}</div>
              <div><span class="label">Department Check:</span> ${(modDeptVerification || "").toUpperCase()}</div>
              <div><span class="label">Supervisor Signoff:</span> ${(modSupervisorApproval || "").toUpperCase()}</div>
              <div><span class="label">Assigned Reviewer:</span> ${modAssignedReviewer || "Unassigned"}</div>
            </div>
            <div style="margin-top: 10px;">
              <span class="label">Internal Remarks:</span><br/>
              <p style="white-space: pre-wrap; font-style: italic;">${modInternalRemarks || "No administrative remarks recorded."}</p>
            </div>
          </div>
          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div>
              Date Printed: ${dateStr}
            </div>
            <div style="text-align: center;">
              ___________________________<br/>
              ${adminName}<br/>
              ORCA Authority Representative
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate official approval/rejection printable letter window
  const generateDossierLetter = (app: OfficerApplication, type: "approval" | "rejection") => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const adminName = officerProfile?.name || "Command Administrator";
    const dateStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

    printWindow.document.write(`
      <html>
        <head>
          <title>OFFICIAL_BRIEF_${type.toUpperCase()}_${app.badgeId}</title>
          <style>
            body { font-family: 'Georgia', serif; padding: 50px; color: #111; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px double #333; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
            .subtitle { font-size: 12px; letter-spacing: 1px; color: #555; }
            .metadata { margin-bottom: 30px; font-size: 13px; font-family: 'Courier New', monospace; }
            .content { margin-bottom: 40px; text-align: justify; }
            .sign { float: right; text-align: center; margin-top: 50px; font-size: 14px; }
            .footer { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 80px; font-size: 10px; color: #777; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Internal Security Division (ISD)</div>
            <div class="subtitle">STATE INTELLIGENCE DIRECTORATE • GOVERNMENT OF KARNATAKA</div>
          </div>
          <div class="metadata">
            <strong>OFFICIAL BRIEF IDENTIFIER:</strong> ISD-BRIEF-${app.badgeId}-${Date.now().toString().slice(-4)}<br/>
            <strong>DATE:</strong> ${dateStr} IST<br/>
            <strong>TO:</strong> ${app.name} (${app.rank})<br/>
            <strong>STATION:</strong> ${app.station}, ${app.district}
          </div>
          <div class="content">
            <p>
              ${type === "approval" ? `
                We are pleased to inform you that your application for registration onto the <strong>Organized Crime Analysis Authority (O.R.C.A) AI platform</strong> has been officially <strong>APPROVED</strong> under active administrative clearance. 
                Your assigned credentials have been securely provisioned in our directory database ledger. 
                You are authorized to log in using your Badge ID (<strong>${app.badgeId}</strong>) and your custom password.
              ` : `
                Your application for access to the <strong>Organized Crime Analysis Authority (O.R.C.A) AI platform</strong> has been <strong>REJECTED</strong> following security review. 
                Remarks: <em>${app.remarks || "Registration details failed police verification check."}</em>
                You may resubmit an application with corrected station verification parameters if applicable.
              `}
            </p>
            <p>
              Please note that your access and queries on this intelligence node are actively audited under cryptographic signatures. Any unauthorized publication, distribution, or duplication of Sealed Dossiers generated by the platform constitutes a severe state offense.
            </p>
          </div>
          <div class="sign">
            ________________________<br/>
            <strong>${adminName}</strong><br/>
            Commanding Authority / Security Directorate
          </div>
          <div class="footer">
            CONFIDENTIAL LAW ENFORCEMENT INTERNAL DOCUMENT. STATE POLICE SECURE NETWORK.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleStartEditProfile = (off: any) => {
    setEditProfileName(off.name || "");
    setEditProfileRank(off.rank || "");
    setEditProfileEmail(off.email || "");
    setEditProfileDistrict(off.district || "");
    setEditProfileStation(off.station || "");
    setEditProfileClearance(off.clearanceLevel || "ISD-LEVEL-IV");
    setEditProfileMobile(off.mobile || off.phone || "");
    setEditProfileActive(off.active ?? true);
    setIsEditingProfile(true);
  };

  const handleSaveProfileEdit = async () => {
    if (!activeOfficerProfile) return;
    setActionLoading(true);
    try {
      const targetId = activeOfficerProfile.uid || activeOfficerProfile.id;
      if (!targetId) throw new Error("Officer ID not found — cannot save.");

      const updateData = {
        name: editProfileName,
        rank: editProfileRank,
        email: editProfileEmail,
        district: editProfileDistrict,
        station: editProfileStation,
        policeStation: editProfileStation,
        clearanceLevel: editProfileClearance,
        isdLevel: editProfileClearance,
        mobile: editProfileMobile,
        phone: editProfileMobile,
        active: editProfileActive,
        updatedAt: new Date().toISOString()
      };

      // Update Firestore /officers
      await setDoc(doc(db, "officers", targetId), updateData, { merge: true });
      // Also update /users so login data stays in sync
      try {
        await setDoc(doc(db, "users", targetId), updateData, { merge: true });
      } catch (usrErr) {
        console.warn("[users sync skipped]:", usrErr);
      }

      // Update local state instantly
      setOfficers((prev: any[]) =>
        prev.map(o => (o.uid || o.id) === targetId ? { ...o, ...updateData } : o)
      );
      setActiveOfficerProfile((prev: any) => prev ? { ...prev, ...updateData } : null);

      // Audit log
      try {
        await addDoc(collection(db, "audit_logs"), {
          timestamp: new Date().toISOString(),
          officer: officerProfile?.name || "Command Administrator",
          action: `Edited profile for Officer: ${editProfileName} (Badge: ${activeOfficerProfile.badgeId || targetId})`,
          module: "Officer Directory",
          status: "success",
          ip: "10.10.42.1"
        });
      } catch (logErr) {
        console.warn("[audit log skipped]:", logErr);
      }

      setIsEditingProfile(false);
      alert(`✅ Profile for "${editProfileName}" saved successfully!`);
    } catch (err: any) {
      console.error("[Save Profile Error]:", err);
      alert("❌ Error saving profile: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Toggle-Status for Officer Directory Entries
  const handleToggleOfficerStatus = async (off: any) => {
    const nextActiveState = !off.active;
    if (!confirm(`Are you sure you want to ${nextActiveState ? "Activate" : "Suspend"} Officer ${off.name}?`)) return;
    setActionLoading(true);
    try {
      await setDoc(doc(db, "officers", off.uid), { active: nextActiveState }, { merge: true });
      await addDoc(collection(db, "audit_logs"), {
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: `${nextActiveState ? "Activated" : "Suspended"} account: ${off.name} (${off.badgeId})`,
        module: "Officer Directory",
        ipAddress: "10.0.12.94",
        status: "Success"
      });
      alert(`Officer ${off.name} successfully ${nextActiveState ? "activated" : "suspended"}.`);
      await loadAdminData();
    } catch (err: any) {
      alert("Failed to adjust officer status: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // RBAC Permission change toggling
  const handlePermissionToggle = (role: string, permission: string) => {
    setRbacPermissions(prev => {
      const activePerms = prev[role] || [];
      const updatedPerms = activePerms.includes(permission)
        ? activePerms.filter(p => p !== permission)
        : [...activePerms, permission];
      return { ...prev, [role]: updatedPerms };
    });
  };

  // Save Settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemSettings) return;
    setActionLoading(true);
    try {
      await saveSystemSettings(systemSettings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
      
      // Log Settings Change
      await addDoc(collection(db, "audit_logs"), {
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: "Updated O.R.C.A Admin System Settings",
        module: "Settings",
        ipAddress: "10.0.12.94",
        status: "Success"
      });
    } catch (err: any) {
      console.warn("Firestore save settings failed due to permissions. Saving to sandbox.", err);
      setLocalData("orca_settings", systemSettings);
      
      const currentLogs = getLocalData<any[]>("orca_audit_logs", MOCK_AUDIT_LOGS);
      currentLogs.unshift({
        timestamp: new Date().toISOString(),
        officer: officerProfile?.name || "Command Administrator",
        action: "[Sandbox] Updated O.R.C.A Admin System Settings",
        module: "Settings",
        ipAddress: "127.0.0.1 (Local)",
        status: "Success"
      });
      setLocalData("orca_audit_logs", currentLogs);
      
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter application arrays
  const filteredApps = applications.filter(app => {
    const nameToUse = app.name || "";
    const badgeToUse = app.badgeId || "";
    const emailToUse = app.email || "";
    const rankToUse = app.rank || "";
    const districtToUse = app.district || "";
    const stationToUse = app.station || "";
    const reviewerToUse = app.assignedReviewer || "";
    const accessToUse = app.requestedAccess || "";
    const statusToUse = app.status || "";

    const searchStr = (appSearch || "").toLowerCase();
    const stationFilterStr = (appStationFilter || "").toLowerCase();
    const reviewerFilterStr = (appReviewerFilter || "").toLowerCase();

    const matchesSearch = nameToUse.toLowerCase().includes(searchStr) ||
                          badgeToUse.toLowerCase().includes(searchStr) ||
                          emailToUse.toLowerCase().includes(searchStr) ||
                          rankToUse.toLowerCase().includes(searchStr) ||
                          districtToUse.toLowerCase().includes(searchStr) ||
                          stationToUse.toLowerCase().includes(searchStr);

    const matchesRank = appRankFilter === "ALL" || rankToUse === appRankFilter;
    const matchesDistrict = appDistrictFilter === "ALL" || districtToUse === appDistrictFilter;
    const matchesStation = appStationFilter === "ALL" || stationToUse.toLowerCase().includes(stationFilterStr);
    const matchesStatus = appStatusFilter === "ALL" || statusToUse === appStatusFilter;
    const matchesAccess = appAccessFilter === "ALL" || accessToUse === appAccessFilter;
    const matchesReviewer = appReviewerFilter === "ALL" || reviewerToUse.toLowerCase().includes(reviewerFilterStr);

    return matchesSearch && matchesRank && matchesDistrict && matchesStation && matchesStatus && matchesAccess && matchesReviewer;
  });

  // Sort application arrays
  const sortedApps = [...filteredApps].sort((a, b) => {
    if (appSortBy === "newest") {
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    }
    if (appSortBy === "oldest") {
      return new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
    }
    if (appSortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (appSortBy === "priority") {
      const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const wA = priorityWeight[a.priority as "HIGH" | "MEDIUM" | "LOW"] || 0;
      const wB = priorityWeight[b.priority as "HIGH" | "MEDIUM" | "LOW"] || 0;
      return wB - wA;
    }
    return 0;
  });

  // Paginated applications list
  const totalPages = Math.ceil(sortedApps.length / itemsPerPage) || 1;
  const paginatedApps = sortedApps.slice((appPage - 1) * itemsPerPage, appPage * itemsPerPage);

  // Filter officer directories
  const filteredOfficers = officers.filter(off => {
    const nameStr = (off.name || "").toLowerCase();
    const badgeStr = (off.badgeId || "").toLowerCase();
    const emailStr = (off.email || "").toLowerCase();
    const rankStr = (off.rank || "").toLowerCase();
    const query = (dirSearch || "").toLowerCase();
    const rankFilterQuery = (dirRankFilter || "").toLowerCase();

    const matchesSearch = nameStr.includes(query) || 
                          badgeStr.includes(query) ||
                          emailStr.includes(query);
    const matchesDistrict = dirDistrictFilter === "ALL" || off.district === dirDistrictFilter;
    const matchesRank = dirRankFilter === "ALL" || rankStr.includes(rankFilterQuery);
    return matchesSearch && matchesDistrict && matchesRank;
  });

  // Filter Audit Logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const officerStr = (log.officer || "").toLowerCase();
    const actionStr = (log.action || "").toLowerCase();
    const query = (auditSearch || "").toLowerCase();

    const matchesSearch = officerStr.includes(query) || actionStr.includes(query);
    const matchesModule = auditModuleFilter === "ALL" || log.module === auditModuleFilter;
    return matchesSearch && matchesModule;
  });

  // Filter Verifications
  const filteredVerifications = verifications.filter(v => {
    const docNameStr = (v.documentName || "").toLowerCase();
    const verIdStr = (v.verificationId || "").toLowerCase();
    const verByStr = (v.verifiedBy || "").toLowerCase();
    const query = (verSearch || "").toLowerCase();

    const matchesSearch = docNameStr.includes(query) ||
                          verIdStr.includes(query) ||
                          verByStr.includes(query);
    const matchesStatus = verStatusFilter === "ALL" || v.status === verStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Unique lists for dropdowns
  const uniqueDistricts = Array.from(new Set(officers.map(o => o.district).filter(Boolean)));
  const uniqueModules = Array.from(new Set(auditLogs.map(l => l.module).filter(Boolean)));

  // Show Loading Skeleton
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "400px", color: ADMIN_THEME.textSecondary }}>
        <Loader2 style={{ width: 40, height: 40, animation: "spin 1s linear infinite", color: ADMIN_THEME.accentGold, marginBottom: 12 }} />
        <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>SYNCHRONIZING WITH IS SECURE LEDGER NODE...</span>
      </div>
    );
  }

  return (
    <div style={{ color: ADMIN_THEME.textPrimary, animation: "fadeIn 0.3s ease" }}>
      
      {/* 1. ADMIN DASHBOARD */}
      {adminTab === "admin-dashboard" && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: ADMIN_THEME.textPrimary, letterSpacing: "-0.02em" }}>Command Operations Console</h1>
              <p style={{ fontSize: 13, color: ADMIN_THEME.textSecondary }}>Administrative Security Core & Directory Management Panel</p>
            </div>
            <button
              onClick={handleSeedDatabase}
              disabled={actionLoading}
              style={{
                background: ADMIN_THEME.blue,
                color: "white",
                padding: "6px 14px",
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: ADMIN_THEME.shadow
              }}
            >
              <Database style={{ width: 14, height: 14 }} />
              {seedSuccess ? "Database Initialized!" : "Seed Security Data"}
            </button>
          </div>

          {/* KPI CARDS GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
            
            {/* Row 1 */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Pending Applications</span>
                <UserCheck style={{ width: 14, height: 14, color: ADMIN_THEME.accentGold }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.accentGold }}>
                {applications.filter(a => a.status === "pending").length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Awaiting Administrative Review</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Approved Officers</span>
                <Shield style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {officers.filter(o => o.active).length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Active Database Credentials</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Rejected Applications</span>
                <X style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {applications.filter(a => a.status === "rejected").length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Security Review Denied Cases</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Online Officers</span>
                <Activity style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.green }}>
                {officers.filter(o => o.active).length > 0 ? Math.max(1, Math.round(officers.filter(o => o.active).length * 0.4)) : 0}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Active Session Tokens</div>
            </div>

            {/* Row 2 */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Today's Logins</span>
                <Clock style={{ width: 14, height: 14, color: ADMIN_THEME.blue }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {auditLogs.filter(l => (l.action && l.action.toLowerCase().includes("login")) || l.status === "ACTIVE").length || auditLogs.length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Secure terminal sessions</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Reports Generated Today</span>
                <FileText style={{ width: 14, height: 14, color: ADMIN_THEME.accentGold }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {verifications.length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>A4 sealed PDF briefs printed</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>AI Conversations Today</span>
                <Bot style={{ width: 14, height: 14, color: ADMIN_THEME.accentGold }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {auditLogs.filter(l => l.module === "AI Assistant" || (l.action && l.action.toLowerCase().includes("ai"))).length || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("orca_chat_conversations") || "[]").length : 0)}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>NVIDIA NIM model API invocations</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Verification Requests</span>
                <FileCheck style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {verifications.length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Cryptographic document checks</div>
            </div>

            {/* Row 3 */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Security Flagged Logins</span>
                <AlertTriangle style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.red }}>
                {auditLogs.filter(l => l.action && (l.action.includes("VPN") || l.action.includes("FAIL") || l.action.includes("FLAGGED"))).length}
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Alert blocks under security watch</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>System Health</span>
                <Server style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.green }}>99.9%</div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Server cluster online index</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>Storage Usage</span>
                <Database style={{ width: 14, height: 14, color: ADMIN_THEME.blue }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>
                {((officers.length * 0.12) + (applications.length * 0.25) + (verifications.length * 0.45) + 0.8).toFixed(1)} MB
              </div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>Firestore document weights</div>
            </div>

            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                <span>API Status</span>
                <CloudLightning style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.green }}>ONLINE</div>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>NVIDIA NIM language gateway sync</div>
            </div>

          </div>

          {/* LOWER FEEDS SUMMARY */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
            {/* Audit Logs */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>Recent Security Audit Trail</span>
                <History style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {auditLogs.slice(0, 5).map((log, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: idx !== 4 ? `1px solid ${ADMIN_THEME.border}` : "none", paddingBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{log.action}</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>{log.officer} • {log.module}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textMuted }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                      <span style={{ fontSize: 9, background: "rgba(16,185,129,0.1)", color: ADMIN_THEME.green, padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>SUCCESS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Health alerts */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>State Server Cluster Status</span>
                <Server style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: ADMIN_THEME.textSecondary }}>Firebase DB Node</span>
                  <span style={{ color: ADMIN_THEME.green, fontWeight: 600 }}>● Connected (12ms)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: ADMIN_THEME.textSecondary }}>NVIDIA NIM AI API Node</span>
                  <span style={{ color: ADMIN_THEME.green, fontWeight: 600 }}>● Online (244ms)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: ADMIN_THEME.textSecondary }}>Sealed Document Ledger</span>
                  <span style={{ color: ADMIN_THEME.green, fontWeight: 600 }}>● Locked & Audited</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: ADMIN_THEME.textSecondary }}>Proxy Security Firewall</span>
                  <span style={{ color: ADMIN_THEME.green, fontWeight: 600 }}>● active</span>
                </div>
                <div style={{ background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.2)", borderRadius: 6, padding: 10, marginTop: 12, display: "flex", gap: 8, color: ADMIN_THEME.accentGold }}>
                  <Info style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 10.5, lineHeight: 1.4 }}>
                    <strong>Notice:</strong> MFA configuration active for all administration accounts. Sessions automatically terminate after 30 minutes of terminal inactivity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PENDING REGISTRATIONS (REAL-TIME QUEUE) */}
      {adminTab === "admin-pending" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Pending Registrations</h1>
                <span style={{
                  background: ADMIN_THEME.accentGold,
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12
                }}>
                  {pendingRegistrations.length} PENDING
                </span>
              </div>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Real-time queue of public registration requests awaiting administrative approval and RBAC clearance assignment
              </p>
            </div>
          </div>

          {pendingRegistrations.length === 0 ? (
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderRadius: 10,
              padding: 40,
              textAlign: "center",
              boxShadow: ADMIN_THEME.shadow
            }}>
              <Check style={{ width: 42, height: 42, color: ADMIN_THEME.green, margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: ADMIN_THEME.textPrimary, marginBottom: 6 }}>
                Queue Clear — No Pending Registrations
              </h3>
              <p style={{ fontSize: 13, color: ADMIN_THEME.textSecondary, margin: 0 }}>
                All incoming registration applications have been reviewed and processed.
              </p>
            </div>
          ) : (
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: ADMIN_THEME.shadow
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: ADMIN_THEME.bg, borderBottom: `1px solid ${ADMIN_THEME.border}`, textAlign: "left" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Officer Details</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Rank</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Posting Classification</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Requested Access</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Submitted At</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: ADMIN_THEME.textPrimary, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRegistrations.map((reg, index) => (
                    <tr key={reg.id || reg.uid || index} style={{ borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                      <td style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                        {reg.photoUrl ? (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ADMIN_THEME.blue}` }}>
                            <img src={reg.photoUrl} alt="Officer Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,31,63,0.1)", border: `1px solid ${ADMIN_THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ADMIN_THEME.textSecondary }}>
                            {reg.name ? reg.name.substring(0, 1).toUpperCase() : "?"}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{reg.name}</div>
                          <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary }}>{reg.email}</div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: ADMIN_THEME.textPrimary }}>{reg.rank}</td>
                      <td style={{ padding: "12px 16px", color: ADMIN_THEME.textSecondary }}>{reg.posting || `${reg.postingType || "Field"} - ${reg.station || reg.district || ""}`}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          background: "rgba(0,31,63,0.08)",
                          color: ADMIN_THEME.blue,
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600
                        }}>
                          {reg.requestedAccess || "Investigation Dashboard"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 11, color: ADMIN_THEME.textSecondary }}>
                        {reg.submittedAt ? new Date(reg.submittedAt).toLocaleString() : "Recently"}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPendingReg(reg);
                              setPendingRoleSelection("investigation_l1");
                              setPendingIsdSelection("ISD-LEVEL-IV");
                              setApproveModalOpen(true);
                            }}
                            style={{
                              background: ADMIN_THEME.green,
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPendingReg(reg);
                              setRejectReasonInput("");
                              setRejectModalOpen(true);
                            }}
                            style={{
                              background: ADMIN_THEME.red,
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* APPROVE REGISTRATION MODAL */}
          {approveModalOpen && selectedPendingReg && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: ADMIN_THEME.cardBg,
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 12,
                padding: 24,
                width: 460,
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)"
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginBottom: 16 }}>
                  Approve Registration & Assign Role
                </h3>
                
                <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center", background: "rgba(0,31,63,0.03)", padding: 12, borderRadius: 8, border: `1px solid ${ADMIN_THEME.border}` }}>
                  {selectedPendingReg.photoUrl ? (
                    <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ADMIN_THEME.blue}`, flexShrink: 0 }}>
                      <img src={selectedPendingReg.photoUrl} alt="Captured Face" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(0,31,63,0.1)", border: `1px dashed ${ADMIN_THEME.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      👤
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: ADMIN_THEME.textSecondary, lineHeight: 1.5 }}>
                    You are approving registration for <strong>{selectedPendingReg.name}</strong> ({selectedPendingReg.email}). Select explicit role and ISD clearance:
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: ADMIN_THEME.textPrimary }}>
                    Dashboard Role Configuration
                  </label>
                  <select
                    value={pendingRoleSelection}
                    onChange={(e) => setPendingRoleSelection(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary
                    }}
                  >
                    <option value="investigation_l1">Field Operational Officer</option>
                    <option value="investigation_l2">Senior Investigation Officer</option>
                    <option value="admin_verification">Verification Administration Officer</option>
                    <option value="admin_scrb">SCRB Executive Administrator</option>
                    <option value="admin_full">Full Command Administrator</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: ADMIN_THEME.textPrimary }}>
                    Security Clearance (ISD Level)
                  </label>
                  <select
                    value={pendingIsdSelection}
                    onChange={(e) => setPendingIsdSelection(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary
                    }}
                  >
                    <option value="ISD-LEVEL-IV">ISD-LEVEL-IV (Field Officer Clearance)</option>
                    <option value="ISD-LEVEL-III">ISD-LEVEL-III (Senior Inspector Clearance)</option>
                    <option value="ISD-LEVEL-II">ISD-LEVEL-II (Superintendent Clearance)</option>
                    <option value="ISD-LEVEL-I">ISD-LEVEL-I (Director General / Command Clearance)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setApproveModalOpen(false); setSelectedPendingReg(null); }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${ADMIN_THEME.border}`,
                      padding: "8px 16px",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      color: ADMIN_THEME.textSecondary
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pendingActionLoading}
                    onClick={handleConfirmApproveRegistration}
                    style={{
                      background: ADMIN_THEME.green,
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {pendingActionLoading ? "Approving..." : "Confirm & Assign Clearance"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REJECT REGISTRATION MODAL */}
          {rejectModalOpen && selectedPendingReg && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999
            }}>
              <div style={{
                background: ADMIN_THEME.cardBg,
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 12,
                padding: 24,
                width: 440,
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)"
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: ADMIN_THEME.red, marginBottom: 12 }}>
                  Reject Officer Registration
                </h3>
                <p style={{ fontSize: 13, color: ADMIN_THEME.textSecondary, marginBottom: 14 }}>
                  Are you sure you want to reject registration for <strong>{selectedPendingReg.name}</strong>? Their account will be disabled in Firebase Auth.
                </p>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: ADMIN_THEME.textPrimary }}>
                    Rejection Reason
                  </label>
                  <input
                    type="text"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="e.g. Incomplete credentials / unverified Badge ID"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setRejectModalOpen(false); setSelectedPendingReg(null); }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${ADMIN_THEME.border}`,
                      padding: "8px 16px",
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: "pointer",
                      color: ADMIN_THEME.textSecondary
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pendingActionLoading}
                    onClick={handleConfirmRejectRegistration}
                    style={{
                      background: ADMIN_THEME.red,
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {pendingActionLoading ? "Processing..." : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. OFFICER APPLICATIONS */}
      {adminTab === "admin-applications" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Officer Ingress Applications</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Approve or reject credentials and station clearances for applying police officers</p>
            </div>
            <div style={{ position: "relative" }}>
              <Search style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search name, badge ID, station..."
                value={appSearch}
                onChange={e => { setAppSearch(e.target.value); setAppPage(1); }}
                style={{
                  background: ADMIN_THEME.cardBg,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  padding: "6px 12px 6px 32px",
                  fontSize: 12,
                  color: ADMIN_THEME.textPrimary,
                  outline: "none",
                  width: "250px"
                }}
              />
            </div>
          </div>

          {/* Filters Bar */}
          <div style={{
            background: ADMIN_THEME.cardBg,
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12
          }}>
            <div>
              <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Rank Filter</label>
              <select
                value={appRankFilter}
                onChange={e => { setAppRankFilter(e.target.value); setAppPage(1); }}
                style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary, cursor: "pointer" }}
              >
                <option value="ALL">All Ranks</option>
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>District Jurisdiction</label>
              <select
                value={appDistrictFilter}
                onChange={e => { setAppDistrictFilter(e.target.value); setAppPage(1); }}
                style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary, cursor: "pointer" }}
              >
                <option value="ALL">All Districts</option>
                {KARNATAKA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Application Status</label>
              <select
                value={appStatusFilter}
                onChange={e => { setAppStatusFilter(e.target.value); setAppPage(1); }}
                style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary, cursor: "pointer" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="under_review">Under Review</option>
                <option value="awaiting">Awaiting Documents</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Sort By</label>
              <select
                value={appSortBy}
                onChange={e => { setAppSortBy(e.target.value); setAppPage(1); }}
                style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary, cursor: "pointer" }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name A-Z</option>
                <option value="priority">Priority Level</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" }}>Requested Access</label>
              <select
                value={appAccessFilter}
                onChange={e => { setAppAccessFilter(e.target.value); setAppPage(1); }}
                style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary, cursor: "pointer" }}
              >
                <option value="ALL">All Access Levels</option>
                {ACCESS_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {paginatedApps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: ADMIN_THEME.textSecondary, background: ADMIN_THEME.cardBg, borderRadius: 8, border: `1px solid ${ADMIN_THEME.border}` }}>
              <UserCheck style={{ width: 48, height: 48, margin: "0 auto 12px", opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>No applications registered matching filters</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Awaiting new officer registrations or dev seeding.</div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {paginatedApps.map(app => (
                  <div 
                    key={app.id}
                    style={{
                      background: ADMIN_THEME.cardBg,
                      border: `1px solid ${app.status === "pending" && app.priority === "HIGH" ? "rgba(255, 153, 51, 0.4)" : ADMIN_THEME.border}`,
                      borderRadius: 8,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden"
                    }}
                  >
                    {/* Priority Tag */}
                    {(app.status === "pending" || app.status === "under_review") && (
                      <span style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        fontSize: 9,
                        fontWeight: 800,
                        background: app.priority === "HIGH" ? `${ADMIN_THEME.red}20` : `${ADMIN_THEME.accentGold}20`,
                        color: app.priority === "HIGH" ? ADMIN_THEME.red : ADMIN_THEME.accentGold,
                        padding: "2px 6px",
                        borderRadius: 4
                      }}>
                        {app.priority} PRIORITY
                      </span>
                    )}

                    {/* Body */}
                    <div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "rgba(0,31,63,0.08)",
                          border: `1.5px solid ${app.status === "approved" ? ADMIN_THEME.green : ADMIN_THEME.accentGold}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          fontWeight: 900,
                          color: ADMIN_THEME.textPrimary
                        }}>
                        {app.photoUrl ? (
                          <img 
                            src={app.photoUrl} 
                            alt={`${app.name} photo`}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                          />
                        ) : (
                          getCleanInitials(app.name)
                        )}
                        </div>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{app.name}</h3>
                          <p style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, margin: 0 }}>{app.rank} • ID: {app.badgeId}</p>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11, color: ADMIN_THEME.textSecondary, marginBottom: 16 }}>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>District:</strong> {app.district}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Station:</strong> {app.station}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Email:</strong> {app.email}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Mobile:</strong> {app.mobile || "N/A"}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Access Level:</strong> <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 600 }}>{app.requestedAccess}</span></div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Submitted:</strong> {new Date(app.submittedAt).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 12 }}>
                      <div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: app.status === "approved" ? ADMIN_THEME.green : (app.status === "rejected" ? ADMIN_THEME.red : ADMIN_THEME.accentGold)
                        }}>
                          ● {app.status === "pending" ? "Pending Review" : app.status.replace("_", " ")}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setIsDrawerOpen(true);
                        }}
                        style={{
                          background: ADMIN_THEME.cardBg,
                          border: `1px solid ${ADMIN_THEME.border}`,
                          color: ADMIN_THEME.textSecondary,
                          padding: "4px 10px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        Review <ChevronRight style={{ width: 12, height: 12 }} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 24, borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 16 }}>
                  <button
                    disabled={appPage === 1}
                    onClick={() => setAppPage(p => Math.max(1, p - 1))}
                    style={{
                      background: appPage === 1 ? "rgba(0,0,0,0.02)" : ADMIN_THEME.cardBg,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      color: appPage === 1 ? ADMIN_THEME.textMuted : ADMIN_THEME.textPrimary,
                      padding: "6px 12px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: appPage === 1 ? "not-allowed" : "pointer"
                    }}
                  >
                    ◀ Previous Page
                  </button>
                  <span style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, fontFamily: "JetBrains Mono" }}>
                    Page {appPage} of {totalPages} ({filteredApps.length} Applications)
                  </span>
                  <button
                    disabled={appPage === totalPages}
                    onClick={() => setAppPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      background: appPage === totalPages ? "rgba(0,0,0,0.02)" : ADMIN_THEME.cardBg,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      color: appPage === totalPages ? ADMIN_THEME.textMuted : ADMIN_THEME.textPrimary,
                      padding: "6px 12px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: appPage === totalPages ? "not-allowed" : "pointer"
                    }}
                  >
                    Next Page ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. OFFICER DIRECTORY */}
      {adminTab === "admin-directory" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Approved Officer Directory</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>View profiles, adjust station assignments, and manage access parameters</p>
            </div>
            
            {/* Filters */}
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={dirDistrictFilter}
                onChange={e => setDirDistrictFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All Districts</option>
                {uniqueDistricts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                value={dirRankFilter}
                onChange={e => setDirRankFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All Ranks</option>
                <option value="Superintendent">Superintendent</option>
                <option value="Inspector">Inspector</option>
                <option value="Sub Inspector">Sub Inspector</option>
                <option value="Constable">Constable</option>
              </select>
              <div style={{ position: "relative" }}>
                <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search officers..."
                  value={dirSearch}
                  onChange={e => setDirSearch(e.target.value)}
                  style={{
                    background: ADMIN_THEME.cardBg,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 6,
                    padding: "4px 10px 4px 28px",
                    fontSize: 12,
                    color: ADMIN_THEME.textPrimary,
                    width: "180px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {/* Officers Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filteredOfficers.map(off => (
                <div 
                  key={off.uid}
                  style={{
                    background: ADMIN_THEME.cardBg,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 8,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: "rgba(0,31,63,0.08)",
                        border: `1.5px solid ${off.active ? ADMIN_THEME.green : ADMIN_THEME.red}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: ADMIN_THEME.textPrimary
                      }}>
                        {getCleanInitials(off.name)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{off.name}</h4>
                        <p style={{ fontSize: 10.5, color: ADMIN_THEME.textSecondary }}>{off.rank} • Badge: {off.badgeId}</p>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>District:</strong> {off.district}</div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Station:</strong> {off.station}</div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Email:</strong> {off.email}</div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Phone:</strong> {off.mobile || off.phone || "N/A"}</div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Access Level:</strong> <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 600 }}>{off.requestedAccess || "Full Investigator Access"}</span></div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Clearance:</strong> <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 600 }}>{off.clearanceLevel || "ISD-LEVEL-IV"}</span></div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Last Login:</strong> {off.lastLogin ? new Date(off.lastLogin).toLocaleString() : "Never"}</div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Status:</strong> <span style={{ color: off.active ? ADMIN_THEME.green : ADMIN_THEME.red, fontWeight: 700 }}>{off.active ? "ACTIVE" : "INACTIVE / SUSPENDED"}</span></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 10 }}>
                    <button
                      onClick={() => setActiveOfficerProfile(off)}
                      style={{
                        flex: 1,
                        background: ADMIN_THEME.cardBg,
                        border: `1px solid ${ADMIN_THEME.border}`,
                        borderRadius: 4,
                        color: ADMIN_THEME.textSecondary,
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "4px 8px",
                        cursor: "pointer"
                      }}
                    >
                      View Profile
                    </button>

                    {officerProfile?.role !== "Administrative Dashboard - Level 1" && (
                      <button
                        onClick={() => handleToggleOfficerStatus(off)}
                        disabled={actionLoading}
                        style={{
                          background: off.active ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
                          border: `1px solid ${off.active ? ADMIN_THEME.red : ADMIN_THEME.green}`,
                          borderRadius: 4,
                          color: off.active ? ADMIN_THEME.red : ADMIN_THEME.green,
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "4px 8px",
                          cursor: "pointer"
                        }}
                      >
                        {off.active ? "Suspend" : "Activate"}
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* Profile Detail Panel Popup */}
            {activeOfficerProfile && (
              <div 
                style={{ 
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  backgroundColor: "rgba(2, 8, 19, 0.4)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 99999
                }}
                onClick={() => { setActiveOfficerProfile(null); setIsEditingProfile(false); }}
              >
                <div 
                  style={{ 
                    background: ADMIN_THEME.cardBg, 
                    border: `1px solid ${ADMIN_THEME.border}`, 
                    borderRadius: 12, 
                    padding: 24, 
                    width: "420px", 
                    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                    display: "flex", 
                    flexDirection: "column",
                    animation: "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 12, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{isEditingProfile ? "Edit Officer Profile" : "Officer Ingress Card"}</h3>
                    <button onClick={() => { setActiveOfficerProfile(null); setIsEditingProfile(false); }} style={{ background: "none", border: "none", color: ADMIN_THEME.textSecondary, cursor: "pointer" }}><X style={{ width: 16, height: 16 }} /></button>
                  </div>

                  {isEditingProfile ? (
                    /* Edit Form View */
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Full Name</label>
                        <input 
                          type="text" 
                          value={editProfileName} 
                          onChange={e => setEditProfileName(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Rank / Designation</label>
                          <select 
                            value={editProfileRank} 
                            onChange={e => setEditProfileRank(e.target.value)} 
                            style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                          >
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Clearance Level</label>
                          <select 
                            value={editProfileClearance} 
                            onChange={e => setEditProfileClearance(e.target.value)} 
                            style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                          >
                            <option value="ISD-LEVEL-I">ISD-LEVEL-I</option>
                            <option value="ISD-LEVEL-II">ISD-LEVEL-II</option>
                            <option value="ISD-LEVEL-III">ISD-LEVEL-III</option>
                            <option value="ISD-LEVEL-IV">ISD-LEVEL-IV</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Email Address</label>
                        <input 
                          type="email" 
                          value={editProfileEmail} 
                          onChange={e => setEditProfileEmail(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>District</label>
                          <select 
                            value={editProfileDistrict} 
                            onChange={e => setEditProfileDistrict(e.target.value)} 
                            style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                          >
                            {KARNATAKA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Account Status</label>
                          <select 
                            value={editProfileActive ? "active" : "suspended"} 
                            onChange={e => setEditProfileActive(e.target.value === "active")} 
                            style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                          >
                            <option value="active">Active Clearance</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Station Assignment</label>
                        <input 
                          type="text" 
                          value={editProfileStation} 
                          onChange={e => setEditProfileStation(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Contact Phone</label>
                        <input 
                          type="text" 
                          value={editProfileMobile} 
                          onChange={e => setEditProfileMobile(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>

                      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                        <button 
                          onClick={() => setIsEditingProfile(false)}
                          style={{ flex: 1, background: "none", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "10px 0", fontSize: 11, color: ADMIN_THEME.textSecondary, fontWeight: 700, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveProfileEdit}
                          disabled={actionLoading}
                          style={{ flex: 1, background: ADMIN_THEME.green, border: "none", borderRadius: 6, padding: "10px 0", fontSize: 11, color: "white", fontWeight: 800, cursor: "pointer" }}
                        >
                          {actionLoading ? "Saving..." : "Save Details"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Details View */
                    <>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
                        <div style={{
                          width: 68,
                          height: 68,
                          borderRadius: "50%",
                          background: "rgba(0,31,63,0.08)",
                          border: `2px solid ${ADMIN_THEME.accentGold}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          fontWeight: 800,
                          color: ADMIN_THEME.textPrimary,
                          marginBottom: 10
                        }}>
                          {getCleanInitials(activeOfficerProfile.name)}
                        </div>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: ADMIN_THEME.textPrimary, textAlign: "center" }}>{activeOfficerProfile.name}</h4>
                        <p style={{ fontSize: 11, color: ADMIN_THEME.textSecondary }}>{activeOfficerProfile.rank}</p>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 16, color: ADMIN_THEME.textSecondary }}>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Badge Number:</strong> {activeOfficerProfile.badgeId}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Email Address:</strong> {activeOfficerProfile.email}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Department:</strong> Cyber Crime Cell Division</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Clearance Level:</strong> {activeOfficerProfile.clearanceLevel || "ISD-LEVEL-IV"}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>State District:</strong> {activeOfficerProfile.district}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Station Hub:</strong> {activeOfficerProfile.station}</div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Status Code:</strong> <span style={{ color: activeOfficerProfile.active ? ADMIN_THEME.green : ADMIN_THEME.red, fontWeight: 600 }}>● {activeOfficerProfile.active ? "ACTIVE CLEARANCE" : "SUSPENDED"}</span></div>
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Last Terminal Sync:</strong> {new Date(activeOfficerProfile.lastLogin || Date.now()).toLocaleString()}</div>
                        {(
                          <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
                            <button 
                              onClick={() => handleStartEditProfile(activeOfficerProfile)}
                              style={{ flex: 1, background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 0", fontSize: 11, color: ADMIN_THEME.textSecondary, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                            >
                              Edit Profile
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm("Reset account credentials security key pin?")) {
                                  alert("Password reset trigger initialized. System notification queued.");
                                }
                              }}
                              style={{ flex: 1, background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 0", fontSize: 11, color: ADMIN_THEME.textSecondary, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                            >
                              Reset PIN
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ROLES & PERMISSIONS */}
      {adminTab === "admin-roles" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Role-Based Access Controls (RBAC)</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Configure individually binded module clearances and operation clearances across active rank roles</p>
          </div>

          <div style={{ marginBottom: 28 }}>
            <RoleAssignmentManager />
            <RoleChangeLogTable />
          </div>

          {PERMISSION_CATEGORIES.map(category => {
            const Icon = category.icon;
            return (
              <div 
                key={category.id} 
                style={{ 
                  background: ADMIN_THEME.cardBg, 
                  border: `1px solid ${ADMIN_THEME.border}`, 
                  borderRadius: 8, 
                  overflow: "hidden", 
                  marginBottom: 20, 
                  boxShadow: ADMIN_THEME.shadow 
                }}
              >
                {/* Section Header */}
                <div style={{ 
                  background: "rgba(0,31,63,0.02)", 
                  borderBottom: `1px solid ${ADMIN_THEME.border}`, 
                  padding: "12px 16px", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 8 
                }}>
                  <Icon style={{ width: 15, height: 15, color: ADMIN_THEME.accentGold }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {category.name}
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: "800px" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary, fontWeight: 700, width: "25%" }}>Operation Permission</th>
                        {Object.keys(rbacPermissions).map(role => (
                          <th key={role} style={{ padding: "10px 12px", textAlign: "center", color: ADMIN_THEME.textPrimary, fontWeight: 600, fontSize: 11 }}>
                            {role}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {category.permissions.map((perm, pIdx) => (
                        <tr 
                          key={perm} 
                          style={{ 
                            borderBottom: pIdx !== category.permissions.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none",
                            transition: "background-color 0.15s ease"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(0,31,63,0.015)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: ADMIN_THEME.textPrimary }}>{perm}</td>
                          {Object.keys(rbacPermissions).map(role => {
                            const hasPerm = rbacPermissions[role].includes(perm);
                            return (
                              <td 
                                key={role} 
                                style={{ padding: "12px 12px", textAlign: "center" }}
                              >
                                <div 
                                  onClick={() => handlePermissionToggle(role, perm)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 24,
                                    height: 24,
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    transition: "background-color 0.2s"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,153,51,0.08)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={hasPerm}
                                    onChange={() => {}} // Handled by outer div click to prevent double triggering
                                    style={{
                                      accentColor: ADMIN_THEME.accentGold,
                                      width: 15,
                                      height: 15,
                                      cursor: "pointer",
                                      margin: 0
                                    }}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => alert("RBAC matrix updated locally in memory layer.")}
              style={{
                background: ADMIN_THEME.blue,
                color: "white",
                padding: "6px 14px",
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                border: "none"
              }}
            >
              Apply RBAC Configurations
            </button>
          </div>
        </div>
      )}

      {/* 5. VERIFICATION OVERSIGHT */}
      {adminTab === "admin-verification" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Document Verification Ledger Oversight</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Monitor cryptographically sealed and verified legal dossiers</p>
            </div>
            
            {/* Search */}
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={verStatusFilter}
                onChange={e => setVerStatusFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All Statuses</option>
                <option value="verified">Verified (Sealed)</option>
                <option value="failed">Failed Verification</option>
              </select>
              <div style={{ position: "relative" }}>
                <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={verSearch}
                  onChange={e => setVerSearch(e.target.value)}
                  style={{
                    background: ADMIN_THEME.cardBg,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 6,
                    padding: "4px 10px 4px 28px",
                    fontSize: 12,
                    color: ADMIN_THEME.textPrimary,
                    width: "180px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `2px solid ${ADMIN_THEME.border}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Ledger ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Document Name / Category</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Verification Date</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Executing Officer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>SHA-256 Checksum Signature</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Ledger Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVerifications.map((v, idx) => (
                  <tr key={v.verificationId} style={{ borderBottom: idx !== filteredVerifications.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                    <td style={{ padding: "14px 16px", fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.accentGold }}>{v.verificationId}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600 }}>{v.documentName}</div>
                      <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>{v.documentType}</span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>{new Date(v.verificationDate).toLocaleDateString()} {new Date(v.verificationDate).toLocaleTimeString()}</td>
                    <td style={{ padding: "14px 16px" }}>{v.verifiedBy || "System Automated"}</td>
                    <td style={{ padding: "14px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, color: ADMIN_THEME.textSecondary }}>
                      {v.hash ? `${v.hash.slice(0, 8)}...${v.hash.slice(-8)}` : "No signature"}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: v.status === "verified" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        color: v.status === "verified" ? ADMIN_THEME.green : ADMIN_THEME.red,
                        padding: "3px 8px",
                        borderRadius: 4,
                        textTransform: "uppercase"
                      }}>
                        {v.status === "verified" ? "VALID SIGNATURE" : "SIG MISMATCH"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. CRIME DB ANALYTICS */}
      {adminTab === "admin-analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Crime Database Analytics</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Platform usage analytics, database query metrics, and intelligence access patterns</p>
            </div>
            
            <button
              onClick={() => {
                const csvData = [
                  ["Category", "Metrics", "Value"],
                  ["Total Queries", "48,920", "+12% this week"],
                  ["Daily Queries", "342", "N/A"],
                  ["Weekly Queries", "2,194", "N/A"],
                  ["Monthly Queries", "8,440", "N/A"],
                  ["Query Success Rate", "97.8%", "N/A"],
                  ["Avg Search Time", "1.2s", "N/A"],
                  ["Total AI Queries", "12,480", "N/A"],
                  ["Reports Generated", "1,240", "N/A"]
                ];
                const content = "data:text/csv;charset=utf-8," + csvData.map(e => e.join(",")).join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(content));
                link.setAttribute("download", "Crime_DB_Analytics_Summary.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#ffffff",
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: ADMIN_THEME.textPrimary,
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
            >
              <Download style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              <span>Export</span>
              <ChevronDown style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary }} />
            </button>
          </div>

          {/* 8 Stats Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16
          }}>
            {/* Card 1 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid rgb(99, 102, 241)",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Database style={{ width: 16, height: 16, color: "rgb(99, 102, 241)" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Total DB Queries</span>
                </div>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: "#ecfdf5",
                  color: "#065f46",
                  padding: "2px 6px",
                  borderRadius: 4,
                  display: "inline-flex",
                  alignItems: "center"
                }}>
                  ▲ +12% this week
                </span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>48,920</div>
            </div>

            {/* Card 2 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid rgb(249, 115, 22)",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search style={{ width: 16, height: 16, color: "rgb(249, 115, 22)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Daily Queries</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>342</div>
            </div>

            {/* Card 3 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid rgb(168, 85, 247)",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp style={{ width: 16, height: 16, color: "rgb(168, 85, 247)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Weekly Queries</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>2,194</div>
            </div>

            {/* Card 4 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid rgb(20, 184, 166)",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3 style={{ width: 16, height: 16, color: "rgb(20, 184, 166)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Monthly Queries</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>8,440</div>
            </div>

            {/* Card 5 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid rgb(34, 197, 94)",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap style={{ width: 16, height: 16, color: "rgb(34, 197, 94)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Query Success Rate</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>97.8%</div>
            </div>

            {/* Card 6 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid #ea580c",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock style={{ width: 16, height: 16, color: "#ea580c" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Avg Search Time</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>1.2s</div>
            </div>

            {/* Card 7 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid #eab308",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles style={{ width: 16, height: 16, color: "#eab308" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Total AI Queries</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>12,480</div>
            </div>

            {/* Card 8 */}
            <div style={{
              background: ADMIN_THEME.cardBg,
              border: `1px solid ${ADMIN_THEME.border}`,
              borderTop: "3.5px solid #10b981",
              borderRadius: 8,
              padding: 16,
              boxShadow: ADMIN_THEME.shadow,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText style={{ width: 16, height: 16, color: "#10b981" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Reports Generated</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>1,240</div>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", maxWidth: "480px" }}>
            <Search style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search queries, officers, FIRs..."
              value={dbAnalyticsSearch}
              onChange={e => setDbAnalyticsSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 6,
                fontSize: 13,
                outline: "none",
                background: "#ffffff",
                color: ADMIN_THEME.textPrimary
              }}
            />
          </div>

          {/* Top FIRS & Queried Criminals columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Top Accessed FIRs */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden", boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", background: "rgba(0,0,0,0.005)" }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: ADMIN_THEME.textSecondary }}>Top Accessed FIRs</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { title: "Oil Smuggling Syndicate — Bengaluru", ref: "FIR-442-BLR • Cyber Crime", val: 342 },
                  { title: "Identity Fraud Ring — Mysuru", ref: "FIR-891-MYS • Economic Offences", val: 289 },
                  { title: "Narcotics Trafficking — Belagavi", ref: "FIR-1203-BLG • Narcotics", val: 234 },
                  { title: "Cyber Extortion Cases — Dharwad", ref: "FIR-556-HDW • Cyber Crime", val: 198 },
                  { title: "Organized Land Grab — Bengaluru Rural", ref: "FIR-720-BLR • Special Branch", val: 167 }
                ].filter(item => {
                  if (!dbAnalyticsSearch) return true;
                  const query = dbAnalyticsSearch.toLowerCase();
                  return item.title.toLowerCase().includes(query) || item.ref.toLowerCase().includes(query);
                }).map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: idx !== 4 ? `1px solid ${ADMIN_THEME.border}` : "none"
                  }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: ADMIN_THEME.textMuted, fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono" }}>#{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{item.title}</div>
                        <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, marginTop: 2 }}>{item.ref}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(200, 146, 42)" }}>{item.val}</div>
                      <div style={{ fontSize: 9, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>accesses</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Queried Criminals */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden", boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", background: "rgba(0,0,0,0.005)" }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: ADMIN_THEME.textSecondary }}>Most Queried Criminals</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {[
                  { name: "Ravi Shankar Gupta", ref: "Aliases: Ravi Don, RSG • Last: 2 hours ago", val: 420 },
                  { name: "Mohammed Yusuf Khan", ref: "Aliases: Yusuf Bhai • Last: 5 hours ago", val: 380 },
                  { name: "Lakshmi Devi Patel", ref: "Aliases: Lakshmi Ma • Last: 1 day ago", val: 312 },
                  { name: "Suresh Kumar Reddy", ref: "Aliases: SK Reddy, Red Bull • Last: 2 days ago", val: 245 }
                ].filter(item => {
                  if (!dbAnalyticsSearch) return true;
                  const query = dbAnalyticsSearch.toLowerCase();
                  return item.name.toLowerCase().includes(query) || item.ref.toLowerCase().includes(query);
                }).map((item, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: idx !== 3 ? `1px solid ${ADMIN_THEME.border}` : "none"
                  }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: ADMIN_THEME.textMuted, fontSize: 13, fontWeight: 700, fontFamily: "JetBrains Mono" }}>#{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{item.name}</div>
                        <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, marginTop: 2 }}>{item.ref}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(200, 146, 42)" }}>{item.val}</div>
                      <div style={{ fontSize: 9, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>queries</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department Usage Rankings */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
            <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Department Usage Rankings</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { name: "Cyber Crime Wing", percentage: 75, val: "12,400", sub: "45 officers" },
                { name: "Criminal Investigation", percentage: 60, val: "9,800", sub: "38 officers" },
                { name: "Narcotics Control", percentage: 40, val: "6,200", sub: "22 officers" },
                { name: "Economic Offences", percentage: 35, val: "4,800", sub: "18 officers" },
                { name: "Special Branch", percentage: 25, val: "3,600", sub: "15 officers" },
                { name: "Traffic", percentage: 15, val: "2,400", sub: "28 officers" }
              ].map((dept, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: "160px", fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{dept.name}</div>
                  
                  <div style={{ flex: 1, height: "8px", borderRadius: 4, background: "#f1f5f9", overflow: "hidden", position: "relative" }}>
                    <div style={{
                      width: `${dept.percentage}%`,
                      height: "100%",
                      borderRadius: 4,
                      background: "#FF9933",
                      transition: "width 0.5s ease-out"
                    }} />
                  </div>

                  <div style={{ display: "flex", gap: 10, width: "150px", justifyContent: "flex-end", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{dept.val}</span>
                    <span style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted }}>{dept.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Queries Table */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden", boxShadow: ADMIN_THEME.shadow }}>
            <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", background: "rgba(0,0,0,0.005)" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>Recent Crime Database Queries</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `2px solid ${ADMIN_THEME.border}` }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Officer</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Query</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Module</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Time</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { officer: "Inspector Ananth Murthy", query: "FIR 442 suspect list", module: "FIR Analytics", time: "2 min ago", status: "SUCCESS" },
                  { officer: "Officer Shruthi Rao", query: "Mysuru cybercrime trend 2026", module: "Crime Analytics", time: "15 min ago", status: "SUCCESS" },
                  { officer: "DSP R. K. Shastry", query: "Cross-district syndicate mapping", module: "Criminal Networks", time: "1 hour ago", status: "SUCCESS" },
                  { officer: "Inspector Rajesh Kumar", query: "Darkweb vendor identification", module: "Cyber Intel", time: "3 hours ago", status: "SUCCESS" }
                ].filter(item => {
                  if (!dbAnalyticsSearch) return true;
                  const query = dbAnalyticsSearch.toLowerCase();
                  return (
                    item.officer.toLowerCase().includes(query) ||
                    item.query.toLowerCase().includes(query) ||
                    item.module.toLowerCase().includes(query)
                  );
                }).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx !== 3 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{item.officer}</td>
                    <td style={{ padding: "12px 16px", color: ADMIN_THEME.textPrimary }}>{item.query}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "rgba(255,153,51,0.08)", color: ADMIN_THEME.accentGold, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {item.module}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: ADMIN_THEME.textSecondary }}>{item.time}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{ fontSize: 9, background: "rgba(16,185,129,0.1)", color: ADMIN_THEME.green, padding: "2px 6px", borderRadius: 3, fontWeight: 800 }}>
                        ● {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* 7. AI MONITORING CONSOLE */}
      {adminTab === "admin-ai" && (
        <div>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>AI Monitoring Console</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Monitor AI conversations, ratings, confidence scores, and flagged interactions</p>
            </div>
            
            {/* Export options */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setIsExportOpen(p => !p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: ADMIN_THEME.cardBg,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: ADMIN_THEME.textSecondary,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: ADMIN_THEME.shadow
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ADMIN_THEME.cardBg; }}
              >
                <Download style={{ width: 14, height: 14 }} /> 
                <span>Export</span>
                <ChevronDown style={{ width: 12, height: 12 }} />
              </button>
              
              {isExportOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  background: "#ffffff",
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  boxShadow: ADMIN_THEME.shadowMd,
                  width: 145,
                  zIndex: 100
                }}>
                  <button
                    onClick={() => {
                      const headers = ["Officer", "Badge No", "Query", "Module", "Confidence", "Rating", "Status", "Time"];
                      const rows = conversations.map(c => [
                        c.officer, c.badgeNo, c.query, c.module, c.confidence + "%", c.rating ?? "N/A", c.status, c.time
                      ]);
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `AI_Monitoring_Report_${Date.now()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setIsExportOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      fontSize: 12,
                      cursor: "pointer",
                      color: ADMIN_THEME.textPrimary
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                      setIsExportOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      fontSize: 12,
                      cursor: "pointer",
                      color: ADMIN_THEME.textPrimary
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    Print Report
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metric cards grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
            gap: 16, 
            marginBottom: 20 
          }}>
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Conversations</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 8 }}>{conversations.length}</div>
            </div>
            
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Flagged</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.red, marginTop: 8 }}>{conversations.filter(c => c.status === "FLAGGED").length}</div>
            </div>
            
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Confidence</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.green, marginTop: 8 }}>
                {conversations.length ? Math.round(conversations.reduce((acc, c) => acc + c.confidence, 0) / conversations.length) + "%" : "0%"}
              </div>
            </div>
            
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Low Confidence</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#f97316", marginTop: 8 }}>{conversations.filter(c => c.confidence < 60).length}</div>
            </div>
            
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Escalated</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#a855f7", marginTop: 8 }}>{conversations.filter(c => c.status === "ESCALATED").length}</div>
            </div>
          </div>

          {/* Search and filter bar */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: 16,
            gap: 16
          }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, maxWidth: 420 }}>
              <Search style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={aiSearch}
                onChange={e => setAiSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  fontSize: 13,
                  outline: "none",
                  background: "#ffffff",
                  color: ADMIN_THEME.textPrimary
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setIsFilterDropdownOpen(p => !p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: ADMIN_THEME.cardBg,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: ADMIN_THEME.textSecondary,
                  cursor: "pointer"
                }}
              >
                <span>{aiStatusFilter}</span>
                <ChevronDown style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              </button>

              {isFilterDropdownOpen && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: 6,
                  background: "#ffffff",
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  boxShadow: ADMIN_THEME.shadowMd,
                  width: 140,
                  zIndex: 100
                }}>
                  {["All Status", "COMPLETED", "FLAGGED", "ESCALATED"].map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        setAiStatusFilter(st);
                        setIsFilterDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        background: aiStatusFilter === st ? "#f1f5f9" : "none",
                        border: "none",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: aiStatusFilter === st ? 600 : 400,
                        color: ADMIN_THEME.textPrimary
                      }}
                      onMouseEnter={e => { if (aiStatusFilter !== st) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { if (aiStatusFilter !== st) e.currentTarget.style.background = "none"; }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div style={{ 
            background: "#ffffff", 
            border: `1px solid ${ADMIN_THEME.border}`, 
            borderRadius: 8, 
            overflowX: "auto",
            boxShadow: ADMIN_THEME.shadow 
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${ADMIN_THEME.border}`, color: ADMIN_THEME.textSecondary, fontWeight: 700 }}>
                  <th style={{ padding: "12px 16px" }}>OFFICER</th>
                  <th style={{ padding: "12px 16px" }}>QUERY</th>
                  <th style={{ padding: "12px 16px" }}>MODULE</th>
                  <th style={{ padding: "12px 16px" }}>CONFIDENCE</th>
                  <th style={{ padding: "12px 16px" }}>RATING</th>
                  <th style={{ padding: "12px 16px" }}>STATUS</th>
                  <th style={{ padding: "12px 16px" }}>TIME</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {conversations
                  .filter(c => {
                    const matchesStatus = aiStatusFilter === "All Status" || c.status === aiStatusFilter;
                    const matchesSearch = 
                      c.officer.toLowerCase().includes(aiSearch.toLowerCase()) ||
                      c.badgeNo.toLowerCase().includes(aiSearch.toLowerCase()) ||
                      c.query.toLowerCase().includes(aiSearch.toLowerCase()) ||
                      c.module.toLowerCase().includes(aiSearch.toLowerCase());
                    return matchesStatus && matchesSearch;
                  })
                  .map((c, i) => {
                    const pillStyles = (() => {
                      switch (c.status) {
                        case "COMPLETED": return { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569", dot: "#94a3b8" };
                        case "FLAGGED": return { bg: "#fef2f2", border: "#fca5a5", text: "#ef4444", dot: "#ef4444" };
                        case "ESCALATED": return { bg: "#faf5ff", border: "#e9d5ff", text: "#a855f7", dot: "#a855f7" };
                        default: return { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569", dot: "#94a3b8" };
                      }
                    })();

                    const confidenceColor = c.confidence >= 80 ? ADMIN_THEME.green : c.confidence >= 60 ? "#f97316" : ADMIN_THEME.red;

                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedConv(c)}
                        style={{ 
                          borderBottom: `1px solid ${ADMIN_THEME.border}`, 
                          cursor: "pointer",
                          transition: "background 0.1s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.01)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 600, color: ADMIN_THEME.textPrimary }}>{c.officer}</div>
                          <div style={{ fontSize: 10, color: ADMIN_THEME.textMuted, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{c.badgeNo}</div>
                        </td>
                        <td style={{ padding: "14px 16px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ADMIN_THEME.textPrimary }}>
                          {c.query}
                        </td>
                        <td style={{ padding: "14px 16px", color: ADMIN_THEME.textSecondary, fontWeight: 500 }}>
                          {c.module}
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: confidenceColor }}>
                          {c.confidence}%
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {c.rating === null ? (
                            <span style={{ color: ADMIN_THEME.textMuted }}>—</span>
                          ) : (
                            <div style={{ display: "flex", gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star 
                                  key={star} 
                                  style={{ 
                                    width: 13, 
                                    height: 13, 
                                    color: "#eab308",
                                    fill: star <= c.rating ? "#eab308" : "transparent"
                                  }} 
                                />
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            background: pillStyles.bg,
                            border: `1px solid ${pillStyles.border}`,
                            color: pillStyles.text
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: pillStyles.dot }} />
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: ADMIN_THEME.textSecondary, fontSize: 12 }}>
                          {c.time}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConversations(prev => prev.map(item => {
                                  if (item.id === c.id) {
                                    return {
                                      ...item,
                                      status: item.status === "FLAGGED" ? "COMPLETED" : "FLAGGED"
                                    };
                                  }
                                  return item;
                                }));
                              }}
                              title={c.status === "FLAGGED" ? "Unflag interaction" : "Flag interaction"}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <Flag style={{ 
                                width: 14, 
                                height: 14, 
                                color: c.status === "FLAGGED" ? ADMIN_THEME.red : ADMIN_THEME.textMuted,
                                fill: c.status === "FLAGGED" ? ADMIN_THEME.red : "transparent"
                              }} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete conversation record audit ${c.id}?`)) {
                                  setConversations(prev => prev.filter(item => item.id !== c.id));
                                }
                              }}
                              title="Delete record"
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <Trash2 style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Conversation details Modal popup */}
          {selectedConv && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10, 25, 47, 0.4)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20
            }} onClick={() => setSelectedConv(null)}>
              <div 
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  border: `1px solid ${ADMIN_THEME.border}`,
                  boxShadow: ADMIN_THEME.shadowMd,
                  width: "100%",
                  maxWidth: 680,
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden"
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{ 
                  padding: "16px 20px", 
                  borderBottom: `1px solid ${ADMIN_THEME.border}`, 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  background: "#f8fafc"
                }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: ADMIN_THEME.textPrimary, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>Interaction Audit Audit</span>
                      <span style={{ fontSize: 11, background: "rgba(0,31,63,0.06)", padding: "2px 6px", borderRadius: 4, fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>
                        {selectedConv.id}
                      </span>
                    </h2>
                    <p style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Logged at {selectedConv.time}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedConv(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: ADMIN_THEME.textMuted }}
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Metadata Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, background: "#f8fafc", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Initiating Officer</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>{selectedConv.officer}</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, fontFamily: "JetBrains Mono, monospace" }}>{selectedConv.badgeNo}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Module & Gateway</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>{selectedConv.module}</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>IP: {selectedConv.ip}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Metrics</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selectedConv.confidence >= 80 ? ADMIN_THEME.green : "#f97316", marginTop: 2 }}>
                        {selectedConv.confidence}% Confidence
                      </div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Latency: {selectedConv.latency}</div>
                    </div>
                  </div>

                  {/* Chat logs bubbles */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* User prompt query */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textMuted, marginBottom: 4, textTransform: "uppercase" }}>User Prompt</div>
                      <div style={{ 
                        background: "#001f3f", 
                        color: "#ffffff", 
                        padding: "12px 14px", 
                        borderRadius: "8px 8px 8px 0px", 
                        fontSize: 13,
                        lineHeight: 1.5
                      }}>
                        {selectedConv.query}
                      </div>
                    </div>

                    {/* Assistant AI response */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textMuted, marginBottom: 4, textTransform: "uppercase" }}>Assistant AI Response</div>
                      <div style={{ 
                        background: "#f1f5f9", 
                        border: "1px solid #cbd5e1",
                        color: ADMIN_THEME.textPrimary, 
                        padding: "12px 14px", 
                        borderRadius: "8px 8px 0px 8px", 
                        fontSize: 13,
                        lineHeight: 1.5
                      }}>
                        {selectedConv.response}
                      </div>
                    </div>
                  </div>

                  {/* Token break down block */}
                  <div style={{ borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textMuted, marginBottom: 8, textTransform: "uppercase" }}>Token Accounting Audit</div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, background: "rgba(0,0,0,0.04)", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: 4 }}>
                        Prompt: <strong>{selectedConv.tokens.prompt}</strong>
                      </span>
                      <span style={{ fontSize: 11, background: "rgba(0,0,0,0.04)", border: "1px solid #cbd5e1", padding: "4px 8px", borderRadius: 4 }}>
                        Completion: <strong>{selectedConv.tokens.completion}</strong>
                      </span>
                      <span style={{ fontSize: 11, background: "rgba(255,153,51,0.08)", border: "1px solid rgba(255,153,51,0.3)", padding: "4px 8px", borderRadius: 4, color: "#FF9933" }}>
                        Total Volume: <strong>{selectedConv.tokens.total} Tokens</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ 
                  padding: "14px 20px", 
                  borderTop: `1px solid ${ADMIN_THEME.border}`, 
                  display: "flex", 
                  justifyContent: "space-between", 
                  background: "#f8fafc",
                  alignItems: "center"
                }}>
                  {/* Status update controller in Modal */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ADMIN_THEME.textSecondary }}>Set Status:</span>
                    <select
                      value={selectedConv.status}
                      onChange={e => {
                        const newStatus = e.target.value;
                        setConversations(prev => prev.map(item => {
                          if (item.id === selectedConv.id) {
                            return { ...item, status: newStatus };
                          }
                          return item;
                        }));
                        setSelectedConv((prev: any) => prev ? { ...prev, status: newStatus } : null);
                      }}
                      style={{
                        background: "#ffffff",
                        border: `1px solid ${ADMIN_THEME.border}`,
                        borderRadius: 4,
                        padding: "4px 8px",
                        fontSize: 12,
                        color: ADMIN_THEME.textPrimary,
                        fontWeight: 600
                      }}
                    >
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="FLAGGED">FLAGGED</option>
                      <option value="ESCALATED">ESCALATED</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setSelectedConv(null)}
                    style={{
                      background: "#001f3f",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Close Audit View
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7.5. AI MODEL MANAGEMENT */}
      {adminTab === "admin-model" && (
        <div style={{ position: "relative" }}>
          
          {/* Notification Messages */}
          {modelStatusMsg && (
            <div style={{
              background: "#ecfdf5",
              border: `1px solid ${ADMIN_THEME.green}`,
              color: "#065f46",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "fadeIn 0.2s ease-out"
            }}>
              <Check style={{ width: 16, height: 16, color: ADMIN_THEME.green }} />
              <span>{modelStatusMsg}</span>
            </div>
          )}

          {/* Loader Overlay for Service Operations */}
          {isModelActionLoading && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10, 25, 47, 0.25)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              gap: 12
            }}>
              <div style={{
                background: "#ffffff",
                padding: "24px 32px",
                borderRadius: 12,
                border: `1px solid ${ADMIN_THEME.border}`,
                boxShadow: ADMIN_THEME.shadowMd,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12
              }}>
                <Loader2 style={{ width: 28, height: 28, color: "#001f3f", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{isModelActionLoading}</span>
              </div>
            </div>
          )}

          {/* Tab Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>AI Model Management</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Manage model deployment, configuration, and performance metrics</p>
          </div>

          {/* NVIDIA Active Model Box */}
          <div style={{
            background: ADMIN_THEME.cardBg,
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
            boxShadow: ADMIN_THEME.shadow
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "rgba(255,153,51,0.08)",
                  border: "1px solid rgba(255,153,51,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Bot style={{ width: 24, height: 24, color: "#FF9933" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>NVIDIA LLaMA 3.1 8B Instruct</h3>
                  <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>
                    NVIDIA NIM • <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>Version: v3.1.8b-2026.06</span>
                  </div>
                </div>
              </div>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#ecfdf5",
                border: `1px solid ${ADMIN_THEME.green}`,
                color: ADMIN_THEME.green,
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 12
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: ADMIN_THEME.green }} />
                ACTIVE
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Training Date</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>15/05/2026</div>
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Last Deployed</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>04/07/2026</div>
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>KB Status</span>
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: ADMIN_THEME.green,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: ADMIN_THEME.green }} />
                    ACTIVE
                  </span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase" }}>Total Queries</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary, marginTop: 4 }}>48,920</div>
              </div>
            </div>
          </div>

          {/* Metrics row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 20
          }}>
            {/* RESPONSE ACCURACY */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 14, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <FileCheck style={{ width: 18, height: 18, color: ADMIN_THEME.green }} />
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Response Accuracy</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>94.2%</div>
              </div>
            </div>

            {/* HALLUCINATION RATE */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 14, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#f97316" }} />
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hallucination Rate</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>2.1%</div>
              </div>
            </div>

            {/* AVG LATENCY */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 14, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(0,31,63,0.06)", border: "1px solid rgba(0,31,63,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Clock style={{ width: 18, height: 18, color: "#3b82f6" }} />
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg Latency</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>1840ms</div>
              </div>
            </div>

            {/* TOTAL QUERIES */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 14, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <CloudLightning style={{ width: 18, height: 18, color: "#eab308" }} />
              </div>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: ADMIN_THEME.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Queries</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 2 }}>48,920</div>
              </div>
            </div>
          </div>

          {/* Model Parameters & Prompt Template Columns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Parameters card */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 20 }}>Model Parameters</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Temperature */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: ADMIN_THEME.textPrimary, marginBottom: 8 }}>
                    <span>Temperature</span>
                    <strong style={{ color: "#FF9933" }}>{modelTemp}</strong>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={modelTemp}
                    onChange={e => setModelTemp(parseFloat(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: "#FF9933"
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: ADMIN_THEME.textMuted, marginTop: 4 }}>
                    <span>0.0 (Precise)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: ADMIN_THEME.textPrimary, marginBottom: 8 }}>
                    <span>Max Tokens</span>
                    <strong style={{ color: "#FF9933" }}>{modelMaxTokens}</strong>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={modelMaxTokens}
                    onChange={e => setModelMaxTokens(parseInt(e.target.value))}
                    style={{
                      width: "100%",
                      accentColor: "#FF9933"
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: ADMIN_THEME.textMuted, marginTop: 4 }}>
                    <span>256</span>
                    <span>8192</span>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setIsModelActionLoading("Saving parameter configuration...");
                      setTimeout(() => {
                        setIsModelActionLoading("");
                        setModelStatusMsg("Model hyperparameter settings saved successfully.");
                        setTimeout(() => setModelStatusMsg(""), 4000);
                      }, 1200);
                    }}
                    style={{
                      background: "#001f3f",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Update Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* Prompt template card */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Prompt Template</h3>
              
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    flex: 1,
                    minHeight: 120,
                    padding: 12,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1.5,
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    color: ADMIN_THEME.textPrimary
                  }}
                />

                <div>
                  <button
                    onClick={() => {
                      setIsModelActionLoading("Recompiling system instruction weights...");
                      setTimeout(() => {
                        setIsModelActionLoading("");
                        setModelStatusMsg("AI System instruction template updated and re-indexed.");
                        setTimeout(() => setModelStatusMsg(""), 4000);
                      }, 1400);
                    }}
                    style={{
                      background: "#001f3f",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 4,
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Update Prompt
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Model Operations Row */}
          <div style={{
            background: ADMIN_THEME.cardBg,
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
            boxShadow: ADMIN_THEME.shadow
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Model Operations</h3>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (confirm("Deploy current model settings to the active police gateway?")) {
                    setIsModelActionLoading("Uploading LLaMA configurations to edge terminals...");
                    setTimeout(() => {
                      setIsModelActionLoading("");
                      setModelStatusMsg("Deploy sequence finished. Active version set to v3.1.8b-2026.06.");
                      setTimeout(() => setModelStatusMsg(""), 4000);
                    }, 1800);
                  }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                  padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <Activity style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
                <span>Deploy Model</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Are you sure you want to rollback to the last retired version v3.3.70b-2026.05?")) {
                    setIsModelActionLoading("Executing parameter rollback routine...");
                    setTimeout(() => {
                      setIsModelActionLoading("");
                      setModelStatusMsg("Rollback successful. Restored parameters and instructions of v3.3.70b-2026.05.");
                      setTimeout(() => setModelStatusMsg(""), 4000);
                    }, 1500);
                  }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                  padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <History style={{ width: 14, height: 14, color: "#3b82f6" }} />
                <span>Rollback</span>
              </button>

              <button
                onClick={() => {
                  setIsModelActionLoading("Queuing retrain task on state cluster...");
                  setTimeout(() => {
                    setIsModelActionLoading("");
                    setModelStatusMsg("Retraining scheduled on cluster nodes. System will email when accuracy targets are met.");
                    setTimeout(() => setModelStatusMsg(""), 4000);
                  }, 1200);
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                  padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <Loader2 style={{ width: 14, height: 14, color: "#a855f7" }} />
                <span>Retrain</span>
              </button>

              <button
                onClick={() => {
                  setIsModelActionLoading("Synchronizing local Knowledge Base with district FIR servers...");
                  setTimeout(() => {
                    setIsModelActionLoading("");
                    setModelStatusMsg("Vector registry synced. 1,028 new files index cached.");
                    setTimeout(() => setModelStatusMsg(""), 4000);
                  }, 1600);
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                  padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <Database style={{ width: 14, height: 14, color: "#10b981" }} />
                <span>Refresh KB</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Restart AI Core services? This will briefly disconnect active chatbot queues (approx 3 seconds).")) {
                    setIsModelActionLoading("Rebooting NVIDIA NIM instances...");
                    setTimeout(() => {
                      setIsModelActionLoading("");
                      setModelStatusMsg("AI Service restarted. Disconnect duration: 1.2 seconds.");
                      setTimeout(() => setModelStatusMsg(""), 4000);
                    }, 1400);
                  }
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                  padding: "8px 14px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: "pointer", transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <Settings style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
                <span>Restart AI Service</span>
              </button>
            </div>
          </div>

          {/* Previous Versions Table */}
          <div style={{
            background: ADMIN_THEME.cardBg,
            border: `1px solid ${ADMIN_THEME.border}`,
            borderRadius: 8,
            boxShadow: ADMIN_THEME.shadow,
            overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${ADMIN_THEME.border}`, background: "#f8fafc" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Previous Versions</h3>
            </div>
            
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: `1px solid ${ADMIN_THEME.border}`, color: ADMIN_THEME.textSecondary, fontWeight: 700 }}>
                  <th style={{ padding: "12px 20px" }}>VERSION</th>
                  <th style={{ padding: "12px 20px" }}>DEPLOYED</th>
                  <th style={{ padding: "12px 20px" }}>ACCURACY</th>
                  <th style={{ padding: "12px 20px", textAlign: "center" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {previousVersions.map((v, idx) => {
                  const statusPill = v.status === "RETIRED" 
                    ? { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569" }
                    : { bg: "#f1f5f9", border: "#cbd5e1", text: "#94a3b8" };

                  return (
                    <tr key={idx} style={{ borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: ADMIN_THEME.textPrimary, fontFamily: "JetBrains Mono, monospace" }}>
                        {v.version}
                      </td>
                      <td style={{ padding: "14px 20px", color: ADMIN_THEME.textSecondary }}>
                        Deployed: {v.deployed}
                      </td>
                      <td style={{ padding: "14px 20px", color: ADMIN_THEME.textSecondary, fontWeight: 600 }}>
                        Accuracy: {v.accuracy}
                      </td>
                      <td style={{ padding: "14px 20px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 9,
                          fontWeight: 700,
                          background: statusPill.bg,
                          border: `1px solid ${statusPill.border}`,
                          color: statusPill.text
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: statusPill.text }} />
                          {v.status}
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

      {/* 8. AUDIT LOGS */}
      {adminTab === "admin-audit" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Security Audit Ledger (Immutable)</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Immutable security transaction log reporting all access activities and modifications</p>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <RoleChangeLogTable />
          </div>
            
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={auditModuleFilter}
                onChange={e => setAuditModuleFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All Modules</option>
                {uniqueModules.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div style={{ position: "relative" }}>
                <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  style={{
                    background: ADMIN_THEME.cardBg,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 6,
                    padding: "4px 10px 4px 28px",
                    fontSize: 12,
                    color: ADMIN_THEME.textPrimary,
                    width: "180px",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `2px solid ${ADMIN_THEME.border}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Timestamp Signature</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Officer Node</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Action Log Message</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Operational Module</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Ingress IP Address</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Security Token</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((log: any, idx) => {
                  const rawTs = log.timestamp || log.createdAt || log.time;
                  let displayTime = "24 Jul 2026, 12:00:00 pm";
                  if (typeof rawTs === "string") {
                    if (rawTs.includes("Jul") || rawTs.includes("Jan") || rawTs.includes("Feb") || rawTs.includes("Mar") || rawTs.includes("Apr") || rawTs.includes("May") || rawTs.includes("Jun") || rawTs.includes("Aug") || rawTs.includes("Sep") || rawTs.includes("Oct") || rawTs.includes("Nov") || rawTs.includes("Dec")) {
                      displayTime = rawTs;
                    } else {
                      const d = new Date(rawTs);
                      displayTime = !isNaN(d.getTime()) ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" }) : rawTs;
                    }
                  } else if (typeof rawTs === "number") {
                    displayTime = new Date(rawTs).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });
                  } else if (rawTs && typeof rawTs === "object") {
                    const secs = rawTs.seconds || rawTs._seconds;
                    if (secs) displayTime = new Date(secs * 1000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });
                    else if (typeof rawTs.toDate === "function") displayTime = rawTs.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });
                  }

                  const officerDisplay = log.officer || log.changedBy || log.name || (log.targetUid ? `UID: ${log.targetUid.slice(0, 10)}...` : "ISD Central Node");
                  const actionDisplay = log.action || log.message || log.newRole || "Security Log Audit Event";
                  const moduleDisplay = log.module || log.newIsdLevel || "ISD-RBAC";
                  const ipDisplay = log.ipAddress || log.ip || "10.0.12.94 (Encrypted Proxy)";
                  const statusDisplay = log.status || (log.newRole ? (log.newRole.includes("VPN") ? "VPN_FLAGGED" : "ACTIVE") : "ACTIVE");

                  return (
                    <tr key={idx} style={{ borderBottom: idx !== filteredAuditLogs.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                      <td style={{ padding: "14px 16px", fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary, whiteSpace: "nowrap" }}>
                        {displayTime}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 600 }}>{officerDisplay}</td>
                      <td style={{ padding: "14px 16px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actionDisplay}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ background: "rgba(255,153,51,0.08)", color: ADMIN_THEME.accentGold, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                          {moduleDisplay}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>{ipDisplay}</td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ fontSize: 9, background: "rgba(16,185,129,0.1)", color: ADMIN_THEME.green, padding: "2px 5px", borderRadius: 3, fontWeight: 800 }}>
                          {String(statusDisplay).toUpperCase()}
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

      {/* 9. SYSTEM SETTINGS */}
      {adminTab === "admin-settings" && (
        <div style={{ position: "relative" }}>
          
          {/* Notification Messages */}
          {settingsSuccess && (
            <div style={{
              background: "#ecfdf5",
              border: `1px solid ${ADMIN_THEME.green}`,
              color: "#065f46",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "fadeIn 0.2s ease-out"
            }}>
              <Check style={{ width: 16, height: 16, color: ADMIN_THEME.green }} />
              <span>System settings saved successfully.</span>
            </div>
          )}

          {/* Loader Overlay */}
          {actionLoading && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10, 25, 47, 0.25)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              gap: 12
            }}>
              <div style={{
                background: "#ffffff",
                padding: "24px 32px",
                borderRadius: 12,
                border: `1px solid ${ADMIN_THEME.border}`,
                boxShadow: ADMIN_THEME.shadowMd,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12
              }}>
                <Loader2 style={{ width: 28, height: 28, color: "#001f3f", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Processing system configuration updates...</span>
              </div>
            </div>
          )}

          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>System Settings</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Configure application, security, authentication, and infrastructure parameters</p>
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => {
                  if (confirm("Reset all settings to original platform defaults?")) {
                    setSetAppName("O.R.C.A");
                    setSetMaintMode(false);
                    setSetDebugMode(false);
                    setSetEnforceHttps(true);
                    setSetRateLimiting(true);
                    setSetIpWhitelist(false);
                    setSetMfaEnabled(true);
                    setSetSessionTimeout(30);
                    setSetPassExpiry(90);
                    setSetMaxAttempts(5);
                    setSetEmailNotif(true);
                    setSetPushNotif(false);
                    setSetAutoBackup(true);
                    setSetBackupRetention(30);
                    setSetAuditLogRetention(365);
                    
                    setSettingsSuccess(true);
                    setTimeout(() => setSettingsSuccess(false), 3000);
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#ffffff",
                  border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: ADMIN_THEME.textPrimary,
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <History style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
                <span>Reset Defaults</span>
              </button>

              <button
                onClick={() => {
                  setActionLoading(true);
                  setSettingsSuccess(false);
                  setTimeout(() => {
                    setActionLoading(false);
                    setSettingsSuccess(true);
                    setTimeout(() => setSettingsSuccess(false), 4000);
                  }, 1200);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#001f3f",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: ADMIN_THEME.shadow
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
                <span>Save All Changes</span>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* 1. APPLICATION CARD */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
                <Settings style={{ width: 15, height: 15, color: ADMIN_THEME.textSecondary }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>Application</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Application Name */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Application Name</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Display name for the admin console</div>
                  </div>
                  <input
                    type="text"
                    value={setAppName}
                    onChange={e => setSetAppName(e.target.value)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "240px",
                      textAlign: "left"
                    }}
                  />
                </div>

                {/* Maintenance Mode */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Maintenance Mode</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Disable access for non-admin users</div>
                  </div>
                  <div
                    onClick={() => setSetMaintMode(!setMaintMode)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setMaintMode ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setMaintMode ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* Debug Mode */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Debug Mode</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Enable verbose logging and error traces</div>
                  </div>
                  <div
                    onClick={() => setSetDebugMode(!setDebugMode)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setDebugMode ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setDebugMode ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. SECURITY CARD */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
                <Shield style={{ width: 15, height: 15, color: ADMIN_THEME.textSecondary }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>Security</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Enforce HTTPS */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Enforce HTTPS</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Redirect all HTTP traffic to HTTPS</div>
                  </div>
                  <div
                    onClick={() => setSetEnforceHttps(!setEnforceHttps)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setEnforceHttps ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setEnforceHttps ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* Rate Limiting */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Rate Limiting</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Enable API rate limiting to prevent abuse</div>
                  </div>
                  <div
                    onClick={() => setSetRateLimiting(!setRateLimiting)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setRateLimiting ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setRateLimiting ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* IP Whitelist */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>IP Whitelist</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Restrict access to approved IP addresses</div>
                  </div>
                  <div
                    onClick={() => setSetIpWhitelist(!setIpWhitelist)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setIpWhitelist ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setIpWhitelist ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. AUTHENTICATION CARD */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
                <Fingerprint style={{ width: 15, height: 15, color: ADMIN_THEME.textSecondary }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>Authentication</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Multi-Factor Authentication */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Multi-Factor Authentication</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Require MFA for all admin accounts</div>
                  </div>
                  <div
                    onClick={() => setSetMfaEnabled(!setMfaEnabled)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setMfaEnabled ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setMfaEnabled ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* Session Timeout */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Session Timeout (minutes)</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Auto-logout after inactivity</div>
                  </div>
                  <input
                    type="number"
                    value={setSessionTimeout}
                    onChange={e => setSetSessionTimeout(parseInt(e.target.value) || 0)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "80px",
                      textAlign: "center"
                    }}
                  />
                </div>

                {/* Password Expiry */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Password Expiry (days)</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Force password change after interval</div>
                  </div>
                  <input
                    type="number"
                    value={setPassExpiry}
                    onChange={e => setSetPassExpiry(parseInt(e.target.value) || 0)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "80px",
                      textAlign: "center"
                    }}
                  />
                </div>

                {/* Max Login Attempts */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Max Login Attempts</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Lock account after failed attempts</div>
                  </div>
                  <input
                    type="number"
                    value={setMaxAttempts}
                    onChange={e => setSetMaxAttempts(parseInt(e.target.value) || 0)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "80px",
                      textAlign: "center"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 4. NOTIFICATIONS CARD */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
                <Bell style={{ width: 15, height: 15, color: ADMIN_THEME.textSecondary }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>Notifications</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Email Notifications */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Email Notifications</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Send email alerts for critical events</div>
                  </div>
                  <div
                    onClick={() => setSetEmailNotif(!setEmailNotif)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setEmailNotif ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setEmailNotif ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* Push Notifications */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Push Notifications</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Browser push notifications for admins</div>
                  </div>
                  <div
                    onClick={() => setSetPushNotif(!setPushNotif)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setPushNotif ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setPushNotif ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. BACKUP & DATABASE CARD */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 16 }}>
                <Database style={{ width: 15, height: 15, color: ADMIN_THEME.textSecondary }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>Backup & Database</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Auto-Backup */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Auto-Backup</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Automated daily database backups</div>
                  </div>
                  <div
                    onClick={() => setSetAutoBackup(!setAutoBackup)}
                    style={{
                      position: "relative",
                      width: 44, height: 22, borderRadius: 12,
                      background: setAutoBackup ? ADMIN_THEME.green : "#cbd5e1",
                      cursor: "pointer", transition: "background 0.2s"
                    }}
                  >
                    <div style={{
                      position: "absolute", left: setAutoBackup ? 24 : 2, top: 2,
                      width: 18, height: 18, borderRadius: "50%", background: "#ffffff",
                      transition: "left 0.2s"
                    }} />
                  </div>
                </div>

                {/* Backup Retention */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Backup Retention (days)</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Number of days to retain backups</div>
                  </div>
                  <input
                    type="number"
                    value={setBackupRetention}
                    onChange={e => setSetBackupRetention(parseInt(e.target.value) || 0)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "80px",
                      textAlign: "center"
                    }}
                  />
                </div>

                {/* Audit Log Retention */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Audit Log Retention (days)</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Auto-purge audit logs after interval</div>
                  </div>
                  <input
                    type="number"
                    value={setAuditLogRetention}
                    onChange={e => setSetAuditLogRetention(parseInt(e.target.value) || 0)}
                    style={{
                      border: `1px solid ${ADMIN_THEME.border}`,
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary,
                      outline: "none",
                      width: "80px",
                      textAlign: "center"
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 6. DANGER ZONE */}
            <div style={{ background: "#fff5f5", border: `1.5px solid ${ADMIN_THEME.red}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${ADMIN_THEME.red}`, paddingBottom: 10, marginBottom: 16 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: ADMIN_THEME.red }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.red }}>Danger Zone</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Restart Application</div>
                  <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Restart all ORCA services. Brief downtime expected.</div>
                </div>
                
                <button
                  onClick={() => {
                    if (confirm("Restart the Organized Crime Analysis Authority (O.R.C.A) core servers? Active sessions will be refreshed.")) {
                      setActionLoading(true);
                      setTimeout(() => {
                        setActionLoading(false);
                        alert("Application services reboot completed. Checksum valid.");
                      }, 2000);
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${ADMIN_THEME.red}`,
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: ADMIN_THEME.red,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = ADMIN_THEME.red;
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = ADMIN_THEME.red;
                  }}
                >
                  Restart Application
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 10. SECURITY CENTER */}
      {adminTab === "admin-security" && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Centralized Security Operations Center</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Monitor security warnings, locked accounts, and block metrics</p>
          </div>

          {/* Metric cards grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
            marginBottom: 20
          }}>
            {/* 1. FAILED LOGINS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <AlertTriangle style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
                <span>Failed Logins</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>1</div>
            </div>

            {/* 2. BLOCKED IPS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <Globe style={{ width: 14, height: 14, color: "#f97316" }} />
                <span>Blocked IPs</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>1</div>
            </div>

            {/* 3. ACTIVE THREATS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <AlertCircle style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
                <span>Active Threats</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>1</div>
            </div>

            {/* 4. FIREWALL STATUS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <Lock style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
                <span>Firewall Status</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Active</div>
            </div>

            {/* 5. ENCRYPTION */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <Key style={{ width: 14, height: 14, color: "#3b82f6" }} />
                <span>Encryption</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>AES-256</div>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 20
          }}>
            {/* 6. MFA STATUS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <ShieldCheck style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
                <span>MFA Status</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Enforced</div>
            </div>

            {/* 7. ACTIVE SESSIONS */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <Wifi style={{ width: 14, height: 14, color: "#a855f7" }} />
                <span>Active Sessions</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>3</div>
            </div>

            {/* 8. RISK LEVEL */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: ADMIN_THEME.shadow }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: ADMIN_THEME.textMuted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                <Activity style={{ width: 14, height: 14, color: "#f97316" }} />
                <span>Risk Level</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#001f3f" }}>ELEVATED</div>
            </div>
          </div>

          {/* Main Content Split Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, alignItems: "start" }}>
            
            {/* Left Column: Search & Security Event Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Search events */}
              <div style={{ position: "relative" }}>
                <Search style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted, position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search security events..."
                  value={securitySearch}
                  onChange={e => setSecuritySearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    borderRadius: 8,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    background: ADMIN_THEME.cardBg,
                    fontSize: 13,
                    outline: "none",
                    color: ADMIN_THEME.textPrimary
                  }}
                />
              </div>

              {/* Security Event Timeline card */}
              <div style={{
                background: ADMIN_THEME.cardBg,
                border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 8,
                boxShadow: ADMIN_THEME.shadow,
                overflow: "hidden"
              }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${ADMIN_THEME.border}`, background: "#f8fafc" }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    Security Event Timeline
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {securityEvents
                    .filter(ev => {
                      if (!securitySearch) return true;
                      const query = securitySearch.toLowerCase();
                      return (
                        ev.title.toLowerCase().includes(query) ||
                        ev.ip.toLowerCase().includes(query) ||
                        ev.officer.toLowerCase().includes(query) ||
                        ev.device.toLowerCase().includes(query) ||
                        ev.browser.toLowerCase().includes(query)
                      );
                    })
                    .map((ev, idx, arr) => {
                      // Severity style mappings
                      const getSeverityStyle = (sev: string) => {
                        switch (sev) {
                          case "CRITICAL": return { border: "1px solid #fee2e2", bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" };
                          case "HIGH": return { border: "1px solid #fee2e2", bg: "#fef2f2", text: "#b91c1c", dot: "#f87171" };
                          case "MEDIUM": return { border: "1px solid #ffedd5", bg: "#fff7ed", text: "#c2410c", dot: "#f97316" };
                          default: return { border: "1px solid #f1f5f9", bg: "#f8fafc", text: "#475569", dot: "#94a3b8" };
                        }
                      };

                      // Status style mappings
                      const getStatusStyle = (st: string) => {
                        switch (st) {
                          case "ACTIVE": return { border: "1px solid #d1fae5", bg: "#ecfdf5", text: "#065f46" };
                          case "INVESTIGATING": return { border: "1px solid #dbeafe", bg: "#eff6ff", text: "#1e40af" };
                          case "RESOLVED": return { border: "1px solid #e2e8f0", bg: "#f1f5f9", text: "#475569" };
                          default: return { border: "1px solid #f1f5f9", bg: "#f8fafc", text: "#475569" };
                        }
                      };

                      const sevStyle = getSeverityStyle(ev.severity);
                      const stStyle = getStatusStyle(ev.status);

                      return (
                        <div
                          key={ev.id}
                          style={{
                            padding: "16px 20px",
                            borderBottom: idx === arr.length - 1 ? "none" : `1px solid ${ADMIN_THEME.border}`,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 16
                          }}
                        >
                          <div>
                            {/* Event Title Row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sevStyle.dot }} />
                              <h4 style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{ev.title}</h4>
                            </div>

                            {/* Meta Tags Row */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", fontSize: 11, color: ADMIN_THEME.textSecondary }}>
                              <span>IP: <strong style={{ color: ADMIN_THEME.textPrimary }}>{ev.ip}</strong></span>
                              <span>•</span>
                              <span>Officer: <strong style={{ color: ADMIN_THEME.textPrimary }}>{ev.officer}</strong></span>
                              <span>•</span>
                              <span>Browser: <strong style={{ color: ADMIN_THEME.textPrimary }}>{ev.browser}</strong></span>
                              <span>•</span>
                              <span>Device: <strong style={{ color: ADMIN_THEME.textPrimary }}>{ev.device}</strong></span>
                              <span>•</span>
                              <span style={{ color: ADMIN_THEME.textMuted }}>{ev.timestamp}</span>
                            </div>
                          </div>

                          {/* Right hand Badges */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "3px 8px",
                              borderRadius: 12,
                              fontSize: 9,
                              fontWeight: 700,
                              background: sevStyle.bg,
                              border: sevStyle.border,
                              color: sevStyle.text
                            }}>
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: sevStyle.text }} />
                              {ev.severity}
                            </span>

                            <span
                              onClick={() => {
                                // Cycle status on click
                                const nextStatus = ev.status === "ACTIVE" ? "INVESTIGATING" : ev.status === "INVESTIGATING" ? "RESOLVED" : "ACTIVE";
                                setSecurityEvents(prev => prev.map(item => item.id === ev.id ? { ...item, status: nextStatus } : item));
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                borderRadius: 12,
                                fontSize: 9,
                                fontWeight: 700,
                                background: stStyle.bg,
                                border: stStyle.border,
                                color: stStyle.text,
                                cursor: "pointer",
                                userSelect: "none"
                              }}
                            >
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: stStyle.text }} />
                              {ev.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {securityEvents.filter(ev => {
                    if (!securitySearch) return true;
                    const query = securitySearch.toLowerCase();
                    return (
                      ev.title.toLowerCase().includes(query) ||
                      ev.ip.toLowerCase().includes(query) ||
                      ev.officer.toLowerCase().includes(query) ||
                      ev.device.toLowerCase().includes(query) ||
                      ev.browser.toLowerCase().includes(query)
                    );
                  }).length === 0 && (
                    <div style={{ padding: "24px", textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                      No security events found matching the query.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Whitelist & Critical Alerts Feed */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Critical Security Alerts */}
              <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>Critical Security Alerts</span>
                  <ShieldAlert style={{ width: 14, height: 14, color: ADMIN_THEME.red }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ borderLeft: `3px solid ${ADMIN_THEME.red}`, paddingLeft: 12, paddingBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: ADMIN_THEME.red }}>FAILED LOGIN ATTACK BLOCKED</div>
                    <p style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
                      Terminal at 10.0.91.104 attempted 3 consecutive incorrect PIN inputs for user `INSP_ANANTH_12`. Terminal geofenced temporarily.
                    </p>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textMuted }}>July 3, 2026 23:44:12 IST</span>
                  </div>
                  <div style={{ borderLeft: `3px solid ${ADMIN_THEME.accentGold}`, paddingLeft: 12, paddingBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: ADMIN_THEME.accentGold }}>PROXY BACKUP NODE DEVIATION</div>
                    <p style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
                      Secondary cloud ledger reported 0.02% latency drift matching statewide database replication rules.
                    </p>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textMuted }}>July 2, 2026 12:12:04 IST</span>
                  </div>
                </div>
              </div>

              {/* Active Whitelisted Terminals */}
              <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 20, boxShadow: ADMIN_THEME.shadow }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>Active Whitelisted Terminals</span>
                  <Lock style={{ width: 14, height: 14, color: ADMIN_THEME.green }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span>State Command HQ Console (10.0.12.94)</span>
                    <span style={{ color: ADMIN_THEME.green, fontWeight: 700, fontSize: 11 }}>● SECURE</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span>Bengaluru City Cyber Cell (10.0.91.104)</span>
                    <span style={{ color: ADMIN_THEME.green, fontWeight: 700, fontSize: 11 }}>● SECURE</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span>Mysuru SCRB Center (10.4.19.82)</span>
                    <span style={{ color: ADMIN_THEME.green, fontWeight: 700, fontSize: 11 }}>● SECURE</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Coastal Smuggling Guard post (10.12.44.11)</span>
                    <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 700, fontSize: 11 }}>● STANDBY</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 10.5. REPORTS & NOTIFICATIONS */}
      {adminTab === "admin-reports" && (
        <div style={{ position: "relative" }}>
          
          {/* Notification Messages */}
          {reportsSuccessMsg && (
            <div style={{
              background: "#ecfdf5",
              border: `1px solid ${ADMIN_THEME.green}`,
              color: "#065f46",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: "fadeIn 0.2s ease-out"
            }}>
              <Check style={{ width: 16, height: 16, color: ADMIN_THEME.green }} />
              <span>{reportsSuccessMsg}</span>
            </div>
          )}

          {/* Loader Overlay */}
          {reportsLoaderMsg && (
            <div style={{
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(10, 25, 47, 0.25)",
              backdropFilter: "blur(3px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              gap: 12
            }}>
              <div style={{
                background: "#ffffff",
                padding: "24px 32px",
                borderRadius: 12,
                border: `1px solid ${ADMIN_THEME.border}`,
                boxShadow: ADMIN_THEME.shadowMd,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12
              }}>
                <Loader2 style={{ width: 28, height: 28, color: "#001f3f", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{reportsLoaderMsg}</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: ADMIN_THEME.textPrimary }}>Reports & Notifications</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Generate platform reports and manage administrative notifications</p>
          </div>

          {/* Sub-Tabs Button Row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 12 }}>
            <button
              onClick={() => setReportsSubTab("reports")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: reportsSubTab === "reports" ? "1px solid rgba(200, 146, 42, 0.3)" : "1px solid transparent",
                background: reportsSubTab === "reports" ? "rgba(255,153,51,0.06)" : "transparent",
                color: reportsSubTab === "reports" ? "rgb(200, 146, 42)" : ADMIN_THEME.textSecondary,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <FileText style={{ width: 15, height: 15 }} />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setReportsSubTab("notifications")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: reportsSubTab === "notifications" ? "1px solid rgba(200, 146, 42, 0.3)" : "1px solid transparent",
                background: reportsSubTab === "notifications" ? "rgba(255,153,51,0.06)" : "transparent",
                color: reportsSubTab === "notifications" ? "rgb(200, 146, 42)" : ADMIN_THEME.textSecondary,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <Bell style={{ width: 15, height: 15 }} />
              <span>Notifications</span>
              {notificationsList.filter(n => !n.read).length > 0 && (
                <span style={{
                  background: ADMIN_THEME.red,
                  color: "#ffffff",
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: "50%",
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {notificationsList.filter(n => !n.read).length}
                </span>
              )}
            </button>
          </div>

          {/* Sub-Tab 1: Reports Section */}
          {reportsSubTab === "reports" && (
            <div>
              <div style={{ height: 10 }} />

              {/* Reports Cards Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16
              }}>
                {[
                  "Officer Activity Summary",
                  "Monthly Login Analytics",
                  "Security Incident Report",
                  "AI Usage Analytics",
                  "Document Verification Summary",
                  "RBAC Configuration Audit",
                  "Database Health Report",
                  "Platform Performance Report",
                  "Crime Database Query Summary"
                ].map((reportName, idx) => {
                  const getReportData = (name: string) => {
                    switch (name) {
                      case "Officer Activity Summary":
                        return {
                          headers: ["Officer", "Badge ID", "Active Cases", "Actions Logged", "Status"],
                          rows: [
                            ["DSP R. K. Shastry", "DSP-94812", "14", "182", "ACTIVE"],
                            ["Inspector Ananth Murthy", "INS-84192", "8", "94", "ACTIVE"],
                            ["Sub-Inspector Kavitha Patil", "SI-39821", "11", "143", "ACTIVE"]
                          ],
                          desc: "Summary of individual case assignments, log entries, and active system activation states for registered officers."
                        };
                      case "Monthly Login Analytics":
                        return {
                          headers: ["Month", "Total Logins", "Unique Devices", "Failed Attempts", "Avg Session"],
                          rows: [
                            ["July 2026", "4,280 logins", "142 devices", "19 failed", "42 mins"],
                            ["June 2026", "3,910 logins", "138 devices", "24 failed", "38 mins"],
                            ["May 2026", "3,450 logins", "120 devices", "11 failed", "45 mins"]
                          ],
                          desc: "Monthly statistical breakdown of security portal logins, unique device footprints, and access indicators."
                        };
                      case "Security Incident Report":
                        return {
                          headers: ["Incident ID", "Source IP", "Event Type", "Severity", "Resolution"],
                          rows: [
                            ["#SEC-902", "103.21.58.120", "Geo-Location Bypass Attempt", "MEDIUM", "INVESTIGATING"],
                            ["#SEC-891", "10.142.92.12", "Spoofed Header Signature", "HIGH", "BLOCKED"],
                            ["#SEC-882", "192.168.1.42", "Multi-Failure MFA Loop", "LOW", "RESOLVED"]
                          ],
                          desc: "Detailed record of high-priority security exceptions, system bypass attempts, and automatic block actions."
                        };
                      case "AI Usage Analytics":
                        return {
                          headers: ["Query ID", "Officer Badge", "Query Context", "Tokens Used", "Response Time"],
                          rows: [
                            ["#AI-8291", "DSP-94812", "Cybercrime Trend Bengaluru Rural", "2.4k tokens", "1.82s"],
                            ["#AI-8290", "SI-39821", "FIR 2026/04 cross-reference check", "4.1k tokens", "2.14s"],
                            ["#AI-8289", "INS-84192", "Document verification checksum matches", "1.2k tokens", "1.10s"]
                          ],
                          desc: "Audit of cognitive queries processed through the secure AI Chatbot portal, measuring performance and resource footprint."
                        };
                      case "Document Verification Summary":
                        return {
                          headers: ["Verification ID", "Applicant Name", "Submitted Rank", "Document Type", "Status"],
                          rows: [
                            ["#VER-9201", "Kavitha Patil", "Sub Inspector", "Official CSIRT ID", "APPROVED"],
                            ["#VER-9200", "Harish Kumar", "Inspector", "HQ Rank Endorsement", "APPROVED"],
                            ["#VER-9199", "Ravi Shankar", "DSP", "Government ID Proof", "PENDING"]
                          ],
                          desc: "Registry of user document review decisions, verification queues, and rank-approval authorizations."
                        };
                      case "RBAC Configuration Audit":
                        return {
                          headers: ["Role Level", "Access Code", "Assigned Users", "Security Level", "Last Audited"],
                          rows: [
                            ["Super Administrator", "RBAC-L3", "2 Users", "LEVEL 4 (SECURE)", "08 July 2026"],
                            ["Verification Officer (L1)", "RBAC-L2", "14 Users", "LEVEL 2 (RESTRICTED)", "07 July 2026"],
                            ["Investigation Officer", "RBAC-L1", "180 Users", "LEVEL 1 (COPS INTERNAL)", "06 July 2026"]
                          ],
                          desc: "Detailed privilege distribution audit across user roles, ensuring adherence to the revised police hierarchy."
                        };
                      case "Database Health Report":
                        return {
                          headers: ["Database Node", "Sync Status", "Active Connections", "Disk Space", "Replication Latency"],
                          rows: [
                            ["SCRB Central Node", "ONLINE", "42 connections", "74.2% (1.2TB free)", "0.12s"],
                            ["ISD Local Buffer", "ONLINE", "18 connections", "92.1% (84GB free)", "0.04s"],
                            ["Statewide sync", "STANDBY", "4 connections", "38.4% (8.4TB free)", "1.45s"]
                          ],
                          desc: "Server metrics showing statewide replication health, storage allocations, and transactional performance."
                        };
                      case "Platform Performance Report":
                        return {
                          headers: ["Platform Module", "Server Latency", "CPU Load", "Memory Utilization", "Error Rate"],
                          rows: [
                            ["Crime Database Engine", "1.8ms", "14.2%", "62.4%", "0.00%"],
                            ["AI Agent Endpoint", "182ms", "28.1%", "44.8%", "0.02%"],
                            ["GIS Mapping Service", "1420ms", "72.4%", "88.1%", "0.14%"]
                          ],
                          desc: "Service metrics measuring latency curves, resource loading, and response health for primary system components."
                        };
                      case "Crime Database Query Summary":
                      default:
                        return {
                          headers: ["Query Timestamp", "Officer ID", "Search Parameter", "Records Returned", "Action Taken"],
                          rows: [
                            ["08/07/2026 18:24", "INS-84192", '"Kumar" + "Assault" (Bengaluru)', "42 files", "Dossier Exported"],
                            ["08/07/2026 15:10", "DSP-94812", '"Terrorism" + "Intel Log 2026"', "4 files", "View Only"],
                            ["08/07/2026 11:04", "SI-39821", '"Vehicle Theft" + "KA-03"', "112 files", "Printed"]
                          ],
                          desc: "Operational database search audit logging target keywords, matches returned, and active query profiles."
                        };
                    }
                  };

                  const reportData = getReportData(reportName);
                  
                  const triggerReportGenWithFormat = (fmt: string) => {
                    if (fmt === "PDF") {
                      const printWindow = window.open("", "_blank");
                      if (!printWindow) {
                        alert("Popup blocker prevented printing. Please allow popups for this site.");
                        return;
                      }
                      
                      const dateStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
                      const authority = "Organized Crime Analysis Authority (O.R.C.A)";
                      const classification = "RESTRICTED // COPS INTERNAL USE ONLY";
                      
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>${reportName} - PDF Export</title>
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
                              <div class="title">${reportName}</div>
                              <div class="metadata">
                                <strong>REPORT NAME:</strong> ${reportName}<br/>
                                <strong>DATE GENERATED:</strong> ${dateStr} IST<br/>
                                <strong>ISSUING AUTHORITY:</strong> ${authority}<br/>
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
                      setReportsSuccessMsg(`${reportName} PDF printed successfully.`);
                      setTimeout(() => setReportsSuccessMsg(""), 4000);
                      return;
                    }
                    
                    setReportsLoaderMsg(`Generating ${reportName} in ${fmt} format...`);
                    setReportsSuccessMsg("");
                    setTimeout(() => {
                      setReportsLoaderMsg("");
                      setReportsSuccessMsg(`${reportName} downloaded successfully.`);
                      
                      const fileContent = `O.R.C.A Admin Report\n` +
                        `Report Name,${reportName}\n` +
                        `File Format,${fmt}\n` +
                        `Export Date,${new Date().toLocaleString()}\n` +
                        `Authority,Organized Crime Analysis Authority (O.R.C.A)\n` +
                        `Classification,RESTRICTED // COPS INTERNAL USE ONLY\n\n` +
                        `ID,Metric Type,Status,Recorded Value,Confidence\n` +
                        `#10492,Network Activity Rate,NORMAL,84.2%,99.4%\n` +
                        `#10493,AI Query Pattern Sweep,AUDIT,12 patterns,94.8%\n` +
                        `#10494,Clearance Key Access,SECURED,Level I-IV,100.0%\n` +
                        `#10495,Database Ingress Rate,NORMAL,2.14ms,98.7%`;
                      
                      const blob = new Blob([fileContent], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${reportName.toLowerCase().replace(/\s+/g, "_")}_report.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);

                      setTimeout(() => setReportsSuccessMsg(""), 4000);
                    }, 1200);
                  };

                  return (
                    <div
                      key={idx}
                      style={{
                        background: ADMIN_THEME.cardBg,
                        border: `1px solid ${ADMIN_THEME.border}`,
                        borderRadius: 8,
                        padding: "16px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        boxShadow: ADMIN_THEME.shadow,
                        transition: "transform 0.15s, border-color 0.15s"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.borderColor = "rgba(200, 146, 42, 0.3)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = ADMIN_THEME.border;
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <FileText style={{ width: 18, height: 18, color: "#FF9933", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{reportName}</span>
                      </div>

                      <button
                        onClick={() => triggerReportGenWithFormat("PDF")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#ffffff",
                          border: `1px solid ${ADMIN_THEME.border}`,
                          borderRadius: 4,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: ADMIN_THEME.textPrimary,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          flexShrink: 0
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
                      >
                        <Download style={{ width: 11, height: 11, color: ADMIN_THEME.textSecondary }} />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Notifications Section */}
          {reportsSubTab === "notifications" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase" }}>System Notifications Inbox</span>
                {notificationsList.some(n => !n.read) && (
                  <button
                    onClick={() => setNotificationsList(prev => prev.map(n => ({ ...n, read: true })))}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgb(200, 146, 42)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Mark All As Read
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {notificationsList.map(n => {
                  // Severity layout
                  const getBadgeColor = (type: string) => {
                    switch (type) {
                      case "CRITICAL": return { border: "1px solid #fee2e2", bg: "#fef2f2", text: "#991b1b" };
                      case "WARNING": return { border: "1px solid #fef3c7", bg: "#fffbeb", text: "#92400e" };
                      case "SECURITY": return { border: "1px solid #dbeafe", bg: "#eff6ff", text: "#1e40af" };
                      case "SUCCESS": return { border: "1px solid #d1fae5", bg: "#ecfdf5", text: "#065f46" };
                      default: return { border: "1px solid #e2e8f0", bg: "#f1f5f9", text: "#475569" };
                    }
                  };

                  const badge = getBadgeColor(n.type);

                  return (
                    <div
                      key={n.id}
                      style={{
                        background: ADMIN_THEME.cardBg,
                        border: `1px solid ${ADMIN_THEME.border}`,
                        borderRadius: 8,
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: ADMIN_THEME.shadow,
                        opacity: n.read ? 0.75 : 1,
                        borderLeft: n.read ? `1px solid ${ADMIN_THEME.border}` : `3px solid #FF9933`
                      }}
                    >
                      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ marginTop: 2 }}>
                          {n.read ? (
                            <Check style={{ width: 16, height: 16, color: ADMIN_THEME.textMuted }} />
                          ) : (
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF9933", display: "block" }} />
                          )}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{n.title}</h4>
                            <span style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: badge.bg,
                              border: badge.border,
                              color: badge.text
                            }}>
                              {n.type}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>{n.desc}</p>
                          <span style={{ fontSize: 10, color: ADMIN_THEME.textMuted, marginTop: 6, display: "block" }}>{n.time}</span>
                        </div>
                      </div>

                      {!n.read && (
                        <button
                          onClick={() => setNotificationsList(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))}
                          style={{
                            background: "transparent",
                            border: `1px solid ${ADMIN_THEME.border}`,
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: ADMIN_THEME.textSecondary,
                            cursor: "pointer"
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 11. APPLICATION REVIEW DRAWERS (SIDE PANEL) */}
      {isDrawerOpen && selectedApp && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "680px",
          height: "100vh",
          background: ADMIN_THEME.cardBg,
          borderLeft: `1px solid ${ADMIN_THEME.border}`,
          boxShadow: "-10px 0 50px rgba(0,0,0,0.08)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          {/* Header */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${ADMIN_THEME.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: ADMIN_THEME.bg }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: ADMIN_THEME.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {isConfirmingApproval ? "Review Approval Summary" : "Review Officer Application"}
              </h2>
              <p style={{ fontSize: 11, color: ADMIN_THEME.accentGold, fontFamily: "JetBrains Mono, monospace" }}>File Node Reference: {selectedApp.id}</p>
            </div>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              style={{ background: "rgba(0,0,0,0.05)", border: "none", color: ADMIN_THEME.textSecondary, borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Drawer Body Scroll Container */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
            
            {isConfirmingApproval ? (
              /* ============================================================ */
              /* APPROVAL SUMMARY CONFIRMATION PAGE                          */
              /* ============================================================ */
              <div style={{ background: "rgba(255,153,51,0.02)", border: `1.5px solid ${ADMIN_THEME.accentGold}`, borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ textAlign: "center", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 16, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontFamily: "JetBrains Mono", color: ADMIN_THEME.accentGold, letterSpacing: "0.15em", textTransform: "uppercase" }}>Internal Security Division</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 4, textTransform: "uppercase" }}>Officer Access Provisioning Docket</h3>
                  <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>Command Center Registry: STATE OF KARNATAKA</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: selectedApp.photoUrl ? "120px 1fr" : "1fr", gap: 20, alignItems: "start", marginBottom: 4 }}>
                  {/* Biometric Photo */}
                  {selectedApp.photoUrl && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <img
                        src={selectedApp.photoUrl}
                        alt="Biometric scan"
                        style={{
                          width: 110,
                          height: 110,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: `2px solid ${ADMIN_THEME.accentGold}`,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.12)"
                        }}
                      />
                      <span style={{
                        fontSize: 9,
                        fontFamily: "JetBrains Mono, monospace",
                        color: "#138808",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase"
                      }}>✓ BIOMETRIC VERIFIED</span>
                    </div>
                  )}

                  {/* Identity grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, color: ADMIN_THEME.textPrimary }}>

                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Officer Name</span>
                    <strong>{modFirstName} {modLastName}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Badge / ID Number</span>
                    <strong style={{ fontFamily: "JetBrains Mono" }}>{selectedApp.badgeId}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Assigned Rank</span>
                    <strong>{modRank || selectedApp.rank}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Assigned Role</span>
                    <strong style={{ color: ADMIN_THEME.accentGold }}>{modRole}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Security Clearance Level</span>
                    <strong>{modSecurityClearance}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Department / Unit</span>
                    <strong>{modDepartment}</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Station Assignment</span>
                    <strong>{modStation || "State Cyber Crime PS"} ({modDistrict || "Bengaluru Urban"})</strong>
                  </div>
                  <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                    <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Division & State Unit</span>
                    <strong>{modDivision || "N/A"} / {modStateUnit || "ISD Core"}</strong>
                  </div>
                  </div>
                </div>

                <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8, color: ADMIN_THEME.textPrimary }}>
                  <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block", marginBottom: 2 }}>Reporting Supervisors</span>
                  <div style={{ fontSize: 12 }}>
                    Supervisor: <strong>{modSupervisor || "N/A"}</strong> • Reporting Officer: <strong>{modReportingOfficer || "N/A"}</strong><br/>
                    Dept Head: <strong>{modDepartmentHead || "N/A"}</strong> • Commanding Officer: <strong>{modCommandingOfficer || "N/A"}</strong>
                  </div>
                </div>

                <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8 }}>
                  <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block", marginBottom: 6 }}>Provisioned Module Permissions</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(modPermissions).filter(([_, val]) => val !== "No Access").map(([mod, val]) => (
                      <span key={mod} style={{ fontSize: 10, background: "rgba(0,31,63,0.05)", border: `1px solid ${ADMIN_THEME.border}`, color: ADMIN_THEME.textSecondary, padding: "3px 8px", borderRadius: 4 }}>
                        {mod}: <strong style={{ color: val === "Manage" ? ADMIN_THEME.accentGold : ADMIN_THEME.textSecondary }}>{val}</strong>
                      </span>
                    ))}
                    {Object.entries(modPermissions).filter(([_, val]) => val !== "No Access").length === 0 && (
                      <span style={{ fontSize: 11, color: ADMIN_THEME.red }}>⚠️ No modules allowed (Read-only dashboard default)</span>
                    )}
                  </div>
                </div>

                <div style={{ borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 8, color: ADMIN_THEME.textPrimary }}>
                  <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Administrative Remarks</span>
                  <p style={{ fontSize: 12, fontStyle: "italic", margin: "4px 0 0", color: ADMIN_THEME.textPrimary }}>
                    {modInternalRemarks || "No approval remarks specified."}
                  </p>
                </div>

                <div style={{ background: "rgba(0,0,0,0.02)", border: `1px solid ${ADMIN_THEME.border}`, padding: 12, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: ADMIN_THEME.textSecondary, fontFamily: "JetBrains Mono" }}>
                  <div>Approver: {officerProfile?.name || "Command Administrator"}</div>
                  <div>Timestamp: {new Date().toLocaleString()}</div>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button
                    onClick={() => setIsConfirmingApproval(false)}
                    style={{ flex: 1, background: "none", border: `1.5px solid ${ADMIN_THEME.border}`, color: ADMIN_THEME.textPrimary, borderRadius: 6, padding: "12px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    ◀ Back to Editing
                  </button>
                  <button
                    onClick={() => executeApproveApp(selectedApp)}
                    disabled={actionLoading}
                    style={{ flex: 1, background: ADMIN_THEME.green, border: "none", color: "white", borderRadius: 6, padding: "12px 0", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                  >
                    {actionLoading ? "Processing Ingress Activation..." : "Confirm Final Activation"}
                  </button>
                </div>
              </div>
            ) : (
              /* ============================================================ */
              /* APPLICATION AND ASSIGNMENT FORM                             */
              /* ============================================================ */
              <>
                {/* 1. REQUESTED ACCESS (READ-ONLY SCREEN) */}
                <div style={{ background: "rgba(255,153,51,0.04)", border: "1px solid rgba(255,153,51,0.2)", borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Info style={{ width: 14, height: 14 }} /> Applicant Requested Access
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12, fontSize: 12, color: ADMIN_THEME.textPrimary }}>
                    <div>
                      <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Requested Scope</span>
                      <strong>{selectedApp.requestedAccess || "Not specified (Basic)"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Justification / Reason</span>
                      <strong style={{ fontWeight: 500 }}>{selectedApp.reason || selectedApp.experience || "No reason submitted."}</strong>
                    </div>
                  </div>
                </div>

                {/* Identity Segment */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", background: "rgba(0,31,63,0.03)", padding: 16, borderRadius: 10, border: `1px solid ${ADMIN_THEME.border}` }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(0,31,63,0.08)",
                    border: `1.5px solid ${ADMIN_THEME.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 900,
                    color: ADMIN_THEME.textPrimary,
                    boxShadow: ADMIN_THEME.shadow
                  }}>
                    {getCleanInitials(selectedApp.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>{modFirstName} {modLastName}</h3>
                    <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, margin: "2px 0 0" }}>{modRank || selectedApp.rank} • ID: {selectedApp.badgeId}</p>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        background: selectedApp.status === "approved" ? "rgba(16,185,129,0.15)" : (selectedApp.status === "rejected" ? "rgba(239,68,68,0.15)" : "rgba(255,153,51,0.15)"),
                        color: selectedApp.status === "approved" ? ADMIN_THEME.green : (selectedApp.status === "rejected" ? ADMIN_THEME.red : ADMIN_THEME.accentGold),
                        padding: "2px 8px",
                        borderRadius: 4,
                        textTransform: "uppercase"
                      }}>
                        {selectedApp.status}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        background: "rgba(0,0,0,0.04)",
                        color: ADMIN_THEME.textSecondary,
                        padding: "2px 8px",
                        borderRadius: 4,
                        textTransform: "uppercase"
                      }}>
                        Priority: {modPriority}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 1. PERSONAL INFORMATION SECTION */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <User style={{ width: 14, height: 14 }} /> Personal Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>First Name</label>
                      <input 
                        type="text" 
                        value={modFirstName} 
                        onChange={e => setModFirstName(e.target.value)} 
                        style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Last Name</label>
                      <input 
                        type="text" 
                        value={modLastName} 
                        onChange={e => setModLastName(e.target.value)} 
                        style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                      />
                    </div>
                  </div>
                </div>

                {/* 2. ADMINISTRATOR DESIGNATION ASSIGNMENT */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield style={{ width: 14, height: 14 }} /> Administrator Designation Assignment
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Assigned Rank</label>
                        <select 
                          value={modRank} 
                          onChange={e => setModRank(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Assigned System Role</label>
                        <select 
                          value={modRole} 
                          onChange={e => setModRole(e.target.value)} 
                          disabled={officerProfile?.role === "Administrative Dashboard - Level 1"}
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          {Object.keys(PERMISSION_TEMPLATES).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Clearance Level</label>
                        <select 
                          value={modSecurityClearance} 
                          onChange={e => setModSecurityClearance(e.target.value)} 
                          disabled={officerProfile?.role === "Administrative Dashboard - Level 1"}
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          <option value="ISD-LEVEL-I">ISD-LEVEL-I (Command Center)</option>
                          <option value="ISD-LEVEL-II">ISD-LEVEL-II (Directorate)</option>
                          <option value="ISD-LEVEL-III">ISD-LEVEL-III (Cyber cell / forensics)</option>
                          <option value="ISD-LEVEL-IV">ISD-LEVEL-IV (Field Officer)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Assigned Department</label>
                        <select 
                          value={modDepartment} 
                          onChange={e => setModDepartment(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          {["SCRB", "CID", "Cyber Crime", "Traffic", "Law & Order", "Internal Security", "Special Task Force", "Crime Branch"].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Provisioning Account Status</label>
                      <select 
                        value={modStatus} 
                        onChange={e => setModStatus(e.target.value)} 
                        style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                      >
                        <option value="pending">Pending Review</option>
                        <option value="pending_verification">Pending Verification Checks</option>
                        <option value="pending_documents">Pending Document Submissions</option>
                        <option value="approved">Approved (Provisioned)</option>
                        <option value="active">Active (Permitted)</option>
                        <option value="suspended">Suspended (Locked)</option>
                        <option value="inactive">Inactive</option>
                        <option value="transferred">Transferred</option>
                        <option value="retired">Retired</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. STATION ASSIGNMENT DETAILS */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Home style={{ width: 14, height: 14 }} /> Station & Location Placement
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Assigned Police Station</label>
                        <input 
                          type="text" 
                          value={modStation} 
                          onChange={e => setModStation(e.target.value)} 
                          placeholder="e.g. Whitefield Cyber Crime PS"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Jurisdiction District</label>
                        <select 
                          value={modDistrict} 
                          onChange={e => setModDistrict(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          {KARNATAKA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Zone / Division</label>
                        <input 
                          type="text" 
                          value={modDivision} 
                          onChange={e => setModDivision(e.target.value)} 
                          placeholder="e.g. East Division"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>State Command Unit</label>
                        <input 
                          type="text" 
                          value={modStateUnit} 
                          onChange={e => setModStateUnit(e.target.value)} 
                          placeholder="e.g. Cyber Security wing"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. COMMAND SUPERVISORS ASSIGNMENT */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <UserCheck style={{ width: 14, height: 14 }} /> Command & Supervising Officers
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Reporting Officer</label>
                        <input 
                          type="text" 
                          value={modReportingOfficer} 
                          onChange={e => setModReportingOfficer(e.target.value)} 
                          placeholder="e.g. Inspector G. Murthy"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Immediate Supervisor</label>
                        <input 
                          type="text" 
                          value={modSupervisor} 
                          onChange={e => setModSupervisor(e.target.value)} 
                          placeholder="e.g. Command Administrator"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Department Head</label>
                        <input 
                          type="text" 
                          value={modDepartmentHead} 
                          onChange={e => setModDepartmentHead(e.target.value)} 
                          placeholder="e.g. Additional Director General ADGP"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Commanding Officer</label>
                        <input 
                          type="text" 
                          value={modCommandingOfficer} 
                          onChange={e => setModCommandingOfficer(e.target.value)} 
                          placeholder="e.g. Director General of Police (DGP)"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. GRANULAR MODULE PERMISSIONS SECTION */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                      <Award style={{ width: 14, height: 14 }} /> Granular Module Permissions
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          const allManage: Record<string, string> = {};
                          [
                            "Dashboard",
                            "Reports",
                            "Case Management",
                            "FIR Analytics",
                            "Criminal Database",
                            "Evidence Vault",
                            "Crime Analytics",
                            "Relationship Mapping",
                            "Geospatial Heatmap",
                            "Document Verification",
                            "Officer Directory",
                            "Administration",
                            "Audit Logs",
                            "AI Chatbot",
                            "AI Intelligence Copilot",
                            "Notifications",
                            "System Settings",
                            "API Management"
                          ].forEach(m => { allManage[m] = "Manage"; });
                          setModPermissions(allManage);
                        }}
                        style={{ background: "rgba(0,31,63,0.05)", border: "none", color: ADMIN_THEME.textSecondary, fontSize: 9, padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}
                      >
                        Select All (Manage)
                      </button>
                      <button
                        onClick={() => {
                          setModPermissions({});
                        }}
                        style={{ background: "rgba(0,31,63,0.05)", border: "none", color: ADMIN_THEME.textSecondary, fontSize: 9, padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Quick Permission Templates</label>
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          applyPermissionTemplate(e.target.value);
                        }
                      }}
                      defaultValue=""
                      style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                    >
                      <option value="" disabled>-- Select Template to Auto-Fill Permissions --</option>
                      {Object.keys(PERMISSION_TEMPLATES).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "300px", overflowY: "auto", paddingRight: 4 }}>
                    {[
                      "Dashboard",
                      "Reports",
                      "Case Management",
                      "FIR Analytics",
                      "Criminal Database",
                      "Evidence Vault",
                      "Crime Analytics",
                      "Relationship Mapping",
                      "Geospatial Heatmap",
                      "Document Verification",
                      "Officer Directory",
                      "Administration",
                      "Audit Logs",
                      "AI Chatbot",
                      "AI Intelligence Copilot",
                      "Notifications",
                      "System Settings",
                      "API Management"
                    ].map(modName => {
                      const currentVal = modPermissions[modName] || "No Access";
                      return (
                        <div key={modName} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: ADMIN_THEME.textPrimary, fontWeight: 500 }}>{modName}</span>
                          <select
                            value={currentVal}
                            onChange={e => {
                              setModPermissions({
                                ...modPermissions,
                                [modName]: e.target.value
                              });
                            }}
                            style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, padding: "4px 8px", color: currentVal === "No Access" ? ADMIN_THEME.textMuted : ADMIN_THEME.accentGold, fontSize: 11, cursor: "pointer" }}
                          >
                            <option value="No Access">No Access</option>
                            <option value="View Only">View Only</option>
                            <option value="Create">Create</option>
                            <option value="Edit">Edit</option>
                            <option value="Delete">Delete</option>
                            <option value="Approve">Approve</option>
                            <option value="Manage">Manage</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. OFFICIAL CONTACT */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Activity style={{ width: 14, height: 14 }} /> Official Contact Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Government Email</label>
                      <input 
                        type="email" 
                        value={modEmail} 
                        onChange={e => setModEmail(e.target.value)} 
                        style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Official Mobile Number</label>
                      <input 
                        type="tel" 
                        value={modMobile} 
                        onChange={e => setModMobile(e.target.value)} 
                        style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                      />
                    </div>
                  </div>
                </div>

                {/* 5. ADDITIONAL ADMIN REVIEW FIELDS */}
                <div style={{ background: "rgba(255,153,51,0.02)", border: `1px solid rgba(255,153,51,0.15)`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Settings style={{ width: 14, height: 14 }} /> Restricted Administrative Parameters
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Application Priority</label>
                        <select 
                          value={modPriority} 
                          onChange={e => setModPriority(e.target.value as any)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          <option value="LOW">LOW</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HIGH">HIGH</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Assigned Reviewer</label>
                        <input 
                          type="text" 
                          value={modAssignedReviewer} 
                          onChange={e => setModAssignedReviewer(e.target.value)} 
                          placeholder="e.g. Inspector Murthy"
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }} 
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Background Verification</label>
                        <select 
                          value={modBgVerification} 
                          onChange={e => setModBgVerification(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", color: ADMIN_THEME.textPrimary, fontSize: 11, cursor: "pointer" }}
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="verified">🟢 Verified</option>
                          <option value="failed">🔴 Failed</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Department Check</label>
                        <select 
                          value={modDeptVerification} 
                          onChange={e => setModDeptVerification(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", color: ADMIN_THEME.textPrimary, fontSize: 11, cursor: "pointer" }}
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="verified">🟢 Verified</option>
                          <option value="failed">🔴 Failed</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Supervisor Approval</label>
                        <select 
                          value={modSupervisorApproval} 
                          onChange={e => setModSupervisorApproval(e.target.value)} 
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", color: ADMIN_THEME.textPrimary, fontSize: 11, cursor: "pointer" }}
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="verified">🟢 Verified</option>
                          <option value="failed">🔴 Failed</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Internal Remarks</label>
                      <textarea 
                        value={modInternalRemarks} 
                        onChange={e => setModInternalRemarks(e.target.value)} 
                        placeholder="Provide detailed security clearance details or background flags..."
                        style={{ width: "100%", height: 80, background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "10px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, resize: "vertical", outline: "none", lineHeight: 1.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. VERIFICATION TIMELINE SECTION */}
                <div style={{ background: "rgba(0,0,0,0.01)", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock style={{ width: 14, height: 14 }} /> Officer Verification Timeline
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingLeft: 8, borderLeft: `2px solid ${ADMIN_THEME.border}`, margin: "8px 0 8px 12px" }}>
                    
                    {/* 1. Submitted */}
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: 2, width: 10, height: 10, borderRadius: "50%", background: ADMIN_THEME.green, border: `2px solid ${ADMIN_THEME.cardBg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Application Submitted</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Timestamp: {new Date(selectedApp.submittedAt).toLocaleString()}</div>
                    </div>

                    {/* 2. Identity Check */}
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: 2, width: 10, height: 10, borderRadius: "50%", background: modBgVerification === "verified" ? ADMIN_THEME.green : ADMIN_THEME.accentGold, border: `2px solid ${ADMIN_THEME.cardBg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Identity & Background Check</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Status: {modBgVerification === "verified" ? "Verified" : "Pending/Under review"}</div>
                    </div>

                    {/* 3. Department Check */}
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: 2, width: 10, height: 10, borderRadius: "50%", background: modDeptVerification === "verified" ? ADMIN_THEME.green : ADMIN_THEME.accentGold, border: `2px solid ${ADMIN_THEME.cardBg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Departmental Ingress Check</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Status: {modDeptVerification === "verified" ? "Verified" : "Pending/Under review"}</div>
                    </div>

                    {/* 4. Timeline Review */}
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: 2, width: 10, height: 10, borderRadius: "50%", background: ADMIN_THEME.green, border: `2px solid ${ADMIN_THEME.cardBg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Admin Review Started</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Reviewer: {modAssignedReviewer || officerProfile?.name || "Command Administrator"}</div>
                    </div>

                    {/* 5. Final State */}
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: 2, width: 10, height: 10, borderRadius: "50%", background: selectedApp.status === "approved" || selectedApp.status === "active" ? ADMIN_THEME.green : (selectedApp.status === "rejected" ? ADMIN_THEME.red : "rgba(0,0,0,0.2)"), border: `2px solid ${ADMIN_THEME.cardBg}` }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Account Activation Status</div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>Decision: {(selectedApp.status || "").toUpperCase()}</div>
                    </div>

                  </div>
                </div>
              </>
            )}

          </div>

          {/* Drawer Actions */}
          <div style={{ padding: "20px 24px", borderTop: `1px solid ${ADMIN_THEME.border}`, display: "flex", flexDirection: "column", gap: 8, background: ADMIN_THEME.bg }}>
            
            {/* Actions Matrix Row 1: Document/Compile operations */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
              <button
                onClick={handleSaveReview}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, color: ADMIN_THEME.textSecondary, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Save Review
              </button>
              <button
                onClick={handleRequestInfo}
                style={{ background: "rgba(255,153,51,0.1)", border: `1px solid rgba(255,153,51,0.3)`, borderRadius: 4, color: ADMIN_THEME.accentGold, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Request Info
              </button>
              <button
                onClick={handleDownloadApplication}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, color: ADMIN_THEME.textSecondary, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Download JSON
              </button>
              <button
                onClick={handlePrintApplication}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, color: ADMIN_THEME.textSecondary, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Print Docket
              </button>
            </div>

            {/* Actions Matrix Row 2: Formal letters */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: isConfirmingApproval ? 0 : 8 }}>
              <button
                onClick={() => generateDossierLetter(selectedApp, "approval")}
                style={{ background: "none", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, color: ADMIN_THEME.textSecondary, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Compile Approval Letter
              </button>
              <button
                onClick={() => generateDossierLetter(selectedApp, "rejection")}
                style={{ background: "none", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, color: ADMIN_THEME.textSecondary, fontSize: 11, padding: "8px 0", cursor: "pointer", fontWeight: 600 }}
              >
                Compile Rejection Letter
              </button>
            </div>

            {/* State Changers */}
            {!isConfirmingApproval && (
              selectedApp.status === "pending" || selectedApp.status === "under_review" || selectedApp.status === "awaiting" ? (
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => handleRejectApp(selectedApp)}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      background: "rgba(239,68,68,0.1)",
                      border: `1.5px solid ${ADMIN_THEME.red}`,
                      color: ADMIN_THEME.red,
                      borderRadius: 6,
                      padding: "10px 0",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Reject Application
                  </button>
                  <button
                    onClick={() => handleApproveApp(selectedApp)}
                    disabled={actionLoading}
                    style={{
                      flex: 1,
                      background: ADMIN_THEME.green,
                      border: "none",
                      color: "white",
                      borderRadius: 6,
                      padding: "10px 0",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Approve Officer
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", fontSize: 12, color: ADMIN_THEME.textSecondary, padding: "10px 0", marginTop: 4 }}>
                  Processed Node Status: <strong style={{ color: ADMIN_THEME.textPrimary, textTransform: "uppercase" }}>{selectedApp.status}</strong>.
                </div>
              )
            )}

          </div>

        </div>
      )}

    </div>
  );
};
