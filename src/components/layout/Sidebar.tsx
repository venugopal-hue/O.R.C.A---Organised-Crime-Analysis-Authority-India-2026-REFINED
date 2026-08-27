import React, { useState, useEffect } from "react";
import { useActiveSession, formatElapsed } from "@/lib/useActiveSession";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_ROLES, PlatformModule } from "@/lib/permissions";
import { canAccessTab, canAccessMenuSection, canAccessAdminSubSection, getRoleConfig } from "@/lib/rbac";
import type { AdminSubSection } from "@/lib/rbac";
import { OrcaBrand } from "./OrcaBrand";
import { useRouter, usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BarChart3, 
  FilePlus2, 
  Map, 
  Network, 
  Cpu, 
  FileText, 
  Settings,
  ShieldCheck,
  UserCheck,
  Bot,
  Home,
  Shield,
  Award,
  History,
  AlertTriangle,
  ShieldAlert,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Tv, PackageSearch, LifeBuoy, Boxes, ClipboardList } from "lucide-react";

/**
 * The admin menu. `group` decides which collapsible section renders the item.
 *
 * WHY THE GROUP IS ON THE ITEM
 *
 * Each section used to filter by its own hardcoded list of ids, so every
 * admin tab had to be registered TWICE — here, and again in that section's
 * list. An id present here and missing there is defined, RBAC-gated, backed
 * by a full screen, and still unreachable by anyone. That is not a
 * hypothetical: `admin-warnings` had fallen out of all three lists, so
 * Unauthorised Access could not be opened from the sidebar at all, and
 * `admin-support` landed in the same hole the day it was added.
 *
 * One registration point removes the class of bug rather than the instance.
 * The group names are the `AdminSubSection` values from rbac.ts, so the
 * sidebar and the access rules now use one vocabulary instead of two.
 */
