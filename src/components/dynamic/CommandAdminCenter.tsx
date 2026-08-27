"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useIntelligence } from "@/context/IntelligenceContext";
import { RoleAssignmentManager } from "@/components/admin/RoleAssignmentManager";
import { RoleChangeLogTable } from "@/components/admin/RoleChangeLogTable";
import { PERMISSION_TEMPLATES, OfficerApplication } from "@/lib/adminService";
import { RBAC_CONFIG, clearanceForRole, DEPRECATED_ROLES } from "@/lib/rbac";
import { CLEARANCE_LABEL } from "@/lib/clearance";
import { ORCA_TOKENS } from "@/lib/theme";
import SupportTicketQueue from "@/components/admin/SupportTicketQueue";
import {
  useAdminOverview,
  type AdminApplicationRow,
  type AdminOfficerRow,
  type AdminAuditRow,
} from "@/lib/useAdminOverview";
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
  BarChart3,
  Cpu
} from "lucide-react";
// No Firestore import. Every read and write in this console now goes through
// /api/admin/* to Catalyst; the nine collections this file used to touch are
// no longer the source of truth for anything it displays.

// O.R.C.A Admin Style Tokens
/**
 * The dashboard's tokens, under the name this file already uses ~400 times.
 *
 * These were a SECOND copy with identical values — the same navy, the same
 * saffron, written out again. Two lists of the same colours drift the moment
 * one is edited. Aliased rather than renamed throughout, because a mass rename
 * would touch every line of this file for no visual change.
 */
const ADMIN_THEME = {
  bg: ORCA_TOKENS.offWhite,
  cardBg: ORCA_TOKENS.white,
  border: ORCA_TOKENS.border,
  accentGold: ORCA_TOKENS.gold,
  accentGoldLight: "#ffb05c",
  green: ORCA_TOKENS.green,
  red: ORCA_TOKENS.red,
  blue: ORCA_TOKENS.navy,
  textPrimary: ORCA_TOKENS.navy,
  textSecondary: ORCA_TOKENS.textGray,
  textMuted: ORCA_TOKENS.textMuted,
  shadow: "0 1px 3px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.08)",
};

/**
 * OfficerAuditLog stores machine change types (REGISTRATION_APPROVED). This
 * turns one into a sentence for display without storing a second, prettier
 * copy in the database that could drift from the real one.
 */
/** Whole days an application has been waiting. Counted, not stored. */
const daysWaiting = (submittedAt: string) => {
  const t = Date.parse((submittedAt || "").replace(" ", "T"));
  if (!t || Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const prettyChangeType = (t: string) =>
  ({
    REGISTRATION_APPROVED: "Registration approved",
    REGISTRATION_REJECTED: "Registration rejected",
    APPLICATION_EDIT: "Application edited",
    APPLICATION_STATUS: "Application status changed",
    OFFICER_PROFILE: "Officer profile updated",
    ACCOUNT_STATUS: "Account status changed",
    SYSTEM_SETTING: "System setting changed",
    ROLE_CHANGE: "Role changed",
  } as Record<string, string>)[t] || (t || "Change").replace(/_/g, " ").toLowerCase();

/**
 * Display names for the tab ids RBAC_CONFIG gates on. A tab missing from here
 * falls back to its id with the dashes removed, so a newly added section shows
 * up in the matrix immediately rather than disappearing until someone
 * remembers to label it.
 */
const TAB_LABELS: Record<string, string> = {
  dashboard: "Command Center",
  chatbot: "AI Chatbot",
  "case-registration": "Case Registration",
  evidence: "Evidence Management",
  analytics: "Crime Analytics",
  networks: "Threat Mapping",
  news: "Live News",
  reports: "Reports & Bulletins",
  "verification-document": "Document Verification",
  settings: "Profile Settings",
  "admin-dashboard": "Admin Dashboard",
  "admin-pending": "Pending Registrations",
  "admin-applications": "Officer Applications",
  "admin-directory": "Officer Directory",
  "admin-roles": "Roles & Permissions",
  "admin-verification": "Verification Oversight",
  "admin-analytics": "Platform Analytics",
  "admin-ai": "AI Monitoring",
  "admin-model": "AI Model Management",
  "admin-audit": "Audit Logs",
  "admin-security": "Security Center",
  "admin-support": "Support & Incidents",
  "admin-reports": "Reports & Notifications",
  "admin-settings": "System Settings",
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

/**
 * The roles an administrator may assign, straight out of RBAC_CONFIG.
 *
 * Every role dropdown in this console used to be a hand-typed <option> list.
 * They drifted: one listed five roles out of seventeen, with labels that no
 * longer matched the config ("Field Operational Officer" for what RBAC_CONFIG
 * calls "Level I Operational Officer"), and none of them knew about the O.R.C.A
 * or SCRB roles at all. A role added to the config simply did not appear.
 *
 * Deprecated roles are filtered out — they must still resolve for the accounts
 * holding them, but must never be handed to somebody new.
 */
const ASSIGNABLE_ROLES = (Object.keys(RBAC_CONFIG) as Array<keyof typeof RBAC_CONFIG>)
  .filter((key) => !DEPRECATED_ROLES.has(key))
  .map((key) => ({ value: key as string, label: RBAC_CONFIG[key].label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const ACCESS_MODULES = [
  "Investigation Dashboard",
  "Administrative Dashboard",
  "IT Administration Dashboard"
];

// PERMISSION_CATEGORIES is gone. It described a 12-permission vocabulary
// ("Manage Officers", "AI Access", ...) that appeared nowhere in the enforcing
// config, while omitting three modules that really do gate access. The Roles
// tab now renders RBAC_CONFIG itself.

interface CommandAdminCenterProps {
  adminTab: string;
}

export const CommandAdminCenter: React.FC<CommandAdminCenterProps> = ({ adminTab }) => {
  const { officerProfile } = useAuth();
  const { activeFirId } = useIntelligence();

  /**
   * Everything below comes from Catalyst in ONE request. It used to be five
   * Firestore reads re-run on every tab change; see useAdminOverview.
   */
  const { data: admin, loading, error: adminError, reload: loadAdminData } = useAdminOverview();
  const applications = admin.applications;
  const officers = admin.officers;
  const auditLogs = admin.audit;
  const verifications = admin.verifications;
  const reference = admin.reference;

  /**
   * One notice strip for the whole console.
   *
   * Replaces ~20 `alert()` calls. An alert cannot be read alongside the screen
   * it describes, and — worse — the old code showed a success alert from inside
   * the localStorage fallback, so a failed write and a successful one looked
   * identical to the administrator.
   */
  const [adminNotice, setAdminNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // UI state managers
  const [selectedApp, setSelectedApp] = useState<AdminApplicationRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  

  // Search & Filter state variables
  const [appSearch, setAppSearch] = useState("");
  const [dirSearch, setDirSearch] = useState("");
  const [dirDistrictFilter, setDirDistrictFilter] = useState("ALL");
  const [dirRankFilter, setDirRankFilter] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");

  // AI Monitoring Console state variables
  // The five hardcoded conversations that used to live here (with invented
  // confidence scores and star ratings) are gone. Real queries arrive on
  // `admin.aiQueries`, derived from OfficerActivity — see buildAiQueries().

  const [aiSearch, setAiSearch] = useState("");
  const [aiStatusFilter, setAiStatusFilter] = useState("ALL");
  const [aiOfficerFilter, setAiOfficerFilter] = useState("ALL");
  const [aiOpenId, setAiOpenId] = useState<string | null>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // AI Model Management state variables
  /**
   * AI Model Management.
   *
   * The temperature, max-tokens and system-prompt values that used to live here
   * as loose useState are now settings in the SystemSetting table, edited
   * through `settingsDraft` and read by /api/chat on every request. The
   * hardcoded version history and the Rollback / Retrain / Restart handlers are
   * gone — see the tab body for why they could not be made to work.
   */
  /**
   * Unauthorised access warnings. Loaded on demand — the section is checked
   * occasionally, not on every visit to the console.
   */
  const [warnData, setWarnData] = useState<any | null>(null);
  const [warnLoading, setWarnLoading] = useState(false);
  const [warnError, setWarnError] = useState("");
  const [warnFilter, setWarnFilter] = useState("ALL");

  const loadWarnings = useCallback(async () => {
    setWarnLoading(true);
    setWarnError("");
    try {
      const res = await fetch("/api/admin/security-alerts");
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setWarnData(j);
    } catch (e: any) {
      setWarnError(e?.message || "Could not read the security alerts.");
    } finally {
      setWarnLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === "admin-warnings" && !warnData) void loadWarnings();
  }, [adminTab, warnData, loadWarnings]);

  const acknowledgeWarning = async (rowId: string) => {
    try {
      const res = await fetch("/api/admin/security-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || "Could not update the alert.");
      setAdminNotice({ kind: "success", text: j.message });
      // Re-read rather than patching locally: the server stamps who and when.
      setWarnData(null);
    } catch (e: any) {
      setAdminNotice({ kind: "error", text: e?.message || "Could not update the alert." });
    }
  };

  const warnVisible = (warnData?.alerts || []).filter((a: any) => {
    if (warnFilter === "UNREVIEWED") return !a.acknowledgedAt;
    if (warnFilter === "LOCKED_OUT") return a.outcome === "LOCKED_OUT";
    if (warnFilter === "WARNED") return a.outcome === "WARNED";
    return true;
  });

  const [modelInfo, setModelInfo] = useState<any | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");

  /**
   * `probe` costs a real API call per configured model, so connectivity is
   * tested only when asked. The rest — configuration and usage counts — is free
   * and loads with the tab.
   */
  const loadModels = useCallback(async (probe = false) => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const res = await fetch(`/api/admin/ai-models${probe ? "?probe=1" : ""}`);
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || `Request failed (${res.status})`);
      setModelInfo(j);
    } catch (e: any) {
      setModelsError(e?.message || "Could not read the AI model configuration.");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === "admin-model" && !modelInfo) void loadModels(false);
  }, [adminTab, modelInfo, loadModels]);

  // Security Center — events are derived server-side from OfficerSession and
  // arrive on `admin.security`. The three hardcoded incidents that used to live
  // here (failed logins, brute force, unusual geography) described things this
  // platform cannot observe; see SECURITY_BLIND_SPOTS in adminInsights.ts.
  const [securitySearch, setSecuritySearch] = useState("");

  // Reports & Notifications. Notifications are derived, not stored — see
  // buildNotifications(). The report format switch is gone: every export is a
  // CSV of real rows, and the old PDF/Excel options produced neither.
  const [reportsSubTab, setReportsSubTab] = useState<"reports" | "notifications">("reports");
  const [reportsSuccessMsg, setReportsSuccessMsg] = useState("");

  // System settings live in `settingsDraft`, seeded from the SystemSetting
  // table. The fifteen loose useState values that used to sit here were never
  // persisted anywhere — that was the whole bug.


  const [auditModuleFilter, setAuditModuleFilter] = useState("ALL");
  const [verSearch, setVerSearch] = useState("");
  const [verStatusFilter, setVerStatusFilter] = useState("ALL");


  // Extended state variables for drawer modifications
  const [modFirstName, setModFirstName] = useState("");
  const [modLastName, setModLastName] = useState("");
  const [modRank, setModRank] = useState("");
  const [modStation, setModStation] = useState("");
  const [modDistrict, setModDistrict] = useState("");
  /**
   * Posting as FOREIGN KEYS, which is what Employee actually stores.
   *
   * The four fields above are the old free-typed strings. They are kept only to
   * display what the applicant originally wrote; the ids below are what gets
   * saved, because `Employee.DistrictID / UnitID / RankID` cannot hold a
   * hand-typed station name — the previous approval path simply dropped them.
   */
  const [modRankId, setModRankId] = useState("");
  const [modDesignationId, setModDesignationId] = useState("");
  const [modDistrictId, setModDistrictId] = useState("");
  const [modUnitId, setModUnitId] = useState("");
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
  /** Working copy of system settings; committed by handleSaveSettings. */
  const [settingsDraft, setSettingsDraft] = useState<Record<string, any>>({});
  /** Seed the draft once the stored values arrive, and after every save. */
  useEffect(() => {
    setSettingsDraft({ ...admin.settings });
  }, [admin.settings]);
  /**
   * The AI runtime parameters, split out of the settings catalogue.
   *
   * They are marked `hiddenFromSettings` so they do not appear on the System
   * Settings screen — they belong beside the models they configure, not in a
   * list of security policies. Both screens edit the same `settingsDraft` and
   * save through the same route.
   */
  const aiSpecs = admin.settingSpecs.filter((sp: any) => sp.group === "AI Runtime");
  const aiSpecDefaults = Object.fromEntries(aiSpecs.map((sp: any) => [sp.key, sp.fallback]));
  const aiSettingsDirty = aiSpecs.some(
    (sp: any) => String(settingsDraft[sp.key]) !== String(admin.settings[sp.key])
  );

  const settingsDirty = admin.settingSpecs.some(
    (sp: any) =>
      !sp.hiddenFromSettings &&
      String(settingsDraft[sp.key]) !== String(admin.settings[sp.key])
  );

  // RBAC Configurable permissions configuration
  // The editable RBAC matrix that used to live here held nine roles that did
  // not exist in RBAC_CONFIG, and ticking a box mutated local state and nothing
  // else. Removed along with handlePermissionToggle.

  // Pending Registrations Real-Time Workflow State
  const [pendingRegistrations, setPendingRegistrations] = useState<any[]>([]);
  // Firebase UID -> data URL of the applicant's stored capture.
  const [applicantPhotos, setApplicantPhotos] = useState<Record<string, string>>({});
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
  const [editProfileRankId, setEditProfileRankId] = useState("");
  const [editProfileDistrictId, setEditProfileDistrictId] = useState("");
  const [editProfileUnitId, setEditProfileUnitId] = useState("");
  const [editProfileClearance, setEditProfileClearance] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfileDistrict, setEditProfileDistrict] = useState("");
  const [editProfileStation, setEditProfileStation] = useState("");
  const [editProfileMobile, setEditProfileMobile] = useState("");
  const [editProfileActive, setEditProfileActive] = useState(true);

  const openOfficerEditModal = (off: any) => {
    setActiveOfficerProfile(off);
    setEditProfileName(off.name || "");
    setEditProfileRank(off.rank || "");
    // No default clearance — a blank record shows blank, not Field Officer.
    setEditProfileClearance(off.clearanceLevel || "");
    setEditProfileEmail(off.email || "");
    // No invented defaults. These used to fall back to "Bengaluru Urban" and
    // "Central Command", so an officer with no posting on record appeared to
    // have one — and saving the form then made that guess permanent.
    setEditProfileDistrict(off.district || "");
    setEditProfileStation(off.station || "");
    setEditProfileMobile(off.mobile || "");
    setEditProfileActive(off.active !== false);
    // The ids are resolved by name from the reference tables, because the
    // officer list carries joined names rather than the ids themselves.
    setEditProfileRankId(String(reference.ranks.find((r) => r.name === off.rank)?.id || ""));
    setEditProfileDistrictId(String(reference.districts.find((d) => d.name === off.district)?.id || ""));
    setEditProfileUnitId(String(reference.units.find((u) => u.name === off.station)?.id || ""));
    setIsEditingProfile(true);
  };


  /**
   * Pending registrations now come from the same Catalyst read as everything
   * else, filtered to the ones awaiting review.
   *
   * This replaced a Firestore `onSnapshot` listener on `pendingRegistrations`.
   * The live listener looked like an advantage, but it was watching a
   * collection that registration had stopped being the source of truth for, and
   * its error handler fell back to a localStorage copy — so a permissions
   * failure silently showed stale applicants from this browser's cache as
   * though they were live.
   */
  useEffect(() => {
    setPendingRegistrations(applications.filter((a) => a.status === "pending"));
  }, [applications]);

  useEffect(() => {
    if (pendingRegistrations.length) void loadApplicantPhotos(pendingRegistrations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRegistrations]);

  /**
   * Applicant face captures, fetched from Catalyst in ONE request for the whole
   * list. They used to arrive as base64 blobs embedded in each Firestore
   * document; the image now lives once in OfficerPhoto, keyed by Firebase UID.
   *
   * The endpoint requires administrator rights to read anyone else's capture —
   * it is biometric data, so an officer-level session cannot enumerate faces.
   */
  const loadApplicantPhotos = async (list: any[]) => {
    const uids = list.map((r) => r.uid || r.id).filter(Boolean);
    if (!uids.length) return;
    try {
      const res = await fetch(`/api/officer/photo?uids=${encodeURIComponent(uids.join(","))}`);
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, string> = {};
      Object.entries(data.photos || {}).forEach(([uid, photo]: [string, any]) => {
        if (photo?.dataUrl) map[uid] = photo.dataUrl;
      });
      setApplicantPhotos((prev) => ({ ...prev, ...map }));
    } catch {
      // The list still renders with initials.
    }
  };

  const handleConfirmApproveRegistration = async () => {
    if (!selectedPendingReg) return;
    setPendingActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/approve-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedPendingReg.id,
          dashboardRole: pendingRoleSelection,
          isdLevel: pendingIsdSelection,
          // Posting comes from the application itself. Nothing is passed here,
          // so the route falls back to what the applicant submitted rather than
          // to a hardcoded district — the old route defaulted every approved
          // officer to "Bengaluru Urban" regardless of where they applied from.
          adminName: officerProfile?.name || "Command Administrator",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to approve registration.");
      setAdminNotice({
        kind: "success",
        text:
          data.message +
          // The KGID is auto-serial, so there is nothing to warn about — the
          // useful thing to say is which provisional id it replaced, so an
          // administrator can connect the approval to the application they
          // were reviewing a moment ago.
          (data.previousKgid ? ` (was ${data.previousKgid} while under review)` : ""),
      });
      setApproveModalOpen(false);
      setSelectedPendingReg(null);
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Approval failed." });
    } finally {
      setPendingActionLoading(false);
    }
  };

  const handleConfirmRejectRegistration = async () => {
    if (!selectedPendingReg) return;
    // The route now requires a stated reason. Every rejection used to fall back
    // to the same boilerplate sentence, so the record showed nothing useful
    // about why any particular applicant was turned down.
    if (!rejectReasonInput.trim()) {
      setAdminNotice({ kind: "error", text: "A rejection reason is required." });
      return;
    }
    setPendingActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/reject-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedPendingReg.id,
          reason: rejectReasonInput.trim(),
          adminName: officerProfile?.name || "Command Administrator",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to reject registration.");
      setAdminNotice({ kind: "success", text: data.message });
      setRejectModalOpen(false);
      setSelectedPendingReg(null);
      setRejectReasonInput("");
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Rejection failed." });
    } finally {
      setPendingActionLoading(false);
    }
  };

  useEffect(() => {
    if (selectedApp) {
      const parts = (selectedApp.name || "").trim().split(/\s+/);
      setModFirstName(parts[0] || "");
      setModLastName(parts.slice(1).join(" "));
      // Names for display, ids for saving. See the modRankId comment above.
      setModRank(selectedApp.rank || "");
      setModStation(selectedApp.station || "");
      setModDistrict(selectedApp.district || "");
      setModRankId(selectedApp.rankId ? String(selectedApp.rankId) : "");
      setModDesignationId(selectedApp.designationId ? String(selectedApp.designationId) : "");
      setModDistrictId(selectedApp.districtId ? String(selectedApp.districtId) : "");
      setModUnitId(selectedApp.unitId ? String(selectedApp.unitId) : "");
      setModMobile(selectedApp.mobile || "");
      setModEmail(selectedApp.email || "");
      setModRequestedAccess(selectedApp.requestedAccess || "");
      setModInternalRemarks(selectedApp.remarks || "");
      /**
       * An SCRB applicant opens on the SCRB role, matching the Pending
       * Registrations modal. Clearance is derived from whichever role that is,
       * never defaulted independently — the two must agree or the approval is
       * rejected.
       */
      const defaultRole =
        String(selectedApp.postingType || "") === "SCRB" ? "scrb_officer" : "investigation_l1";
      setModRole(defaultRole);
      setModSecurityClearance(clearanceForRole(defaultRole) || "");
      setIsConfirmingApproval(false);
      setModStatus(selectedApp.status || "pending");
    }
  }, [selectedApp, reference]);

  // The "Seed Security Data" button and its handler are gone. It wrote the
  // MOCK_* arrays into Firestore and localStorage; those arrays were emptied
  // when the demo records were purged, so by the end it seeded nothing while
  // still looking like a working control.

  const applyPermissionTemplate = (templateName: string) => {
    const template = PERMISSION_TEMPLATES[templateName];
    if (template) {
      setModPermissions({ ...template.permissions });
      /**
       * `template.role` is NOT set here any more.
       *
       * It holds display prose ("Investigation Officer"), and this used to
       * overwrite `modRole` with it — which the drawer then posted as
       * `dashboardRole`, guaranteeing an "Unknown role" rejection. Applying a
       * template fills the module grid it is for; the role stays whatever the
       * reviewer chose in the role dropdown.
       */
    }
  };

  // Approval flow handler
  const handleApproveApp = async (app: AdminApplicationRow) => {
    setIsConfirmingApproval(true);
  };

  /**
   * Approve an application.
   *
   * One route now does the whole job — /api/admin/approve-registration creates
   * the Employee row, allocates the KGID, binds the OfficerAccount, sets the
   * Firebase claims and appends the audit entry. The version this replaced
   * called an API and then wrote three Firestore documents from the browser to
   * patch up what the API had not done, with a localStorage "sandbox" fallback
   * underneath that silently pretended the approval had worked when it had not.
   *
   * Posting details are sent as FK ids. `Employee` stores DistrictID / UnitID /
   * RankID, so a free-typed station name could not be saved and used to be
   * dropped on the floor.
   */
  const executeApproveApp = async (app: AdminApplicationRow) => {
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/approve-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: app.id,
          dashboardRole: modRole,
          isdLevel: modSecurityClearance,
          rankId: modRankId ? Number(modRankId) : null,
          designationId: modDesignationId ? Number(modDesignationId) : null,
          districtId: modDistrictId ? Number(modDistrictId) : null,
          unitId: modUnitId ? Number(modUnitId) : null,
          reason: modInternalRemarks || undefined,
          adminName: officerProfile?.name || "Command Administrator",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Approval failed (${res.status})`);

      setAdminNotice({
        kind: "success",
        text:
          data.message +
          // The KGID is auto-serial, so there is nothing to warn about — the
          // useful thing to say is which provisional id it replaced, so an
          // administrator can connect the approval to the application they
          // were reviewing a moment ago.
          (data.previousKgid ? ` (was ${data.previousKgid} while under review)` : ""),
      });
      setIsDrawerOpen(false);
      setIsConfirmingApproval(false);
      await loadAdminData();
    } catch (err: any) {
      // No sandbox fallback. If the approval did not reach the database, the
      // administrator has to know that — the previous code showed a success
      // alert either way.
      setAdminNotice({ kind: "error", text: err?.message || "Approval failed." });
    } finally {
      setActionLoading(false);
    }
  };

  // Rejection flow handler
  const handleRejectApp = async (app: AdminApplicationRow) => {
    const reason = prompt(`Enter rejection reason for ${app.name}:`, "");
    if (reason === null) return;
    if (!reason.trim()) {
      setAdminNotice({ kind: "error", text: "A rejection reason is required." });
      return;
    }
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/reject-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: app.id,
          reason: reason.trim(),
          adminName: officerProfile?.name || "Command Administrator",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Rejection failed (${res.status})`);

      setAdminNotice({ kind: "success", text: data.message });
      setIsDrawerOpen(false);
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Rejection failed." });
    } finally {
      setActionLoading(false);
    }
  };

  // Save progress of the review details
  const handleSaveReview = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/application", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedApp.id,
          fullName: `${modFirstName} ${modLastName}`.trim(),
          mobile: modMobile,
          rankId: modRankId ? Number(modRankId) : null,
          designationId: modDesignationId ? Number(modDesignationId) : null,
          districtId: modDistrictId ? Number(modDistrictId) : null,
          unitId: modUnitId ? Number(modUnitId) : null,
          requestedAccess: modRequestedAccess,
          remarks: modInternalRemarks,
          reason: "Review parameters saved from the admin console.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Save failed (${res.status})`);
      setAdminNotice({ kind: "success", text: "Review progress saved." });
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Could not save the review." });
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Ask the applicant for more documents.
   *
   * The status moves to `awaiting` and the request is appended to the reviewer
   * remarks. NOTE: nothing notifies the applicant — the old code showed
   * "applicant notified", and no message was ever sent. The status change is
   * real; the notification is not, so it is no longer claimed.
   */
  const handleRequestInfo = async () => {
    if (!selectedApp) return;
    const reqRemarks = prompt(
      "Describe the documents or information required from the officer:",
      ""
    );
    if (reqRemarks === null) return;
    if (!reqRemarks.trim()) {
      setAdminNotice({ kind: "error", text: "Describe what is being requested." });
      return;
    }
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const combined = [modInternalRemarks, `[Info requested] ${reqRemarks.trim()}`]
        .filter(Boolean)
        .join("\n");
      const res = await fetch("/api/admin/application", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: selectedApp.id,
          status: "awaiting",
          remarks: combined,
          reason: `Additional information requested: ${reqRemarks.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
      setModInternalRemarks(combined);
      setAdminNotice({
        kind: "success",
        text: "Marked as awaiting documents. The applicant is not notified automatically — contact them separately.",
      });
      setIsDrawerOpen(false);
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Could not update the application." });
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
  const generateDossierLetter = (app: AdminApplicationRow, type: "approval" | "rejection") => {
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
    // No default clearance — a blank record shows blank, not Field Officer.
    setEditProfileClearance(off.clearanceLevel || "");
    setEditProfileMobile(off.mobile || off.phone || "");
    setEditProfileActive(off.active ?? true);
    setIsEditingProfile(true);
  };

  const handleSaveProfileEdit = async () => {
    if (!activeOfficerProfile) return;
    const targetId = activeOfficerProfile.uid;
    if (!targetId) {
      setAdminNotice({ kind: "error", text: "Officer UID not found — cannot save." });
      return;
    }
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/officer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: targetId,
          name: editProfileName,
          email: editProfileEmail,
          mobile: editProfileMobile,
          // clearanceLevel is NOT sent: it follows the role, and posting it
          // alone is refused by the route. This drawer edits identity and
          // posting details; role changes belong in Roles & Permissions.
          rankId: editProfileRankId ? Number(editProfileRankId) : null,
          districtId: editProfileDistrictId ? Number(editProfileDistrictId) : null,
          unitId: editProfileUnitId ? Number(editProfileUnitId) : null,
          active: editProfileActive,
          reason: "Officer profile edited from the directory.",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Save failed (${res.status})`);

      setIsEditingProfile(false);
      setActiveOfficerProfile(null);
      setAdminNotice({ kind: "success", text: `Profile saved for ${editProfileName}.` });
      // Re-read rather than patching local state: the server joins the posting
      // names back out of the reference tables, and guessing them here is how
      // the card and the record drift apart.
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Could not save the profile." });
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend / reactivate an officer. Never deletes: cases and custody rows name
  // the Employee record, and the chain of custody has to stay attributable.
  const handleToggleOfficerStatus = async (off: any) => {
    const nextActiveState = !off.active;
    if (!confirm(`${nextActiveState ? "Reactivate" : "Suspend"} ${off.name}?`)) return;
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/officer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: off.uid,
          active: nextActiveState,
          reason: `${nextActiveState ? "Reactivated" : "Suspended"} from the officer directory.`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Update failed (${res.status})`);
      setAdminNotice({
        kind: "success",
        text: `${off.name} ${nextActiveState ? "reactivated" : "suspended"}.`,
      });
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Could not change the account status." });
    } finally {
      setActionLoading(false);
    }
  };

  // RBAC Permission change toggling
  /**
   * Save system settings.
   *
   * This used to be `setTimeout(1200)` followed by "System settings saved
   * successfully." Nothing was written; reloading reverted everything. It now
   * PUTs to /api/admin/settings, which persists to the SystemSetting table and
   * writes one audit row per changed value.
   */
  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setActionLoading(true);
    setAdminNotice(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsDraft }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Save failed (${res.status})`);
      setSettingsDraft(data.settings || settingsDraft);
      setModelInfo(null);   // its `runtime` block is now stale
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 4000);
      setAdminNotice({ kind: "success", text: data.message });
      await loadAdminData();
    } catch (err: any) {
      setAdminNotice({ kind: "error", text: err?.message || "Could not save system settings." });
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
    // Reviewer filter dropped: OfficerApplication records who REVIEWED an
    // application (ReviewedBy), not who it is assigned to. There is no
    // assignment concept, so filtering by assignee filtered by nothing.
    return matchesSearch && matchesRank && matchesDistrict && matchesStation && matchesStatus && matchesAccess;
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
    if (appSortBy === "waiting") {
      // Longest-waiting first. This replaced a "priority" sort: the field it
      // read was never written by registration, so every application carried
      // the same MEDIUM and the sort did nothing.
      const pending = (x: AdminApplicationRow) => (x.status === "pending" ? 1 : 0);
      if (pending(a) !== pending(b)) return pending(b) - pending(a);
      return new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
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
    const query = (auditSearch || "").toLowerCase();
    const haystack = [
      log.changedBy, log.changeType, log.reason, log.oldValue, log.newValue,
      prettyChangeType(log.changeType),
    ].join(" ").toLowerCase();
    // `module` was a Firestore field; OfficerAuditLog groups by ChangeType,
    // which is the thing that actually varies between entries.
    const matchesModule = auditModuleFilter === "ALL" || log.changeType === auditModuleFilter;
    return haystack.includes(query) && matchesModule;
  });

  // Filter Verifications
  const filteredVerifications = verifications.filter((v: any) => {
    const query = (verSearch || "").toLowerCase();
    const haystack = [v.verificationId, v.crimeNo, v.issuedBy, v.documentHash]
      .join(" ").toLowerCase();
    const matchesStatus =
      verStatusFilter === "ALL" ||
      (verStatusFilter === "scanned" ? v.scanCount > 0 : v.scanCount === 0);
    return haystack.includes(query) && matchesStatus;
  });

  /**
   * AI queries after search and filters.
   *
   * The search covers the ANSWER as well as the question: a monitoring console
   * whose search cannot reach what the model said would miss the thing most
   * worth finding.
   */
  const aiVisible = admin.aiQueries.filter((c: any) => {
    const q = aiSearch.trim().toLowerCase();
    if (q && ![c.officer, c.badge, c.query, c.response, c.module].join(" ").toLowerCase().includes(q)) {
      return false;
    }
    if (aiOfficerFilter !== "ALL" && c.officer !== aiOfficerFilter) return false;
    if (aiStatusFilter === "FLAGGED" && c.flags.length === 0) return false;
    if (aiStatusFilter === "FAILED" && c.outcome !== "ERROR") return false;
    if (aiStatusFilter === "ATTACHMENT" && !c.hadAttachment) return false;
    return true;
  });

  // Unique lists for dropdowns
  const uniqueDistricts = Array.from(new Set(officers.map(o => o.district).filter(Boolean)));
  const uniqueModules = Array.from(new Set(auditLogs.map(l => l.changeType).filter(Boolean)));

  // The first read only. Subsequent refreshes leave the screen in place and
  // let the individual panels say they are reloading — the old code returned
  // this spinner INSTEAD of the console on every tab change, because the fetch
  // was keyed on the active tab.
  if (loading && !admin.officers.length && !admin.applications.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "400px", color: ADMIN_THEME.textSecondary }}>
        <Loader2 style={{ width: 40, height: 40, animation: "spin 1s linear infinite", color: ADMIN_THEME.accentGold, marginBottom: 12 }} />
        <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>READING THE CATALYST LEDGER...</span>
      </div>
    );
  }

  return (
    <div style={{ color: ADMIN_THEME.textPrimary, animation: "fadeIn 0.3s ease" }}>

      {/* Catalyst unreachable, or the officer tables absent. Said plainly
          rather than rendering an empty directory that looks like a department
          with no officers in it. */}
      {(!admin.configured || adminError || admin.officersUnavailable) && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: `1px solid ${ADMIN_THEME.red}55`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 18,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle style={{ width: 16, height: 16, color: ADMIN_THEME.red, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: ADMIN_THEME.textPrimary, lineHeight: 1.5 }}>
            <strong>Administrative data could not be read in full.</strong>{" "}
            {adminError || admin.officersUnavailable || "Catalyst is not connected."}{" "}
            Figures on this screen may be incomplete — they are not zero.
          </div>
        </div>
      )}

      {/* One notice strip for the whole console, replacing ~20 alert() calls. */}
      {adminNotice && (
        <div style={{
          background: adminNotice.kind === "success" ? "#ecfdf5" : "rgba(239,68,68,0.06)",
          border: `1px solid ${adminNotice.kind === "success" ? ADMIN_THEME.green : ADMIN_THEME.red}`,
          color: adminNotice.kind === "success" ? "#065f46" : "#991b1b",
          borderRadius: 8, padding: "12px 16px", marginBottom: 18,
          display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5,
        }}>
          {adminNotice.kind === "success"
            ? <Check style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            : <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />}
          <div style={{ flex: 1 }}>{adminNotice.text}</div>
          <button
            onClick={() => setAdminNotice(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
            aria-label="Dismiss"
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
      )}
      
      {/* 1. ADMIN DASHBOARD */}
      {adminTab === "admin-dashboard" && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Command Operations Console</h1>
              <p style={{ fontSize: 13, color: ADMIN_THEME.textSecondary }}>Administrative security core and directory management</p>
            </div>
            <button
              onClick={() => loadAdminData()}
              disabled={loading}
              style={{
                background: "#fff", color: ADMIN_THEME.textPrimary,
                padding: "7px 14px", borderRadius: 6, fontWeight: 600, fontSize: 12,
                cursor: loading ? "default" : "pointer", border: `1px solid ${ADMIN_THEME.border}`,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <History style={{ width: 14, height: 14 }} />
              {loading ? "Reading…" : "Refresh"}
            </button>
          </div>

          {/*
            KPI CARDS — every figure below is counted from a Catalyst table.
            Four of the old cards were removed rather than rewired, because
            nothing in the platform measures them:
              · "System Health 99.9%"   — a literal, no health check exists
              · "API Status ONLINE"     — a literal, nothing was polled
              · "Storage Usage"         — officers×0.12 + apps×0.25 + …, invented
              · "Online Officers"       — Math.round(activeOfficers × 0.4)
            The last one is replaced by a real count of open sessions.
          */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
            {([
              ["Pending Applications", admin.summary.pendingApplications, ADMIN_THEME.accentGold, UserCheck, "Awaiting administrative review"],
              ["Active Officers", admin.summary.activeOfficers, ADMIN_THEME.textPrimary, Shield, `of ${admin.summary.totalOfficers ?? 0} accounts on record`],
              ["Open Sessions", admin.summary.openSessions, ADMIN_THEME.green, Activity, "Signed in and not yet signed out"],
              ["Sign-ins Today", admin.summary.signInsToday, ADMIN_THEME.textPrimary, Clock, "Recorded in OfficerSession"],
              ["Rejected Applications", admin.summary.rejectedApplications, ADMIN_THEME.textPrimary, X, "Review denied"],
              ["Documents Sealed", admin.summary.documentsSealed, ADMIN_THEME.textPrimary, FileText, "Entries in the verification ledger"],
              ["Verification Scans", admin.summary.scansRun, ADMIN_THEME.textPrimary, FileCheck, "Barcode scans performed"],
              ["Failed Scans", admin.summary.failedScans, admin.summary.failedScans ? ADMIN_THEME.red : ADMIN_THEME.textPrimary, AlertTriangle, "Scans that did not verify"],
              ["Audit Entries", admin.summary.auditEntries, ADMIN_THEME.textPrimary, History, "Append-only change record"],
              ["Missing Personnel Records", admin.summary.officersWithoutEmployeeRow, admin.summary.officersWithoutEmployeeRow ? ADMIN_THEME.red : ADMIN_THEME.green, User, "Accounts with no Employee row"],
            ] as const).map(([label, value, colour, Icon, hint]) => (
              <div key={label} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: ADMIN_THEME.textSecondary, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                  <span>{label}</span>
                  <Icon style={{ width: 14, height: 14, color: colour as string }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: colour as string }}>
                  {loading ? "—" : (value ?? 0)}
                </div>
                <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>{hint}</div>
              </div>
            ))}
          </div>

          {/* LOWER FEEDS */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
            {/* Audit trail — OfficerAuditLog, newest first. */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>Recent Changes</span>
                <History style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              </div>
              {auditLogs.length === 0 ? (
                <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, padding: "12px 0" }}>
                  {loading ? "Reading the audit trail…" : "No changes recorded yet."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {auditLogs.slice(0, 6).map((log, idx) => (
                    <div key={log.logId ?? idx} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: idx !== Math.min(5, auditLogs.length - 1) ? `1px solid ${ADMIN_THEME.border}` : "none", paddingBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{prettyChangeType(log.changeType)}</div>
                        <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.changedBy}{log.reason ? ` — ${log.reason}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                        {log.changedAt ? new Date(log.changedAt.replace(" ", "T")).toLocaleString() : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/*
              Things needing attention. This replaced a "State Server Cluster
              Status" panel whose four green dots and latency figures
              ("Connected (12ms)", "Online (244ms)") were literals — nothing
              was ever polled. These are conditions actually read from the data.
            */}
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${ADMIN_THEME.border}`, paddingBottom: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>Needs Attention</span>
                <Bell style={{ width: 14, height: 14, color: ADMIN_THEME.accentGold }} />
              </div>
              {admin.notifications.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ADMIN_THEME.green, padding: "8px 0" }}>
                  <Check style={{ width: 15, height: 15 }} /> Nothing outstanding.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {admin.notifications.slice(0, 6).map((n: any) => (
                    <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{
                        marginTop: 5, width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                        background: n.kind === "CRITICAL" ? ADMIN_THEME.red : n.kind === "SECURITY" ? "#f97316" : n.kind === "WARNING" ? ADMIN_THEME.accentGold : ADMIN_THEME.textMuted,
                      }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>{n.title}</div>
                        <div style={{ fontSize: 10.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.4 }}>{n.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Pending Registrations</h1>
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
                        {applicantPhotos[reg.uid || reg.id] ? (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ADMIN_THEME.blue}` }}>
                            <img src={applicantPhotos[reg.uid || reg.id]} alt={`Face capture of ${reg.name || "applicant"}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                              /**
                               * An SCRB applicant opens on the SCRB role.
                               *
                               * The posting is what they declared at sign-up, so
                               * defaulting to the field-officer role would make
                               * the reviewer re-derive it from the posting column
                               * every time — and approving on the default would
                               * silently put a records-bureau applicant on the
                               * wrong clearance track. Still a default: the
                               * reviewer can change it before approving.
                               */
                              const isScrb = String(reg.postingType || "") === "SCRB";
                              setPendingRoleSelection(isScrb ? "scrb_officer" : "investigation_l1");
                              setPendingIsdSelection(isScrb ? "CRB-LEVEL-I" : "ISD-LEVEL-IV");
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
                    onChange={(e) => {
                      const role = e.target.value;
                      setPendingRoleSelection(role);
                      // Clearance follows the role — see below.
                      setPendingIsdSelection(clearanceForRole(role) || "");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary
                    }}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: ADMIN_THEME.textPrimary }}>
                    Security Clearance
                  </label>
                  {/*
                    Shown, not chosen.

                    Clearance follows the role, and the approval route REJECTS a
                    clearance that disagrees with it. While this was a free
                    select, any pairing the reviewer did not happen to match by
                    hand came back a 400 — and picking SCRB, which carries
                    CRB-LEVEL-I, could not be matched here at all because the
                    list only held ISD levels.

                    It is also no longer labelled "ISD Level": with the ORCA and
                    CRB tracks that is not always what it is.
                  */}
                  <div
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${ADMIN_THEME.border}`,
                      background: "#f8fafc",
                      fontSize: 13,
                      color: ADMIN_THEME.textPrimary
                    }}
                  >
                    <strong>{pendingIsdSelection || "—"}</strong>
                    {pendingIsdSelection && CLEARANCE_LABEL[pendingIsdSelection as keyof typeof CLEARANCE_LABEL]
                      ? ` — ${CLEARANCE_LABEL[pendingIsdSelection as keyof typeof CLEARANCE_LABEL]}`
                      : ""}
                  </div>
                  <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>
                    Determined by the selected role.
                  </div>
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
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Officer Applications</h1>
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
              <div style={{ fontSize: 12, marginTop: 4 }}>Awaiting new officer registrations.</div>
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {paginatedApps.map(app => (
                  <div 
                    key={app.id}
                    style={{
                      background: ADMIN_THEME.cardBg,
                      border: `1px solid ${app.status === "pending" && daysWaiting(app.submittedAt) >= 3 ? "rgba(255, 153, 51, 0.4)" : ADMIN_THEME.border}`,
                      borderRadius: 8,
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden"
                    }}
                  >
                    {/*
                      How long they have waited, in place of the old PRIORITY
                      tag. Priority was a Firestore field registration never
                      set, so every card read "MEDIUM PRIORITY" — decoration
                      with the shape of information. Waiting time is measured.
                    */}
                    {(app.status === "pending" || app.status === "under_review") && (() => {
                      const d = daysWaiting(app.submittedAt);
                      const urgent = d >= 3;
                      return (
                        <span style={{
                          position: "absolute", top: 10, right: 10,
                          fontSize: 9, fontWeight: 800,
                          background: urgent ? `${ADMIN_THEME.red}20` : `${ADMIN_THEME.accentGold}20`,
                          color: urgent ? ADMIN_THEME.red : ADMIN_THEME.accentGold,
                          padding: "2px 6px", borderRadius: 4,
                        }}>
                          {d <= 0 ? "TODAY" : `${d} DAY${d === 1 ? "" : "S"} WAITING`}
                        </span>
                      );
                    })()}

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
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Officer Directory</h1>
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
                {/* From the Rank table. The four literals that used to be here
                    matched none of the eleven ranks actually in use, so most of
                    the directory was unreachable through this filter. */}
                <option value="ALL">All Ranks</option>
                {reference.ranks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
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
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Phone:</strong> {off.mobile || "—"}</div>
                      {/* Role, not "Access Level". The old line fell back to
                          "Full Investigator Access" when the field was absent,
                          which read as a granted permission and was not one. */}
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Role:</strong> <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 600 }}>{off.dashboardRole || "—"}</span></div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Clearance:</strong> <span style={{ color: ADMIN_THEME.accentGold, fontWeight: 600 }}>{off.clearanceLevel || "—"}</span></div>
                      <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Personnel Record:</strong> {off.employeeId ? `${off.badgeId || "no KGID"} (Employee ${off.employeeId})` : <span style={{ color: ADMIN_THEME.red, fontWeight: 700 }}>MISSING</span>}</div>
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
                          {/*
                            Read-only. Editing clearance here wrote it without a
                            role, which the route now refuses — and which is how
                            live accounts drifted onto a clearance their role
                            does not carry. Change it from Roles & Permissions.
                          */}
                          <div style={{ width: "100%", background: "#f1f5f9", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }}>
                            {editProfileClearance || "—"}
                          </div>
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
                        <div><strong style={{ color: ADMIN_THEME.textPrimary }}>Clearance Level:</strong> {activeOfficerProfile.clearanceLevel || "Not recorded"}</div>
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
                                  // Nothing sent a reset email; the message was
                                  // the whole feature. Firebase Auth owns
                                  // password resets and the officer can start
                                  // one from the sign-in screen.
                                  setAdminNotice({
                                    kind: "error",
                                    text: "Password resets are not issued from here. Firebase Auth owns them — the officer can request one from the sign-in screen.",
                                  });
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
      {/*
        ROLES & PERMISSIONS.

        This tab used to render an editable 9-role x 12-permission grid held in
        component state. Ticking a box changed a local array and nothing else;
        the Save button said "RBAC matrix updated locally in memory layer" and
        the change vanished on reload. Worse than useless: an administrator
        could believe they had revoked someone's access.

        None of those twelve permission names existed in the enforcing config
        either, and three real modules that DO gate access - Case Registration,
        Evidence Management, Crime Analytics - were absent from the grid
        entirely, so they could not be reasoned about at all.

        Access is decided by RBAC_CONFIG in src/lib/rbac.ts, keyed on
        `dashboardRole`, and read by canAccessTab() on every render. That is now
        what this screen shows: the real thing, read-only, because it lives in
        code. Editing it is a code change and a deployment, which is the point -
        a permission matrix that can be edited by whoever is looking at it is
        not an access control.

        Assigning a role to an officer IS a live operation and stays live: that
        is RoleAssignmentManager below, which writes OfficerAccount and the
        Firebase claim through /api/admin/rbac/set-role.
      */}
      {adminTab === "admin-roles" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Roles &amp; Permissions</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
              Assign a role to an officer, and see exactly what each role can reach
            </p>
          </div>

          <div style={{ marginBottom: 28 }}>
            <RoleAssignmentManager />
            <RoleChangeLogTable />
          </div>

          <div style={{
            background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8, padding: "12px 16px", marginBottom: 18,
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <Info style={{ width: 16, height: 16, color: ADMIN_THEME.accentGold, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.55 }}>
              <strong style={{ color: ADMIN_THEME.textPrimary }}>This matrix is read-only, and it is the real one.</strong>{" "}
              It is read from <code style={{ fontFamily: "JetBrains Mono, monospace" }}>RBAC_CONFIG</code> in{" "}
              <code style={{ fontFamily: "JetBrains Mono, monospace" }}>src/lib/rbac.ts</code>, the same config the app checks
              on every screen. Changing what a role can reach is a code change, deliberately — an access matrix
              that could be edited from inside the app by whoever was looking at it would not be an access control.
              To change one <em>officer</em>, use Role Assignment above.
            </div>
          </div>

          {(() => {
            /**
             * The matrix shows ASSIGNABLE roles only.
             *
             * `admin_scrb` is a deprecated alias of `scrb_officer` and renders
             * with the same label, so leaving it in gave two identical columns
             * — one of them dead. It still appears in "Roles In Use" below,
             * marked deprecated, because an account may still hold it and that
             * is worth being able to see.
             */
            const roles = (Object.keys(RBAC_CONFIG) as (keyof typeof RBAC_CONFIG)[])
              .filter((r) => !DEPRECATED_ROLES.has(r));
            const allRoles = Object.keys(RBAC_CONFIG) as (keyof typeof RBAC_CONFIG)[];
            // Every tab any role can reach, in a stable order.
            const allTabs = Array.from(
              new Set(roles.flatMap(r => RBAC_CONFIG[r].allowedTabs))
            ).sort();
            const officerTabs = allTabs.filter(t => !t.startsWith("admin-"));
            const adminTabs = allTabs.filter(t => t.startsWith("admin-"));

            const label = (t: string) =>
              (TAB_LABELS[t] || t.replace(/^admin-/, "").replace(/-/g, " "));

            const section = (title: string, tabs: string[]) => (
              <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ background: "rgba(0,31,63,0.02)", borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield style={{ width: 15, height: 15, color: ADMIN_THEME.accentGold }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary, fontWeight: 700, minWidth: 190, position: "sticky", left: 0, background: "#fbfcfd" }}>
                          Section
                        </th>
                        {roles.map(r => (
                          <th key={r} title={RBAC_CONFIG[r].label} style={{ padding: "10px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textPrimary, fontFamily: "JetBrains Mono, monospace" }}>
                            {r}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabs.map((t, i) => (
                        <tr key={t} style={{ borderBottom: i !== tabs.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                          <td style={{ padding: "10px 16px", fontWeight: 600, textTransform: "capitalize", position: "sticky", left: 0, background: "#fff" }}>
                            {label(t)}
                          </td>
                          {roles.map(r => {
                            const allowed = RBAC_CONFIG[r].allowedTabs.includes(t);
                            const isDefault = RBAC_CONFIG[r].defaultTab === t;
                            return (
                              <td key={r} style={{ padding: "10px 8px", textAlign: "center" }}>
                                {allowed ? (
                                  <span title={isDefault ? "Allowed — and this role's landing page" : "Allowed"} style={{ color: isDefault ? ADMIN_THEME.accentGold : ADMIN_THEME.green, fontWeight: 800 }}>
                                    {isDefault ? "★" : "✓"}
                                  </span>
                                ) : (
                                  <span title="No access" style={{ color: "#e2e8f0", fontWeight: 800 }}>—</span>
                                )}
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

            return (
              <>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14, fontSize: 11, color: ADMIN_THEME.textSecondary }}>
                  <span><strong style={{ color: ADMIN_THEME.green }}>✓</strong> allowed</span>
                  <span><strong style={{ color: ADMIN_THEME.accentGold }}>★</strong> allowed, and where this role lands after sign-in</span>
                  <span><strong style={{ color: "#cbd5e1" }}>—</strong> no access</span>
                </div>
                {section("Officer Sections", officerTabs)}
                {section("Admin Controls", adminTabs)}

                <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ background: "rgba(0,31,63,0.02)", borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Roles In Use
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Role</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Label</th>
                        {/*
                          Clearance was not shown here at all. With three tracks
                          (ISD for police, ORCA for engineering, CRB for the
                          records bureau) the role name no longer implies the
                          level, so the screen that explains roles has to say it.
                        */}
                        <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Clearance</th>
                        <th style={{ padding: "10px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Writes</th>
                        <th style={{ padding: "10px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Sections</th>
                        <th style={{ padding: "10px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Officers Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRoles.map((r, i) => {
                        const assigned = officers.filter(o => o.dashboardRole === r).length;
                        const isDeprecated = DEPRECATED_ROLES.has(r);
                        return (
                          <tr key={r} style={{ borderBottom: i !== allRoles.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none", opacity: isDeprecated ? 0.6 : 1 }}>
                            <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                              {r}
                              {isDeprecated && (
                                <span title="Superseded. Still resolves for accounts that hold it, but cannot be assigned." style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 4, padding: "1px 5px", fontFamily: "JetBrains Mono, monospace" }}>
                                  DEPRECATED
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 16px" }}>{RBAC_CONFIG[r].label}</td>
                            <td style={{ padding: "10px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }} title={CLEARANCE_LABEL[RBAC_CONFIG[r].clearance] || ""}>
                              {RBAC_CONFIG[r].clearance}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "center", fontSize: 11 }}>
                              {RBAC_CONFIG[r].writeAccess === "none"
                                ? <span title="Read only — every mutating route refuses" style={{ color: ADMIN_THEME.textMuted }}>read only</span>
                                : RBAC_CONFIG[r].writeAccess === "operational"
                                  ? <span title="Day-to-day records, but not configuration, roles or clearances">operational</span>
                                  : <span title="Everything, including configuration and access">full</span>}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "center" }}>{RBAC_CONFIG[r].allowedTabs.length}</td>
                            <td style={{ padding: "10px 16px", textAlign: "center", fontWeight: 700, color: assigned ? ADMIN_THEME.textPrimary : ADMIN_THEME.textMuted }}>
                              {assigned}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {adminTab === "admin-verification" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Document Verification Oversight</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>Sealed documents and the scans performed against them</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={verStatusFilter}
                onChange={e => setVerStatusFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All documents</option>
                <option value="scanned">Scanned at least once</option>
                <option value="unscanned">Never scanned</option>
              </select>
              <div style={{ position: "relative" }}>
                <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={verSearch}
                  onChange={e => setVerSearch(e.target.value)}
                  style={{
                    background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`,
                    borderRadius: 6, padding: "6px 10px 6px 28px", fontSize: 12,
                    color: ADMIN_THEME.textPrimary, width: 200, outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
            {([
              ["Documents Sealed", verifications.length, ADMIN_THEME.textPrimary],
              ["Scans Performed", verifications.reduce((n: number, v: any) => n + v.scanCount, 0), ADMIN_THEME.textPrimary],
              ["Never Scanned", verifications.filter((v: any) => v.scanCount === 0).length, ADMIN_THEME.textSecondary],
              ["Failed Scans", admin.failedScans.length, admin.failedScans.length ? ADMIN_THEME.red : ADMIN_THEME.green],
            ] as const).map(([label, value, colour]) => (
              <div key={label} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: colour as string, marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Scans that did not verify. Surfaced above the ledger because a
              failed scan is the thing an administrator needs to see first. */}
          {admin.failedScans.length > 0 && (
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.red}55`, borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${ADMIN_THEME.border}`, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", color: ADMIN_THEME.red }}>
                Scans That Did Not Verify
              </div>
              {admin.failedScans.map((f: any, idx: number) => (
                <div key={f.scanId || idx} style={{ padding: "12px 16px", borderBottom: idx !== admin.failedScans.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{f.documentName || f.crimeNo || f.verificationId || "Unidentified document"}</div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>
                      {f.status}{f.error ? ` — ${f.error}` : ""}
                    </div>
                    <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, marginTop: 3 }}>Scanned by {f.scannedBy || "unknown"}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                    {f.scannedAt ? new Date(f.scannedAt.replace(" ", "T")).toLocaleString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            {filteredVerifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                {verifications.length === 0
                  ? "No documents have been sealed yet. A document enters this ledger when it is registered at print time."
                  : "No document matches this filter."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `2px solid ${ADMIN_THEME.border}` }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Verification ID</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Crime Number</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Sealed</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Issued By</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>SHA-256</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", color: ADMIN_THEME.textSecondary }}>Scans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVerifications.map((v: any, idx: number) => (
                      <tr key={v.verificationId || idx} style={{ borderBottom: idx !== filteredVerifications.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                        <td style={{ padding: "13px 16px", fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.accentGold }}>{v.verificationId}</td>
                        <td style={{ padding: "13px 16px", fontFamily: "JetBrains Mono, monospace" }}>{v.crimeNo || "—"}</td>
                        <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                          {v.issuedAt ? new Date(v.issuedAt.replace(" ", "T")).toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "13px 16px" }}>{v.issuedBy || "—"}</td>
                        <td style={{ padding: "13px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, color: ADMIN_THEME.textSecondary }}>
                          {v.documentHash ? `${v.documentHash.slice(0, 8)}...${v.documentHash.slice(-8)}` : "no signature"}
                        </td>
                        <td style={{ padding: "13px 16px", textAlign: "center" }}>
                          {v.scanCount === 0 ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textMuted }}>never scanned</span>
                          ) : (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                              background: String(v.lastScanStatus).toUpperCase() === "VERIFIED" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                              color: String(v.lastScanStatus).toUpperCase() === "VERIFIED" ? ADMIN_THEME.green : ADMIN_THEME.red,
                            }}>
                              {v.scanCount} · {v.lastScanStatus || "unknown"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === "admin-analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Platform Analytics</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Usage counted from officer activity, sessions and the case ledger
              </p>
            </div>
            <button
              onClick={() => {
                // Exports what is on screen, including the "not measured" rows.
                // The reason travels with them so a spreadsheet cannot quietly
                // turn an absent metric into a zero.
                const rows: string[][] = [["Metric", "Value", "Note"]];
                (admin.analytics?.metrics || []).forEach((m: any) => {
                  rows.push([m.label, m.value === null ? "not measured" : String(m.value), m.unavailable || m.hint || ""]);
                });
                rows.push([]);
                rows.push(["Day", "AI Queries"]);
                (admin.analytics?.aiQueriesByDay || []).forEach((d: any) => rows.push([d.day, String(d.count)]));
                const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = `ORCA_Platform_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              disabled={!admin.analytics}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#ffffff", border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                color: ADMIN_THEME.textPrimary, cursor: admin.analytics ? "pointer" : "default",
              }}
            >
              <Download style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              <span>Export CSV</span>
            </button>
          </div>

          {!admin.analytics ? (
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 32, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
              {loading ? "Counting..." : "No analytics available."}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {admin.analytics.metrics.map((m: any) => (
                  <div key={m.key} style={{
                    background: ADMIN_THEME.cardBg,
                    border: `1px solid ${ADMIN_THEME.border}`,
                    borderTop: `3.5px solid ${m.value === null ? "#cbd5e1" : ADMIN_THEME.accentGold}`,
                    borderRadius: 8, padding: 16,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {m.label}
                    </div>
                    {m.value === null ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: ADMIN_THEME.textMuted, marginTop: 8 }}>Not measured</div>
                        <div style={{ fontSize: 10.5, color: ADMIN_THEME.textSecondary, marginTop: 5, lineHeight: 1.45 }}>{m.unavailable}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 800, color: ADMIN_THEME.textPrimary, marginTop: 6 }}>
                          {m.value.toLocaleString()}
                        </div>
                        {m.hint && <div style={{ fontSize: 10, color: ADMIN_THEME.textMuted, marginTop: 4 }}>{m.hint}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* AI queries per day. Zero-filled, so a quiet day shows as a
                  gap rather than being skipped and compressing the timeline. */}
              <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", marginBottom: 14 }}>
                  AI Queries - Last 14 Days
                </div>
                {(() => {
                  const series = admin.analytics.aiQueriesByDay;
                  const peak = Math.max(1, ...series.map((d: any) => d.count));
                  return (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                      {series.map((d: any) => (
                        <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          <div style={{ fontSize: 9, color: ADMIN_THEME.textSecondary }}>{d.count || ""}</div>
                          <div
                            title={`${d.day}: ${d.count}`}
                            style={{
                              width: "100%",
                              height: `${Math.round((d.count / peak) * 84)}px`,
                              minHeight: d.count ? 3 : 1,
                              background: d.count ? ADMIN_THEME.accentGold : "#e2e8f0",
                              borderRadius: "3px 3px 0 0",
                            }}
                          />
                          <div style={{ fontSize: 8.5, color: ADMIN_THEME.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
                            {d.day.slice(8)}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", marginBottom: 12 }}>
                    Activity by Category
                  </div>
                  {admin.analytics.activityByCategory.length === 0 ? (
                    <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>No activity recorded yet.</div>
                  ) : admin.analytics.activityByCategory.map((c: any) => (
                    <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${ADMIN_THEME.border}`, fontSize: 12 }}>
                      <span style={{ color: ADMIN_THEME.textSecondary }}>{c.category}</span>
                      <strong>{c.count}</strong>
                    </div>
                  ))}
                </div>

                <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", marginBottom: 12 }}>
                    Most Active Officers
                  </div>
                  {admin.analytics.topOfficers.length === 0 ? (
                    <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>No activity recorded yet.</div>
                  ) : admin.analytics.topOfficers.map((o: any) => (
                    <div key={o.officer} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${ADMIN_THEME.border}`, fontSize: 12 }}>
                      <span style={{ color: ADMIN_THEME.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.officer}</span>
                      <strong style={{ paddingLeft: 10 }}>{o.events}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/*
        AI MONITORING CONSOLE.

        WHAT THIS SCREEN IS

        Every officer's AI questions and the answers they were given, visible to
        any administrator who can reach this tab. That is a surveillance
        capability. It was chosen deliberately after the alternatives
        (aggregate-only, or removing the tab) were put to the user - it is not
        an accident of the implementation.

        WHAT IS REAL, AND WHAT WAS REMOVED

        The version this replaced held five invented conversations in component
        state, complete with a "confidence" percentage, a star rating, and
        statuses of FLAGGED / ESCALATED. None of those exist anywhere:

          confidence  the models return no confidence score - literals
          rating      nothing in the app ever asks an officer to rate an answer
          FLAGGED     there was no review workflow to flag anything into

        They are gone rather than approximated. What replaced them is measured:
        latency timed around the provider call, token counts from the provider's
        own usage block, the model that answered, and whether the call
        succeeded. The flags are conditions, not scores - see buildAiQueries().

        Rows written before those columns existed show "not recorded" rather
        than a zero, so an old query does not read as an instant one.
      */}
      {adminTab === "admin-ai" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>AI Monitoring Console</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Every officer's AI queries, the answers returned, and what each one cost
              </p>
            </div>
            <button
              onClick={() => {
                const rows: string[][] = [[
                  "When", "Officer", "KGID", "Module", "Query", "Response",
                  "Model", "Latency (ms)", "Prompt Tokens", "Completion Tokens",
                  "Total Tokens", "Outcome", "Flags", "Context",
                ]];
                aiVisible.forEach((c: any) => rows.push([
                  c.occurredAt, c.officer, c.badge, c.module, c.query, c.response,
                  c.model, c.latencyMs ?? "", c.promptTokens ?? "", c.completionTokens ?? "",
                  c.totalTokens ?? "", c.outcome || "not recorded", c.flags.join("; "), c.context,
                ]));
                const csv = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = `ORCA_ai_queries_${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              disabled={aiVisible.length === 0}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#fff", border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                color: ADMIN_THEME.textPrimary, cursor: aiVisible.length ? "pointer" : "default",
              }}
            >
              <Download style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* This tab shows officers' own words. Say so, on the page. */}
          <div style={{
            background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <Lock style={{ width: 16, height: 16, color: ADMIN_THEME.accentGold, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.55 }}>
              <strong style={{ color: ADMIN_THEME.textPrimary }}>This page shows what officers typed and what they were told.</strong>{" "}
              Queries are recorded for every officer and are readable by any administrator with access to this tab.
              Attachment contents are not stored — only the file name, because an attachment is sent to an
              external model provider and that is worth recording.
              {(admin.aiStats?.inlinedAttachmentRows ?? 0) > 0 && (
                <>
                  {" "}<strong style={{ color: ADMIN_THEME.red }}>
                    Except for {admin.aiStats.inlinedAttachmentRows} older quer
                    {admin.aiStats.inlinedAttachmentRows === 1 ? "y" : "ies"}.
                  </strong>{" "}
                  Those were recorded before the typed question was separated from the assembled prompt, so their
                  stored text still contains an attached file&rsquo;s contents. They are flagged in the list below.
                </>
              )}
            </div>
          </div>

          {/* Counts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {([
              ["Total Queries", admin.aiStats?.total ?? 0, ADMIN_THEME.textPrimary, null],
              ["Flagged", admin.aiStats?.flagged ?? 0, (admin.aiStats?.flagged ?? 0) ? ADMIN_THEME.accentGold : ADMIN_THEME.green, null],
              ["Failed", admin.aiStats?.failed ?? 0, (admin.aiStats?.failed ?? 0) ? ADMIN_THEME.red : ADMIN_THEME.green, null],
              ["With Attachments", admin.aiStats?.withAttachments ?? 0, "#f97316", "Left the department network"],
              [
                "Median Latency",
                admin.aiStats?.medianLatencyMs == null ? null : `${(admin.aiStats.medianLatencyMs / 1000).toFixed(2)}s`,
                ADMIN_THEME.textPrimary,
                "Median, not mean — one slow image read would skew a mean",
              ],
              [
                "Tokens Used",
                admin.aiStats?.totalTokens == null ? null : admin.aiStats.totalTokens.toLocaleString(),
                ADMIN_THEME.textPrimary,
                "From the provider's usage block",
              ],
            ] as const).map(([label, value, colour, hint]) => (
              <div key={label} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
                {value === null ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ADMIN_THEME.textMuted, marginTop: 8 }}>Not recorded</div>
                    <div style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
                      No query carries this yet.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 26, fontWeight: 800, color: colour as string, marginTop: 6 }}>{value}</div>
                    {hint && <div style={{ fontSize: 10, color: ADMIN_THEME.textMuted, marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Rows recorded before the telemetry columns existed. */}
          {(admin.aiStats?.legacyRows ?? 0) > 0 && (
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
              <Info style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted, flexShrink: 0 }} />
              {admin.aiStats.legacyRows} earlier quer{admin.aiStats.legacyRows === 1 ? "y was" : "ies were"} recorded
              before answers, latency and token counts were captured. Their question and module are real; the rest
              reads &ldquo;not recorded&rdquo; rather than zero.
            </div>
          )}

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search officer, question or answer..."
                value={aiSearch}
                onChange={e => setAiSearch(e.target.value)}
                style={{
                  width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6, padding: "7px 10px 7px 28px", fontSize: 12,
                  color: ADMIN_THEME.textPrimary, outline: "none",
                }}
              />
            </div>
            <select
              value={aiStatusFilter}
              onChange={e => setAiStatusFilter(e.target.value)}
              style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
            >
              <option value="ALL">All queries</option>
              <option value="FLAGGED">Flagged only</option>
              <option value="FAILED">Failed only</option>
              <option value="ATTACHMENT">With attachments</option>
            </select>
            <select
              value={aiOfficerFilter}
              onChange={e => setAiOfficerFilter(e.target.value)}
              style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
            >
              <option value="ALL">All officers</option>
              {Array.from(new Set(admin.aiQueries.map((c: any) => c.officer))).map((o: any) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {admin.aiQueries.length > 0 && aiVisible.length !== admin.aiQueries.length && (
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary }}>
              showing {aiVisible.length} of {admin.aiQueries.length}
            </div>
          )}

          {/* The queries */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            {aiVisible.length === 0 ? (
              <div style={{ padding: 34, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                {admin.aiQueries.length === 0
                  ? "No AI queries recorded yet."
                  : "No query matches these filters."}
              </div>
            ) : (
              aiVisible.slice(0, 200).map((c: any, idx: number, arr: any[]) => (
                <div
                  key={c.id}
                  style={{
                    padding: "14px 16px",
                    borderBottom: idx !== Math.min(199, arr.length - 1) ? `1px solid ${ADMIN_THEME.border}` : "none",
                    background: c.outcome === "ERROR" ? "rgba(239,68,68,0.03)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{c.officer}</span>
                        {c.badge && (
                          <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>
                            {c.badge}
                          </span>
                        )}
                        {c.module && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(255,153,51,0.1)", color: ADMIN_THEME.accentGold, padding: "2px 6px", borderRadius: 4 }}>
                            {c.module}
                          </span>
                        )}
                        {c.flags.map((f: string) => (
                          <span key={f} style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            background: f.startsWith("Failed") ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.18)",
                            color: f.startsWith("Failed") ? ADMIN_THEME.red : ADMIN_THEME.textSecondary,
                          }}>
                            {f}
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize: 13, color: ADMIN_THEME.textPrimary, lineHeight: 1.5 }}>
                        {c.query || <span style={{ color: ADMIN_THEME.textMuted }}>(attachment only)</span>}
                      </div>

                      {aiOpenId === c.id ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                            Answer returned
                          </div>
                          <div style={{
                            fontSize: 12.5, color: ADMIN_THEME.textPrimary, lineHeight: 1.6,
                            background: ADMIN_THEME.bg, border: `1px solid ${ADMIN_THEME.border}`,
                            borderRadius: 6, padding: 12, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto",
                          }}>
                            {c.response || (
                              <span style={{ color: ADMIN_THEME.textMuted }}>
                                Not recorded — this query predates answer capture.
                              </span>
                            )}
                          </div>
                          {c.context && (
                            <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 8 }}>
                              <strong>Context:</strong> {c.context}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>
                            <span>model: {c.model || "not recorded"}</span>
                            <span>latency: {c.latencyMs == null ? "not recorded" : `${(c.latencyMs / 1000).toFixed(2)}s`}</span>
                            <span>
                              tokens: {c.totalTokens == null
                                ? "not recorded"
                                : `${c.totalTokens} (${c.promptTokens ?? "?"} in / ${c.completionTokens ?? "?"} out)`}
                            </span>
                            <span>outcome: {c.outcome || "not recorded"}</span>
                          </div>
                        </div>
                      ) : (
                        c.response && (
                          <div style={{
                            fontSize: 12, color: ADMIN_THEME.textSecondary, marginTop: 5, lineHeight: 1.5,
                            overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>
                            {c.response}
                          </div>
                        )
                      )}
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                        {c.occurredAt ? new Date(c.occurredAt.replace(" ", "T")).toLocaleString() : "—"}
                      </div>
                      <button
                        onClick={() => setAiOpenId(aiOpenId === c.id ? null : c.id)}
                        style={{
                          marginTop: 8, background: "none", border: `1px solid ${ADMIN_THEME.border}`,
                          borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          color: ADMIN_THEME.textPrimary, cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        {aiOpenId === c.id ? "Hide" : "View"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {aiVisible.length > 200 && (
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, textAlign: "center" }}>
              Showing the 200 most recent of {aiVisible.length} matches. Narrow the filters, or export the CSV for the full set.
            </div>
          )}

          {/* Which models actually answered. Counted, not configured. */}
          {(admin.aiStats?.models?.length ?? 0) > 0 && (
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", marginBottom: 10 }}>
                Models Used
              </div>
              {admin.aiStats.models.map((m: any) => (
                <div key={m.model} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                  <span style={{ fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>{m.model}</span>
                  <strong>{m.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        AI MODEL MANAGEMENT.

        WHAT WAS REMOVED, AND WHY IT COULD NOT BE "FIXED"

        This tab showed a hardcoded version history (v3.1.8b-2026.05, "accuracy
        92.8%", RETIRED / ARCHIVED) and three buttons - Rollback, Retrain,
        Restart Service - each of which was a setTimeout that set a success
        message. Nothing was ever deployed, retrained or restarted.

        Those are not features that were merely unimplemented. They are not
        things this application can do at all: the models are hosted by NVIDIA
        and Groq, so the department does not own the weights, cannot roll a
        version back, cannot retrain, and has no service to restart. Making the
        buttons "work" was never an option - only removing them was.

        WHAT IS REAL, AND IS HERE INSTEAD

          · which models the server is configured to call, and which is active
          · whether each answers RIGHT NOW - a live probe, on demand
          · the runtime parameters actually sent, editable and persisted
          · how many queries each model answered, counted from OfficerActivity

        The three parameter controls used to be dead too. They now write to the
        SystemSetting table and /api/chat reads them per request, so moving a
        slider changes the next answer.
      */}
      {adminTab === "admin-model" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>AI Model Management</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Configured models, live reachability, and the parameters sent with every query
              </p>
            </div>
            <button
              onClick={() => loadModels(true)}
              disabled={modelsLoading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#fff", border: `1px solid ${ADMIN_THEME.border}`,
                borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                color: ADMIN_THEME.textPrimary, cursor: modelsLoading ? "default" : "pointer",
              }}
            >
              <Zap style={{ width: 14, height: 14, color: ADMIN_THEME.accentGold }} />
              {modelsLoading ? "Probing…" : "Test Connectivity"}
            </button>
          </div>

          <div style={{
            background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <Info style={{ width: 16, height: 16, color: ADMIN_THEME.accentGold, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.55 }}>
              <strong style={{ color: ADMIN_THEME.textPrimary }}>These models are hosted by NVIDIA and Groq.</strong>{" "}
              The department does not hold the weights, so versions cannot be rolled back, models cannot be
              retrained, and there is no service here to restart. The Rollback / Retrain / Restart buttons that
              used to sit on this page did none of those things. What can be changed is which model is called
              and how it is called — that is below.
            </div>
          </div>

          {modelsError && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: `1px solid ${ADMIN_THEME.red}55`,
              borderRadius: 8, padding: "12px 16px", fontSize: 12, color: ADMIN_THEME.textPrimary,
            }}>
              {modelsError}
            </div>
          )}

          {/* Configured models */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {(modelInfo?.models || []).map((m: any) => (
              <div key={`${m.role}-${m.id}`} style={{
                background: ADMIN_THEME.cardBg,
                border: `1px solid ${m.active ? ADMIN_THEME.accentGold + "66" : ADMIN_THEME.border}`,
                borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: ADMIN_THEME.textSecondary }}>
                        {m.role}
                      </span>
                      {m.active ? (
                        <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(16,185,129,0.12)", color: "#047857", padding: "2px 6px", borderRadius: 4 }}>
                          IN USE
                        </span>
                      ) : m.configured ? (
                        <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(148,163,184,0.18)", color: ADMIN_THEME.textSecondary, padding: "2px 6px", borderRadius: 4 }}>
                          STANDBY
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.12)", color: ADMIN_THEME.red, padding: "2px 6px", borderRadius: 4 }}>
                          NO KEY
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 5, fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                      {m.id}
                    </div>
                    <div style={{ fontSize: 11, color: ADMIN_THEME.textSecondary, marginTop: 2 }}>{m.provider}</div>
                  </div>
                  <Cpu style={{ width: 18, height: 18, color: m.active ? ADMIN_THEME.accentGold : ADMIN_THEME.textMuted, flexShrink: 0 }} />
                </div>

                <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.5 }}>{m.note}</div>

                {/* Probe result. Absent until asked for — it costs a real call. */}
                <div style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 7 }}>
                  {m.reachable === true && (
                    <>
                      <span style={{ color: ADMIN_THEME.green, fontWeight: 800 }}>●</span>
                      <span style={{ color: ADMIN_THEME.textPrimary }}>
                        Answered in {m.probeLatencyMs} ms
                      </span>
                    </>
                  )}
                  {m.reachable === false && (
                    <>
                      <span style={{ color: ADMIN_THEME.red, fontWeight: 800 }}>●</span>
                      <span style={{ color: ADMIN_THEME.red }}>{m.probeError || "Did not answer"}</span>
                    </>
                  )}
                  {(m.reachable === undefined || m.reachable === null) && (
                    <span style={{ color: ADMIN_THEME.textMuted }}>
                      {m.configured ? "Not tested — press Test Connectivity" : "No key configured"}
                    </span>
                  )}
                </div>

                {/* Usage, counted from OfficerActivity. */}
                <div style={{ borderTop: `1px solid ${ADMIN_THEME.border}`, paddingTop: 10, display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>
                  <span>queries: {m.queries}</span>
                  <span>failures: {m.failures}</span>
                  <span>median: {m.medianLatencyMs == null ? "—" : `${(m.medianLatencyMs / 1000).toFixed(2)}s`}</span>
                  <span>tokens: {m.totalTokens ? m.totalTokens.toLocaleString() : "—"}</span>
                </div>
              </div>
            ))}
          </div>

          {(modelInfo?.unattributedQueries ?? 0) > 0 && (
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, display: "flex", gap: 8, alignItems: "center" }}>
              <Info style={{ width: 14, height: 14, color: ADMIN_THEME.textMuted, flexShrink: 0 }} />
              {modelInfo.unattributedQueries} of {modelInfo.totalQueries} recorded quer
              {modelInfo.totalQueries === 1 ? "y" : "ies"} predate model attribution, so they are not counted
              against any model above.
            </div>
          )}

          {/* Runtime parameters — real, stored, read by /api/chat. */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "rgba(0,31,63,0.02)", borderBottom: `1px solid ${ADMIN_THEME.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>
                Runtime Parameters
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setSettingsDraft(d => ({ ...d, ...aiSpecDefaults }));
                    setAdminNotice({ kind: "success", text: "Reset to the built-in defaults. Press Save to apply." });
                  }}
                  style={{
                    background: "#fff", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6,
                    padding: "6px 12px", fontSize: 11.5, fontWeight: 600, color: ADMIN_THEME.textPrimary, cursor: "pointer",
                  }}
                >
                  Restore Defaults
                </button>
                <button
                  onClick={() => handleSaveSettings()}
                  disabled={actionLoading || !aiSettingsDirty}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: aiSettingsDirty ? "#001f3f" : "#94a3b8",
                    border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11.5,
                    fontWeight: 600, color: "#fff", cursor: aiSettingsDirty ? "pointer" : "default",
                  }}
                >
                  <Check style={{ width: 13, height: 13 }} />
                  {aiSettingsDirty ? "Save Parameters" : "No Changes"}
                </button>
              </div>
            </div>

            {aiSpecs.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                {loading ? "Reading parameters…" : "Parameters unavailable."}
              </div>
            ) : aiSpecs.map((spec: any, idx: number) => {
              const value = settingsDraft[spec.key];
              const changed = String(value) !== String(admin.settings[spec.key]);
              return (
                <div key={spec.key} style={{
                  padding: "14px 16px",
                  borderBottom: idx !== aiSpecs.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none",
                  background: changed ? "rgba(255,153,51,0.04)" : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: spec.multiline ? "wrap" : "nowrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{spec.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(16,185,129,0.12)", color: "#047857", textTransform: "uppercase" }}>
                          Sent with every query
                        </span>
                        {changed && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase" }}>unsaved</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                        {spec.note}
                      </div>
                    </div>

                    {!spec.multiline && (
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="range"
                          min={spec.min}
                          max={spec.max}
                          step={spec.step ?? 1}
                          value={Number(value ?? spec.fallback)}
                          onChange={e => setSettingsDraft(d => ({ ...d, [spec.key]: Number(e.target.value) }))}
                          style={{ width: 170, accentColor: "#FF9933" }}
                        />
                        <span style={{ minWidth: 54, textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: ADMIN_THEME.accentGold }}>
                          {String(value ?? spec.fallback)}
                        </span>
                      </div>
                    )}
                  </div>

                  {spec.multiline && (
                    <textarea
                      value={String(value ?? "")}
                      onChange={e => setSettingsDraft(d => ({ ...d, [spec.key]: e.target.value }))}
                      rows={7}
                      spellCheck={false}
                      style={{
                        width: "100%", marginTop: 10, padding: 12,
                        border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6,
                        fontSize: 12, lineHeight: 1.6, fontFamily: "JetBrains Mono, monospace",
                        color: ADMIN_THEME.textPrimary, resize: "vertical", outline: "none",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* How a query is actually assembled. Documents the parts that are
              NOT editable above, so nobody assumes the textarea is the whole
              instruction the model receives. */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono", marginBottom: 10 }}>
              What Is Sent With A Question
            </div>
            <ol style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
              <li>The system prompt above.</li>
              <li>A language mandate, when the officer has selected Hindi or Kannada. <em>Added in code.</em></li>
              <li>The module the officer is viewing, and the active case number if one is loaded. <em>Added in code.</em></li>
              <li>The last {String(settingsDraft["ai.historyMessages"] ?? 6)} messages of the conversation.</li>
              <li>
                For an attachment: the image is read by the vision model first, and its transcription is
                handed to the answering model as ordinary text. The picture itself never reaches the
                answering model.
              </li>
              <li>The officer&rsquo;s question.</li>
            </ol>
          </div>
        </div>
      )}

      {adminTab === "admin-audit" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Audit Log</h1>
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

          {/*
            The audit table.

            Columns changed because the underlying table did. OfficerAuditLog
            records WHAT changed — an old value and a new one — which the old
            Firestore version could not: it stored a prose sentence per entry.

            The "Ingress IP Address" column is gone. It fell back to the literal
            "10.0.12.94 (Encrypted Proxy)" whenever a row had no address, which
            was every row, so the audit trail displayed an invented source for
            every change ever made. The IP of a change belongs to the session
            that made it and is shown, for real, in the Security Center.
          */}
          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            {filteredAuditLogs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                {auditLogs.length === 0
                  ? "No changes have been recorded yet."
                  : "No entries match this filter."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `2px solid ${ADMIN_THEME.border}` }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>When</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Change</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Subject</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Before → After</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>By</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log, idx) => {
                      const when = log.changedAt
                        ? new Date(log.changedAt.replace(" ", "T")).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })
                        : "—";
                      const subject = officers.find(o => o.uid === log.firebaseUid);
                      return (
                        <tr key={log.logId ?? idx} style={{ borderBottom: idx !== filteredAuditLogs.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none", verticalAlign: "top" }}>
                          <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary, whiteSpace: "nowrap" }}>{when}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "rgba(255,153,51,0.08)", color: ADMIN_THEME.accentGold, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {prettyChangeType(log.changeType)}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                            {subject?.name || (log.firebaseUid ? `${log.firebaseUid.slice(0, 10)}…` : "—")}
                          </td>
                          <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 10.5, maxWidth: 340 }}>
                            {log.oldValue && <div style={{ color: ADMIN_THEME.textSecondary, wordBreak: "break-word" }}>{log.oldValue}</div>}
                            {log.newValue && <div style={{ color: ADMIN_THEME.textPrimary, wordBreak: "break-word" }}>→ {log.newValue}</div>}
                            {!log.oldValue && !log.newValue && <span style={{ color: ADMIN_THEME.textMuted }}>—</span>}
                          </td>
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>{log.changedBy || "—"}</td>
                          <td style={{ padding: "12px 16px", color: ADMIN_THEME.textSecondary, maxWidth: 260 }}>{log.reason || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. SYSTEM SETTINGS */}
      {/*
        SYSTEM SETTINGS.

        The Save button here used to be:

            setTimeout(() => { setSettingsSuccess(true); }, 1200)

        It wrote nothing. Reloading the page reverted every change, so an
        administrator could believe MFA had been enforced when it had not.

        Two problems were tangled together and are now separated:

          PERSISTENCE  every value below is stored in the SystemSetting table,
                       and each change writes an audit row with old and new.
          ENFORCEMENT  most of these describe behaviour owned by Firebase Auth
                       or the hosting platform, not by this application. The
                       badge on each control says which. A stored-but-unenforced
                       setting is a recorded policy decision - as long as it
                       says so rather than implying the system obeys it.

        The catalogue lives in src/lib/systemSettings.ts. Adding a setting there
        makes it appear here; there is no second list to keep in step.
      */}
      {adminTab === "admin-settings" && (
        <div style={{ position: "relative" }}>
          {actionLoading && (
            <div style={{
              position: "fixed", inset: 0, background: "rgba(10, 25, 47, 0.25)",
              backdropFilter: "blur(3px)", display: "flex", alignItems: "center",
              justifyContent: "center", zIndex: 9999,
            }}>
              <div style={{
                background: "#fff", padding: "24px 32px", borderRadius: 12,
                border: `1px solid ${ADMIN_THEME.border}`, boxShadow: ADMIN_THEME.shadowMd,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
              }}>
                <Loader2 style={{ width: 28, height: 28, color: "#001f3f", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Saving...</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>System Settings</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Stored in Catalyst. Each control states whether this application enforces it.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  // Reverts the DRAFT to what is stored, not to factory values.
                  // The old Reset button set hardcoded defaults and then showed
                  // "saved", which silently discarded the real configuration.
                  setSettingsDraft({ ...admin.settings });
                  setAdminNotice({ kind: "success", text: "Reverted to the saved values." });
                }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, background: "#fff",
                  border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "7px 14px",
                  fontSize: 12, fontWeight: 600, color: ADMIN_THEME.textPrimary, cursor: "pointer",
                }}
              >
                <History style={{ width: 14, height: 14, color: ADMIN_THEME.textSecondary }} />
                <span>Discard Changes</span>
              </button>
              <button
                onClick={() => handleSaveSettings()}
                disabled={actionLoading || !settingsDirty}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: settingsDirty ? "#001f3f" : "#94a3b8",
                  border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12,
                  fontWeight: 600, color: "#fff", cursor: settingsDirty ? "pointer" : "default",
                }}
              >
                <Check style={{ width: 14, height: 14 }} />
                <span>{settingsDirty ? "Save Changes" : "No Changes"}</span>
              </button>
            </div>
          </div>

          {settingsSuccess && (
            <div style={{
              background: "#ecfdf5", border: `1px solid ${ADMIN_THEME.green}`, color: "#065f46",
              borderRadius: 8, padding: "12px 16px", fontSize: 13, fontWeight: 600,
              marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
            }}>
              <Check style={{ width: 16, height: 16 }} />
              <span>Settings written to the database and recorded in the audit trail.</span>
            </div>
          )}

          {admin.settingSpecs.length === 0 ? (
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 32, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
              {loading ? "Reading settings..." : "Settings are unavailable."}
            </div>
          ) : (
            // `hiddenFromSettings` keeps the AI runtime parameters off this
            // screen — they are edited on AI Model Management, beside the
            // models they configure. Same store, same save route.
            Array.from(new Set(admin.settingSpecs.filter((s: any) => !s.hiddenFromSettings).map((s: any) => s.group))).map((group: any) => (
              <div key={group} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, marginBottom: 18, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${ADMIN_THEME.border}`, background: "rgba(0,31,63,0.02)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>
                  {group}
                </div>
                {admin.settingSpecs.filter((s: any) => s.group === group && !s.hiddenFromSettings).map((spec: any, idx: number, arr: any[]) => {
                  const value = settingsDraft[spec.key];
                  const changed = String(value) !== String(admin.settings[spec.key]);
                  return (
                    <div key={spec.key} style={{
                      padding: "14px 16px",
                      borderBottom: idx !== arr.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20,
                      background: changed ? "rgba(255,153,51,0.04)" : "transparent",
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{spec.label}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4,
                            textTransform: "uppercase", letterSpacing: "0.04em",
                            background: spec.enforcement === "enforced" ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.18)",
                            color: spec.enforcement === "enforced" ? "#047857" : ADMIN_THEME.textSecondary,
                          }}>
                            {spec.enforcement === "enforced" ? "Enforced here"
                              : spec.enforcement === "firebase" ? "Firebase Auth"
                              : spec.enforcement === "infrastructure" ? "Platform"
                              : "Recorded only"}
                          </span>
                          {changed && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: ADMIN_THEME.accentGold, textTransform: "uppercase" }}>unsaved</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                          {spec.note}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {spec.type === "boolean" ? (
                          <button
                            onClick={() => setSettingsDraft(d => ({ ...d, [spec.key]: !value }))}
                            style={{
                              width: 46, height: 25, borderRadius: 13, border: "none", cursor: "pointer",
                              background: value ? ADMIN_THEME.green : "#cbd5e1",
                              position: "relative", transition: "background 0.15s",
                            }}
                            aria-pressed={Boolean(value)}
                            aria-label={spec.label}
                          >
                            <span style={{
                              position: "absolute", top: 3, left: value ? 24 : 3,
                              width: 19, height: 19, borderRadius: 10, background: "#fff",
                              transition: "left 0.15s",
                            }} />
                          </button>
                        ) : spec.type === "number" ? (
                          <input
                            type="number"
                            value={value ?? ""}
                            min={spec.min}
                            max={spec.max}
                            onChange={e => setSettingsDraft(d => ({ ...d, [spec.key]: e.target.value === "" ? "" : Number(e.target.value) }))}
                            style={{
                              width: 110, padding: "7px 10px", border: `1px solid ${ADMIN_THEME.border}`,
                              borderRadius: 6, fontSize: 13, textAlign: "right", fontFamily: "JetBrains Mono, monospace",
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(value ?? "")}
                            onChange={e => setSettingsDraft(d => ({ ...d, [spec.key]: e.target.value }))}
                            style={{
                              width: 200, padding: "7px 10px", border: `1px solid ${ADMIN_THEME.border}`,
                              borderRadius: 6, fontSize: 13,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
                }
              </div>
            ))
          )}
        </div>
      )}

      {adminTab === "admin-security" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Security Center</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Sign-in activity across all officer accounts, and the conditions worth a look
              </p>
            </div>
            <div style={{ position: "relative" }}>
              <Search style={{ width: 12, height: 12, color: ADMIN_THEME.textSecondary, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search officer or address..."
                value={securitySearch}
                onChange={e => setSecuritySearch(e.target.value)}
                style={{
                  background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6, padding: "6px 10px 6px 28px", fontSize: 12,
                  color: ADMIN_THEME.textPrimary, width: 220, outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
            {([
              ["Sessions Recorded", admin.sessions.length, ADMIN_THEME.textPrimary],
              ["Currently Open", admin.sessions.filter((x: any) => x.status === "ACTIVE").length, ADMIN_THEME.green],
              ["Events Flagged", admin.security.length, admin.security.length ? ADMIN_THEME.accentGold : ADMIN_THEME.green],
              ["High or Critical", admin.security.filter((e: any) => e.severity === "HIGH" || e.severity === "CRITICAL").length, admin.security.some((e: any) => e.severity === "HIGH" || e.severity === "CRITICAL") ? ADMIN_THEME.red : ADMIN_THEME.green],
              ["Distinct Addresses", new Set(admin.sessions.map((x: any) => x.ipAddress).filter(Boolean)).size, ADMIN_THEME.textPrimary],
            ] as const).map(([label, value, colour]) => (
              <div key={label} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: colour as string, marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* What this screen cannot see. Stated, not implied. */}
          {admin.securityBlindSpots.length > 0 && (
            <div style={{
              background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.25)",
              borderRadius: 8, padding: "12px 16px", marginBottom: 20,
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <Info style={{ width: 16, height: 16, color: ADMIN_THEME.accentGold, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: ADMIN_THEME.accentGold, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Not visible from here
                </div>
                {admin.securityBlindSpots.map((b: string, i: number) => (
                  <div key={i} style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.5, marginBottom: 3 }}>- {b}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${ADMIN_THEME.border}`, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>
              Flagged Events
            </div>
            {(() => {
              const q = securitySearch.toLowerCase();
              const shown = admin.security.filter((e: any) =>
                !q || `${e.officer} ${e.ip} ${e.title}`.toLowerCase().includes(q)
              );
              if (!shown.length) {
                return (
                  <div style={{ padding: 28, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>
                    {admin.security.length === 0
                      ? "Nothing flagged. Every recorded session closed normally and came from an address already seen for that officer."
                      : "No flagged event matches that search."}
                  </div>
                );
              }
              return shown.map((e: any, idx: number) => (
                <div key={e.id} style={{ padding: "14px 16px", borderBottom: idx !== shown.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{
                    marginTop: 3, fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                    background: e.severity === "CRITICAL" || e.severity === "HIGH" ? `${ADMIN_THEME.red}18` : e.severity === "MEDIUM" ? `${ADMIN_THEME.accentGold}20` : "rgba(148,163,184,0.15)",
                    color: e.severity === "CRITICAL" || e.severity === "HIGH" ? ADMIN_THEME.red : e.severity === "MEDIUM" ? ADMIN_THEME.accentGold : ADMIN_THEME.textSecondary,
                  }}>{e.severity}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 2, lineHeight: 1.5 }}>{e.detail}</div>
                    <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                      {e.officer}{e.ip ? ` · ${e.ip}` : ""}{e.userAgent ? ` · ${e.userAgent}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                    {e.occurredAt ? new Date(e.occurredAt.replace(" ", "T")).toLocaleString() : "—"}
                  </div>
                </div>
              ));
            })()}
          </div>

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${ADMIN_THEME.border}`, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "JetBrains Mono" }}>
              Sign-in History - All Officers
            </div>
            {admin.sessions.length === 0 ? (
              <div style={{ padding: 28, textAlign: "center", color: ADMIN_THEME.textSecondary, fontSize: 13 }}>No sessions recorded.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Officer</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Signed In</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Signed Out</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Duration</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Address</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: ADMIN_THEME.textSecondary }}>Ended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.sessions
                      .filter((x: any) => {
                        const q = securitySearch.toLowerCase();
                        if (!q) return true;
                        const who = officers.find(o => o.uid === x.firebaseUid)?.name || x.firebaseUid;
                        return `${who} ${x.ipAddress}`.toLowerCase().includes(q);
                      })
                      .slice(0, 200)
                      .map((x: any, idx: number, arr: any[]) => {
                        const who = officers.find(o => o.uid === x.firebaseUid);
                        const mins = x.durationSeconds ? Math.round(x.durationSeconds / 60) : null;
                        return (
                          <tr key={`${x.sessionId}-${x.loginAt}-${idx}`} style={{ borderBottom: idx !== arr.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none" }}>
                            <td style={{ padding: "11px 16px", fontWeight: 600 }}>{who?.name || `${String(x.firebaseUid).slice(0, 10)}...`}</td>
                            <td style={{ padding: "11px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                              {x.loginAt ? new Date(x.loginAt.replace(" ", "T")).toLocaleString() : "—"}
                            </td>
                            <td style={{ padding: "11px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                              {x.logoutAt ? new Date(x.logoutAt.replace(" ", "T")).toLocaleString() : <span style={{ color: ADMIN_THEME.green, fontWeight: 700 }}>still open</span>}
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              {mins === null ? "—" : mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}
                            </td>
                            <td style={{ padding: "11px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                              {/* Never substituted. A blank address means the request
                                  carried none - see requestIp.ts and HANDOFF section 26. */}
                              {x.ipAddress || <span style={{ color: ADMIN_THEME.textMuted }}>not recorded</span>}
                            </td>
                            <td style={{ padding: "11px 16px", fontSize: 11, color: ADMIN_THEME.textSecondary }}>{x.endReason || "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/*
        REPORTS & NOTIFICATIONS.

        NOTIFICATIONS are derived on read, not stored. A stored notification
        needs a writer, a read/unread state per administrator and a retention
        rule - three moving parts whose only job would be to restate facts the
        database already holds, and which can then fall out of step with it.
        Deriving them means an application that gets approved simply stops
        being a pending application, and its notification disappears without
        anyone having to remember to delete it.

        The trade-off, stated plainly: there is no per-administrator "mark as
        read", because there is nowhere to record it. The old screen had a
        "Mark all read" button over five hardcoded entries, so it dismissed
        nothing and re-appeared identically on the next render. If dismissal
        turns out to matter, that is the point at which a table earns its place.
        See buildNotifications() in src/lib/adminInsights.ts.

        REPORTS export the real rows. The previous version ran a setTimeout and
        then wrote a CSV containing the report's own name and the word
        "Generated" - no data ever left the screen.
      */}
      {/*
        UNAUTHORISED ACCESS WARNINGS.

        Every occasion an officer's session was found on a network the
        department does not trust — a commercial VPN or an anonymising proxy —
        and whether that ended in a forced sign-out.

        These used to go to the Firestore `audit_logs` collection, which nothing
        reads any more, so the alerts were written and then lost. They are now
        rows in Catalyst `SecurityAlert`, raised by the server after it
        re-checks the network itself rather than trusting what the browser
        reported.

        ONE ROW PER OFFICER PER SESSION, not one per poll. The browser checks
        every five seconds while a VPN is up; the old code wrote a record each
        time, so a five-minute connection would have produced sixty identical
        entries and buried anything real.

        There is no delete. Acknowledging records who reviewed it and when; the
        row stays. A warning an administrator can make disappear is not a record.
      */}
      {adminTab === "admin-support" && <SupportTicketQueue />}

      {adminTab === "admin-warnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Unauthorised Access Warnings</h1>
              <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
                Sessions found on untrusted networks, and what happened to them
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <select
                value={warnFilter}
                onChange={e => setWarnFilter(e.target.value)}
                style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "7px 10px", fontSize: 12, color: ADMIN_THEME.textPrimary }}
              >
                <option value="ALL">All warnings</option>
                <option value="UNREVIEWED">Not yet reviewed</option>
                <option value="LOCKED_OUT">Ended in sign-out</option>
                <option value="WARNED">Warned only</option>
              </select>
              <button
                onClick={() => loadWarnings()}
                disabled={warnLoading}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "#fff", border: `1px solid ${ADMIN_THEME.border}`,
                  borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                  color: ADMIN_THEME.textPrimary, cursor: warnLoading ? "default" : "pointer",
                }}
              >
                <History style={{ width: 14, height: 14 }} />
                {warnLoading ? "Reading…" : "Refresh"}
              </button>
            </div>
          </div>

          {warnError && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: `1px solid ${ADMIN_THEME.red}55`,
              borderRadius: 8, padding: "12px 16px", fontSize: 12,
            }}>{warnError}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            {([
              ["Total Warnings", warnData?.stats?.total ?? 0, ADMIN_THEME.textPrimary],
              ["Ended In Sign-out", warnData?.stats?.lockedOut ?? 0, (warnData?.stats?.lockedOut ?? 0) ? ADMIN_THEME.red : ADMIN_THEME.green],
              ["Warned Only", warnData?.stats?.warned ?? 0, ADMIN_THEME.accentGold],
              ["Not Yet Reviewed", warnData?.stats?.unreviewed ?? 0, (warnData?.stats?.unreviewed ?? 0) ? ADMIN_THEME.accentGold : ADMIN_THEME.green],
              ["Officers Involved", warnData?.stats?.officers ?? 0, ADMIN_THEME.textPrimary],
            ] as const).map(([label, value, colour]) => (
              <div key={label} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: colour as string, marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* What this can and cannot conclude. */}
          <div style={{
            background: "rgba(255,153,51,0.06)", border: "1px solid rgba(255,153,51,0.25)",
            borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <Info style={{ width: 16, height: 16, color: ADMIN_THEME.accentGold, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.55 }}>
              <strong style={{ color: ADMIN_THEME.textPrimary }}>A warning is not proof of misconduct.</strong>{" "}
              It records that a session came from a network identified as a commercial VPN or an anonymising
              proxy — which can be an officer working from a hotel, a home router with a VPN app, or a
              mis-classified ISP. Data-centre addresses are recorded but never cause a sign-out on their own.
              Whether a sign-out follows is controlled by <em>Block VPN / Proxy Connections</em> in System Settings.
            </div>
          </div>

          <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
            {warnVisible.length === 0 ? (
              <div style={{ padding: 34, textAlign: "center" }}>
                <ShieldCheck style={{ width: 34, height: 34, color: ADMIN_THEME.green, margin: "0 auto 10px" }} />
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {(warnData?.alerts?.length ?? 0) === 0
                    ? "No unauthorised access recorded"
                    : "No warning matches this filter"}
                </div>
                <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>
                  {(warnData?.alerts?.length ?? 0) === 0
                    ? "Every recorded session has come from a network the department accepts."
                    : "Change the filter to see the rest."}
                </div>
              </div>
            ) : (
              warnVisible.map((a: any, idx: number) => (
                <div key={a.rowId} style={{
                  padding: "14px 16px",
                  borderBottom: idx !== warnVisible.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none",
                  background: a.outcome === "LOCKED_OUT" ? "rgba(239,68,68,0.03)" : "transparent",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <span style={{
                    marginTop: 3, fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                    background: a.outcome === "LOCKED_OUT" ? `${ADMIN_THEME.red}18` : `${ADMIN_THEME.accentGold}20`,
                    color: a.outcome === "LOCKED_OUT" ? ADMIN_THEME.red : ADMIN_THEME.accentGold,
                  }}>
                    {a.outcome === "LOCKED_OUT" ? "SIGNED OUT" : "WARNED"}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{a.officer}</span>
                      {a.badge && (
                        <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: ADMIN_THEME.textSecondary }}>{a.badge}</span>
                      )}
                      {a.district && (
                        <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary }}>{a.district}</span>
                      )}
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(148,163,184,0.18)", color: ADMIN_THEME.textSecondary,
                      }}>{a.severity}</span>
                    </div>

                    <div style={{ fontSize: 12, color: ADMIN_THEME.textPrimary, marginTop: 4, lineHeight: 1.5 }}>
                      {a.reason || "Untrusted network"}
                    </div>

                    <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                      {/* Never substituted — a blank address means the platform sent
                          no forwarding header. See requestIp.ts. */}
                      {a.ipAddress || "address not recorded"}
                      {a.networkName ? ` · ${a.networkName}` : ""}
                      {a.countryCode ? ` · ${a.countryCode}` : ""}
                    </div>

                    {a.acknowledgedAt && (
                      <div style={{ fontSize: 10.5, color: ADMIN_THEME.green, marginTop: 4 }}>
                        Reviewed by {a.acknowledgedBy} on{" "}
                        {new Date(a.acknowledgedAt.replace(" ", "T")).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                      {a.detectedAt ? new Date(a.detectedAt.replace(" ", "T")).toLocaleString() : "—"}
                    </div>
                    {!a.acknowledgedAt && (
                      <button
                        onClick={() => acknowledgeWarning(a.rowId)}
                        style={{
                          marginTop: 8, background: "none", border: `1px solid ${ADMIN_THEME.border}`,
                          borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                          color: ADMIN_THEME.textPrimary, cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        Mark reviewed
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {adminTab === "admin-reports" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: ADMIN_THEME.textPrimary }}>Reports &amp; Notifications</h1>
            <p style={{ fontSize: 12, color: ADMIN_THEME.textSecondary }}>
              Export administrative records, and review what currently needs attention
            </p>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${ADMIN_THEME.border}` }}>
            {([["reports", "Reports"], ["notifications", `Needs Attention${admin.notifications.length ? ` (${admin.notifications.length})` : ""}`]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setReportsSubTab(id as "reports" | "notifications")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 14px", fontSize: 13, fontWeight: 700,
                  color: reportsSubTab === id ? ADMIN_THEME.textPrimary : ADMIN_THEME.textSecondary,
                  borderBottom: reportsSubTab === id ? `2px solid ${ADMIN_THEME.accentGold}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {reportsSubTab === "reports" ? (
            <>
              {reportsSuccessMsg && (
                <div style={{ background: "#ecfdf5", border: `1px solid ${ADMIN_THEME.green}`, color: "#065f46", borderRadius: 8, padding: "12px 16px", fontSize: 13, fontWeight: 600, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                  <Check style={{ width: 16, height: 16 }} />
                  <span>{reportsSuccessMsg}</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                {([
                  {
                    id: "officers",
                    title: "Officer Directory",
                    desc: "Every account with its personnel record, posting, role and clearance.",
                    rows: () => [
                      ["UID", "KGID", "Name", "Rank", "Designation", "District", "Unit", "Role", "Clearance", "Active", "Employee ID", "Email", "Mobile", "Last Login"],
                      ...officers.map(o => [o.uid, o.badgeId, o.name, o.rank, o.designation, o.district, o.station, o.dashboardRole, o.clearanceLevel, o.active ? "yes" : "no", o.employeeId ?? "MISSING", o.email, o.mobile, o.lastLogin]),
                    ],
                  },
                  {
                    id: "applications",
                    title: "Registration Applications",
                    desc: "All applications with their current status and who reviewed them.",
                    rows: () => [
                      ["UID", "Name", "Email", "KGID", "Rank", "District", "Unit", "Status", "Submitted", "Reviewed By", "Reviewed At", "Remarks"],
                      ...applications.map(a => [a.id, a.name, a.email, a.badgeId, a.rank, a.district, a.station, a.status, a.submittedAt, a.reviewedBy, a.reviewedAt, a.remarks]),
                    ],
                  },
                  {
                    id: "audit",
                    title: "Audit Trail",
                    desc: "Append-only record of every administrative change, with before and after.",
                    rows: () => [
                      ["When", "Change", "Subject UID", "Before", "After", "By", "Reason"],
                      ...auditLogs.map(l => [l.changedAt, l.changeType, l.firebaseUid, l.oldValue, l.newValue, l.changedBy, l.reason]),
                    ],
                  },
                  {
                    id: "sessions",
                    title: "Sign-in History",
                    desc: "Every recorded session across all officers, with source address.",
                    rows: () => [
                      ["Officer", "UID", "Signed In", "Signed Out", "Duration (s)", "Status", "End Reason", "Address"],
                      ...admin.sessions.map((x: any) => [
                        officers.find(o => o.uid === x.firebaseUid)?.name || "",
                        x.firebaseUid, x.loginAt, x.logoutAt, x.durationSeconds ?? "", x.status, x.endReason, x.ipAddress,
                      ]),
                    ],
                  },
                  {
                    id: "verification",
                    title: "Verification Ledger",
                    desc: "Sealed documents, their signatures and how often each was scanned.",
                    rows: () => [
                      ["Verification ID", "Crime No", "Sealed", "Issued By", "SHA-256", "Scans", "Last Scan", "Last Status"],
                      ...verifications.map((v: any) => [v.verificationId, v.crimeNo, v.issuedAt, v.issuedBy, v.documentHash, v.scanCount, v.lastScannedAt, v.lastScanStatus]),
                    ],
                  },
                  {
                    id: "security",
                    title: "Flagged Security Events",
                    desc: "Conditions derived from session records that are worth a human look.",
                    rows: () => [
                      ["When", "Severity", "Kind", "Officer", "Address", "Detail"],
                      ...admin.security.map((e: any) => [e.occurredAt, e.severity, e.kind, e.officer, e.ip, e.detail]),
                    ],
                  },
                ] as const).map(report => {
                  const count = Math.max(0, report.rows().length - 1);
                  return (
                    <div key={report.id} style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{report.title}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: ADMIN_THEME.textSecondary, whiteSpace: "nowrap", fontFamily: "JetBrains Mono, monospace" }}>
                          {count} row{count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, lineHeight: 1.5, flex: 1 }}>{report.desc}</div>
                      <button
                        onClick={() => {
                          const rows = report.rows();
                          const csv = rows
                            .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
                            .join("\n");
                          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `ORCA_${report.id}_${new Date().toISOString().slice(0, 10)}.csv`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          setReportsSuccessMsg(`${report.title} exported — ${count} row${count === 1 ? "" : "s"}.`);
                          setTimeout(() => setReportsSuccessMsg(""), 4000);
                        }}
                        disabled={count === 0}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                          background: count === 0 ? "#e2e8f0" : "#001f3f",
                          color: count === 0 ? ADMIN_THEME.textSecondary : "#fff",
                          border: "none", borderRadius: 6, padding: "8px 0", fontSize: 12, fontWeight: 700,
                          cursor: count === 0 ? "default" : "pointer",
                        }}
                      >
                        <Download style={{ width: 14, height: 14 }} />
                        {count === 0 ? "Nothing to export" : "Export CSV"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 8, overflow: "hidden" }}>
              {admin.notifications.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <Check style={{ width: 36, height: 36, color: ADMIN_THEME.green, margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Nothing needs attention</div>
                  <div style={{ fontSize: 12, color: ADMIN_THEME.textSecondary, marginTop: 4 }}>
                    No pending applications, no high-severity security events, and no records missing.
                  </div>
                </div>
              ) : (
                admin.notifications.map((n: any, idx: number) => (
                  <div key={n.id} style={{ padding: "14px 16px", borderBottom: idx !== admin.notifications.length - 1 ? `1px solid ${ADMIN_THEME.border}` : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{
                      marginTop: 4, width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      background: n.kind === "CRITICAL" ? ADMIN_THEME.red
                        : n.kind === "SECURITY" ? "#f97316"
                        : n.kind === "WARNING" ? ADMIN_THEME.accentGold
                        : ADMIN_THEME.textMuted,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 11.5, color: ADMIN_THEME.textSecondary, marginTop: 2, lineHeight: 1.5 }}>{n.detail}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: ADMIN_THEME.textMuted, whiteSpace: "nowrap" }}>
                      {n.occurredAt ? new Date(n.occurredAt.replace(" ", "T")).toLocaleDateString() : ""}
                    </div>
                  </div>
                ))
              )}
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
                    <strong>{modStation || "Station not set"} ({modDistrict || "District not set"})</strong>
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
                      <span style={{ fontSize: 10, color: ADMIN_THEME.textSecondary, display: "block" }}>Reviewer Remarks</span>
                      <strong style={{ fontWeight: 500 }}>{selectedApp.remarks || "None recorded."}</strong>
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
                          onChange={e => {
                            const role = e.target.value;
                            setModRole(role);
                            setModSecurityClearance(clearanceForRole(role) || "");
                          }} 
                          disabled={officerProfile?.role === "Administrative Dashboard - Level 1"}
                          style={{ width: "100%", background: ADMIN_THEME.cardBg, border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12, cursor: "pointer" }}
                        >
                          {/*
                            These are RBAC roles now, not PERMISSION_TEMPLATES keys.

                            This dropdown listed template names ("Investigation
                            Dashboard"), and the drawer posts its value straight
                            to approve-registration as `dashboardRole`. No such
                            role exists, so approving from this drawer returned
                            "Unknown role" the moment the reviewer touched the
                            control. PERMISSION_TEMPLATES is presentational — it
                            fills the module grid below and grants nothing.
                          */}
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, color: ADMIN_THEME.textSecondary, marginBottom: 4, fontWeight: 600 }}>Clearance Level</label>
                        {/*
                          Shown, not chosen — the approval route derives clearance
                          from the role and rejects a disagreeing pair. The old
                          list also held ISD levels only, so an O.R.C.A or SCRB
                          role could not be paired here at all.
                        */}
                        <div style={{ width: "100%", background: "#f1f5f9", border: `1px solid ${ADMIN_THEME.border}`, borderRadius: 6, padding: "8px 12px", color: ADMIN_THEME.textPrimary, fontSize: 12 }}>
                          {modSecurityClearance || "—"}
                          {CLEARANCE_LABEL[modSecurityClearance as keyof typeof CLEARANCE_LABEL]
                            ? ` — ${CLEARANCE_LABEL[modSecurityClearance as keyof typeof CLEARANCE_LABEL]}`
                            : ""}
                        </div>
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