const ADMIN_SIDEBAR_ITEMS: {
  id: string;
  label: string;
  icon: typeof Home;
  group: AdminSubSection;
}[] = [
  { id: "admin-dashboard", label: "Dashboard", icon: Home, group: "access_verification" },
  { id: "admin-pending", label: "Pending Registrations", icon: UserCheck, group: "access_verification" },
  { id: "admin-applications", label: "Officer Applications", icon: UserCheck, group: "access_verification" },
  { id: "admin-directory", label: "Officer Directory", icon: Shield, group: "access_verification" },
  { id: "admin-roles", label: "Roles & Permissions", icon: Award, group: "access_verification" },
  { id: "admin-verification", label: "Verification Oversight", icon: FileCheck, group: "access_verification" },
  { id: "admin-analytics", label: "Crime DB Analytics", icon: BarChart3, group: "ai_intelligence" },
  { id: "admin-ai", label: "AI Monitoring Console", icon: Bot, group: "ai_intelligence" },
  { id: "admin-model", label: "AI Model Management", icon: Cpu, group: "ai_intelligence" },
  { id: "admin-audit", label: "Audit Logs", icon: History, group: "audit_infrastructure" },
  { id: "admin-security", label: "Security Center", icon: AlertTriangle, group: "audit_infrastructure" },
  { id: "admin-warnings", label: "Unauthorised Access", icon: ShieldAlert, group: "audit_infrastructure" },
  { id: "admin-support", label: "Support & Incidents", icon: LifeBuoy, group: "audit_infrastructure" },
  { id: "admin-reports", label: "Reports & Notifications", icon: FileText, group: "audit_infrastructure" },
  { id: "admin-settings", label: "System Settings", icon: Settings, group: "audit_infrastructure" }
];

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useIntelligence();
  const { officerProfile, dashboardRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [liveTime, setLiveTime] = useState("");
  const [sessionTime, setSessionTime] = useState("00:00:00");
  const activeSession = useActiveSession();
  const [accessExpanded, setAccessExpanded] = useState(true);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [infraExpanded, setInfraExpanded] = useState(false);

  // Wall clock only. Session duration comes from the recorded sign-in via
  // useActiveSession - the old sessionStorage timestamp was written by whichever
  // tab rendered first, so a second tab restarted the counter.
  useEffect(() => {
    const updateClock = () => {
      setLiveTime(new Date().toTimeString().split(' ')[0] + " IST");
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSessionTime(
      activeSession.known ? formatElapsed(activeSession.elapsedSeconds || 0, "clock") : "--:--:--"
    );
  }, [activeSession.elapsedSeconds, activeSession.known]);

  useEffect(() => {
    if (activeTab && activeTab.startsWith("admin-")) {
      setAccessExpanded(true); // Access & Verification is always open
      
      // Which group to open is read from the item, not from a fourth copy of
      // the id lists. This effect had its own pair of hardcoded arrays, and
      // "admin-support" was missing from them — so opening Support & Incidents
      // left its own section collapsed.
      const group = ADMIN_SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.group;
      const isAiTab = group === "ai_intelligence";
      const isInfraTab = group === "audit_infrastructure";

      if (isAiTab) {
        setAiExpanded(true);
        setInfraExpanded(false);
      } else if (isInfraTab) {
        setInfraExpanded(true);
        setAiExpanded(false);
      } else {
        setAiExpanded(false);
        setInfraExpanded(false);
      }
    }
  }, [activeTab]);

  const menuItems = [
    { id: "dashboard", label: "Command Overview", icon: LayoutDashboard, route: "/dashboard" },
    { id: "chatbot", label: "AI Chatbot", icon: Bot, route: "/dashboard" },
    { id: "analytics", label: "Crime Analytics", icon: BarChart3, route: "/dashboard" },
    { id: "case-registration", label: "Case Registration", icon: FilePlus2, route: "/dashboard" },
    { id: "evidence", label: "Evidence Management", icon: PackageSearch, route: "/dashboard" },
    { id: "property-register", label: "Lost & Stolen Property", icon: Boxes, route: "/dashboard" },
    { id: "tasks", label: "Task & Assignment", icon: ClipboardList, route: "/dashboard" },
    { id: "networks", label: "Threat Mapping", icon: Network, route: "/dashboard" },
    { id: "news", label: "State Live News", icon: Tv, route: "/dashboard" }
  ];

  const verificationItems = [
    { id: "verification-document", label: "Document Verification", icon: ShieldCheck, route: "/verification/document" }
  ];

  const adminItems = [
    { id: "admin-dashboard", label: "Admin Controls", icon: ShieldAlert, route: "/dashboard" }
  ];

  const userItems = [
    { id: "settings", label: "Profile Settings", icon: UserCheck, route: "/dashboard" }
  ];

  const adminSidebarItems = ADMIN_SIDEBAR_ITEMS;

  const hasAccess = (itemId: string) => {
    if (getRoleConfig(dashboardRole)) {
      return canAccessTab(dashboardRole, itemId);
    }

    // Map sidebar item IDs to PlatformModule keys
    const itemToModule: Record<string, PlatformModule> = {
      dashboard: "command_overview",
      chatbot: "ai_chatbot",
      analytics: "heatmaps",
      fir: "ingestion_copilot",
      "case-registration": "case_registration",
      "property-register": "case_registration",
      tasks: "case_registration",
      networks: "criminal_networks",
      "verification-document": "verification_overrides",
      settings: "basic_settings",
      "admin-dashboard": "command_overview",
      "admin-pending": "application_reviews",
      "admin-applications": "application_reviews",
      "admin-directory": "directory_logs",
      "admin-roles": "role_assignment",
      "admin-verification": "verification_overrides",
      "admin-analytics": "ai_monitoring",
      "admin-ai": "ai_monitoring",
      "admin-model": "ai_monitoring",
      "admin-audit": "audit_trails",
      "admin-security": "security_controls",
      "admin-warnings": "security_controls",
      "admin-support": "system_telemetry",
      "admin-reports": "system_telemetry",
      "admin-settings": "system_telemetry",
    };

    const targetModule = itemToModule[itemId];
    if (!targetModule) {
      // An UNGATED item defaults to viewable, which is right for an ordinary
      // screen and wrong for an admin one: forgetting to map a new admin tab
      // here silently granted it to every unrecognised role. "admin-support"
      // was in exactly that state. Admin tabs now fail CLOSED — a missing
      // mapping hides the tab rather than handing it out.
      return !itemId.startsWith("admin-");
    }

    // 1. Check strict 3-Layer RBAC DashboardRole modules
    if (dashboardRole && DASHBOARD_ROLES[dashboardRole]) {
      // Special check: admin section items should only show for admin roles
      // Named the single role "investigation" before, so the newer field-officer
      // levels would have slipped through. Asks the real question instead.
      if (itemId.startsWith("admin-") && !dashboardRole.startsWith("admin") && !dashboardRole.startsWith("command_admin") && !dashboardRole.startsWith("verification_admin") && dashboardRole !== "it_admin") {
        return false;
      }
      return DASHBOARD_ROLES[dashboardRole].modules.includes(targetModule);
    }

    // 2. Fallback check for legacy profile.role strings
    if (!officerProfile) return false;
    const role = officerProfile.role || "Investigation Dashboard";

    if (itemId === "dashboard" || itemId === "settings") return true;

    if (role === "Investigation Dashboard") {
      const allowed = ["dashboard", "chatbot", "analytics", "case-registration", "networks", "verification-document", "settings"];
      return allowed.includes(itemId);
    }

    if (role === "Administrative Dashboard - Level 1") {
      const allowed = [
        "dashboard", "verification-document", "settings",
        "admin-dashboard", "admin-pending", "admin-applications", "admin-verification", "admin-directory"
      ];
      return allowed.includes(itemId);
    }

    if (role === "Administrative Dashboard - Level 2" || role === "ADMIN") {
      return true;
    }

    if (role === "IT Administration Dashboard") {
      const allowed = [
        "dashboard", "settings", "admin-dashboard",
        "admin-directory", "admin-audit", "admin-security", "admin-support", "admin-reports", "admin-settings"
      ];
      return allowed.includes(itemId);
    }

    return true;
  };

  const allowedMenuItems = menuItems.filter(item => hasAccess(item.id));
  const allowedVerificationItems = verificationItems.filter(item => hasAccess(item.id));
  const allowedAdminItems = adminItems.filter(item => hasAccess(item.id));
  const allowedUserItems = userItems.filter(item => hasAccess(item.id));
  const allowedAdminSidebarItems = adminSidebarItems.filter(item => hasAccess(item.id));

  return (
    <aside className="flex flex-col justify-between overflow-hidden shrink-0 select-none"
      style={{ 
        width: "260px",
        background: "#001f3f",
        color: "white",
        boxShadow: "2px 0 10px rgba(0,0,0,0.15)",
        zIndex: 10
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {activeTab.startsWith("admin-") ? (
          <div style={{ padding: "24px 0 0" }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#FF9933",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "0 24px",
              marginBottom: 12,
              fontFamily: "JetBrains Mono, monospace",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              <ShieldAlert style={{ width: 13, height: 13 }} /> ADMIN CONTROLS
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              
              {/* Category 1: Access & Verification */}
              {(!getRoleConfig(dashboardRole) || canAccessAdminSubSection(dashboardRole, "access_verification")) && (
              <div>
                <div 
                  onClick={() => setAccessExpanded(!accessExpanded)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 24px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFamily: "JetBrains Mono, monospace",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                >
                  <span>Access & Verification</span>
                  {accessExpanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                </div>

                {accessExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                    {allowedAdminSidebarItems.filter(item => 
                      item.group === "access_verification"
                    ).map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <a
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            color: isActive ? "white" : "rgba(255,255,255,0.7)",
                            textDecoration: "none",
                            padding: "8px 24px",
                            fontSize: "12.5px",
                            fontWeight: isActive ? 600 : 500,
                            cursor: "pointer",
                            borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                            background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                            transition: "0.2s",
                            userSelect: "none"
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                              (e.currentTarget as HTMLElement).style.color = "white";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                            }
                          }}
                        >
                          <Icon style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                          <span>{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Category 2: AI & Intelligence */}
              {(!getRoleConfig(dashboardRole) || canAccessAdminSubSection(dashboardRole, "ai_intelligence")) && (
              <div>
                <div 
                  onClick={() => setAiExpanded(!aiExpanded)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 24px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFamily: "JetBrains Mono, monospace",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                >
                  <span>AI & Intelligence</span>
                  {aiExpanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                </div>

                {aiExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                    {allowedAdminSidebarItems.filter(item => 
                      item.group === "ai_intelligence"
                    ).map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <a
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            color: isActive ? "white" : "rgba(255,255,255,0.7)",
                            textDecoration: "none",
                            padding: "8px 24px",
                            fontSize: "12.5px",
                            fontWeight: isActive ? 600 : 500,
                            cursor: "pointer",
                            borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                            background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                            transition: "0.2s",
                            userSelect: "none"
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                              (e.currentTarget as HTMLElement).style.color = "white";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                            }
                          }}
                        >
                          <Icon style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                          <span>{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {/* Category 3: Audit & Infrastructure */}
              {(!getRoleConfig(dashboardRole) || canAccessAdminSubSection(dashboardRole, "audit_infrastructure")) && (
              <div>
                <div 
                  onClick={() => setInfraExpanded(!infraExpanded)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 24px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFamily: "JetBrains Mono, monospace",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                >
                  <span>Audit & Infrastructure</span>
                  {infraExpanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                </div>

                {infraExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                    {allowedAdminSidebarItems.filter(item => 
                      item.group === "audit_infrastructure"
                    ).map(item => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <a
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            color: isActive ? "white" : "rgba(255,255,255,0.7)",
                            textDecoration: "none",
                            padding: "8px 24px",
                            fontSize: "12.5px",
                            fontWeight: isActive ? 600 : 500,
                            cursor: "pointer",
                            borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                            background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                            transition: "0.2s",
                            userSelect: "none"
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                              (e.currentTarget as HTMLElement).style.color = "white";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                            }
                          }}
                        >
                          <Icon style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                          <span>{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

            </nav>

            {/* Exit admin bypass */}
            <div style={{ padding: "16px 24px" }}>
              <button
                onClick={() => setActiveTab("dashboard")}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FF9933",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,153,51,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >
                ◀ Exit Admin Controls
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* NOTIFICATIONS section */}
            <div style={{ padding: "24px 0 0" }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0 24px",
                marginBottom: 8,
                fontFamily: "JetBrains Mono, monospace"
              }}>
                Notifications
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                <a
                  id="nav-bulletins"
                  onClick={() => {
                    setActiveTab("reports");
                    if (pathname !== "/dashboard") {
                      router.push("/dashboard");
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    color: activeTab === "reports" ? "white" : "rgba(255,255,255,0.7)",
                    textDecoration: "none",
                    padding: "10px 24px",
                    fontSize: "13.5px",
                    fontWeight: activeTab === "reports" ? 600 : 500,
                    cursor: "pointer",
                    borderLeft: activeTab === "reports" ? "3px solid #FF9933" : "3px solid transparent",
                    background: activeTab === "reports" ? "rgba(255,255,255,0.1)" : "transparent",
                    transition: "0.2s",
                    userSelect: "none"
                  }}
                  onMouseEnter={e => {
                    if (activeTab !== "reports") {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "white";
                    }
                  }}
                  onMouseLeave={e => {
                    if (activeTab !== "reports") {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                    }
                  }}
                >
                  <FileText style={{ width: 16, height: 16, opacity: activeTab === "reports" ? 1 : 0.7, color: activeTab === "reports" ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                  <span>Official Bulletins</span>
                </a>
              </nav>
            </div>

            {/* OPERATIONAL MODULES section */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0 24px",
                marginBottom: 8,
                fontFamily: "JetBrains Mono, monospace"
              }}>
                COMMAND CENTER
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                {allowedMenuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <a
                      id={`nav-${item.id}`}
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                        textDecoration: "none",
                        padding: "10px 24px",
                        fontSize: "13.5px",
                        fontWeight: isActive ? 600 : 500,
                        cursor: "pointer",
                        borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                        transition: "0.2s",
                        userSelect: "none"
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "white";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                        }
                      }}
                    >
                      <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            {/* VERIFICATION SERVICES section */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0 24px",
                marginBottom: 8,
                fontFamily: "JetBrains Mono, monospace"
              }}>
                Verification Services
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                {allowedVerificationItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <a
                      id={`nav-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (pathname !== item.route && item.route !== "/dashboard") {
                          router.push(item.route);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                        textDecoration: "none",
                        padding: "10px 24px",
                        fontSize: "13.5px",
                        fontWeight: isActive ? 600 : 500,
                        cursor: "pointer",
                        borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                        transition: "0.2s",
                        userSelect: "none"
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "white";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                        }
                      }}
                    >
                      <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            {/* USER PANEL section */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0 24px",
                marginBottom: 8,
                fontFamily: "JetBrains Mono, monospace"
              }}>
                User Panel
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                {allowedUserItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <a
                      id={`nav-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (pathname !== item.route) {
                          router.push(item.route);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                        textDecoration: "none",
                        padding: "10px 24px",
                        fontSize: "13.5px",
                        fontWeight: isActive ? 600 : 500,
                        cursor: "pointer",
                        borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                        transition: "0.2s",
                        userSelect: "none"
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "white";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                        }
                      }}
                    >
                      <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            {/* ADMINISTRATION section */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                padding: "0 24px",
                marginBottom: 8,
                fontFamily: "JetBrains Mono, monospace"
              }}>
                Administration
              </div>
              <nav style={{ display: "flex", flexDirection: "column" }}>
                {allowedAdminItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <a
                      id={`nav-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (pathname !== item.route) {
                          router.push(item.route);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        color: isActive ? "white" : "rgba(255,255,255,0.7)",
                        textDecoration: "none",
                        padding: "10px 24px",
                        fontSize: "13.5px",
                        fontWeight: isActive ? 600 : 500,
                        cursor: "pointer",
                        borderLeft: isActive ? "3px solid #FF9933" : "3px solid transparent",
                        background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                        transition: "0.2s",
                        userSelect: "none"
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                          (e.currentTarget as HTMLElement).style.color = "white";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
                        }
                      }}
                    >
                      <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, color: isActive ? "#FF9933" : "currentColor", flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Sync footer — navy-mid background, matches O.R.C.A .sidebar-footer */}
      <div style={{
        padding: "20px 24px",
        background: "#002855",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>ISO SECURE LINK</span>
          <span style={{ color: "#10b981", fontWeight: 700 }}>● ACTIVE</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>GRID TIME</span>
          <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{liveTime}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>SESSION TIME</span>
          <span style={{ color: "#FF9933", fontWeight: 700 }}>{sessionTime}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>SYNC DELAY</span>
          <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>12ms</span>
        </div>
      </div>
    </aside>
  );
};
