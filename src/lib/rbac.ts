/**
 * Single Source of Truth for O.R.C.A Role-Based Access Control System
 * Enforces menu section visibility, Admin Controls sub-section visibility,
 * and post-login redirection paths.
 *
 * NOTE: Keep this in sync with permissions.ts DashboardRole type.
 */

export type DashboardRoleType =
  | "admin_full"
  | "admin_scrb"
  | "admin_verification"
  | "admin_l1"
  | "admin_l2"
  | "it_admin"
  | "investigation_l2"
  | "investigation_l1"
  | "investigation";

export type MenuSection =
  | "command_center"
  | "verification_services"
  | "user_panel"
  | "admin_controls";

export type AdminSubSection =
  | "access_verification"
  | "ai_intelligence"
  | "audit_infrastructure";

export interface RoleConfig {
  label: string;
  allowedMenuSections: MenuSection[];
  allowedAdminSubSections: AdminSubSection[];
  allowedTabs: string[];
  defaultTab: string;
  redirectPath: string;
}

export const RBAC_CONFIG: Record<DashboardRoleType, RoleConfig> = {

  // ── Full Command Administrator (Developer / Top-Level) ──────────────────
  admin_full: {
    label: "Full Command Administrator",
    allowedMenuSections: [
      "command_center",
      "verification_services",
      "user_panel",
      "admin_controls",
    ],
    allowedAdminSubSections: [
      "access_verification",
      "ai_intelligence",
      "audit_infrastructure",
    ],
    allowedTabs: [
      "dashboard", "chatbot", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── Alias: admin_l2 == admin_full (legacy role string) ──────────────────
  admin_l2: {
    label: "Full Command Administrator",
    allowedMenuSections: [
      "command_center",
      "verification_services",
      "user_panel",
      "admin_controls",
    ],
    allowedAdminSubSections: [
      "access_verification",
      "ai_intelligence",
      "audit_infrastructure",
    ],
    allowedTabs: [
      "dashboard", "chatbot", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── SCRB Executive Administrator ────────────────────────────────────────
  admin_scrb: {
    label: "SCRB Executive Administrator",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["ai_intelligence", "audit_infrastructure"],
    allowedTabs: [
      "admin-pending", "admin-analytics", "admin-ai", "admin-model",
      "admin-audit", "admin-security", "admin-reports", "reports",
      "admin-settings", "settings",
    ],
    defaultTab: "admin-analytics",
    redirectPath: "/dashboard",
  },

  // ── IT System Security Administrator ────────────────────────────────────
  it_admin: {
    label: "IT System Security Administrator",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["audit_infrastructure"],
    allowedTabs: [
      "admin-audit", "admin-security", "admin-settings", "settings",
    ],
    defaultTab: "admin-audit",
    redirectPath: "/dashboard",
  },

  // ── Verification Administration Officer ─────────────────────────────────
  admin_verification: {
    label: "Verification Administration Officer",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["access_verification"],
    allowedTabs: [
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "settings",
    ],
    defaultTab: "admin-applications",
    redirectPath: "/dashboard",
  },

  // ── Alias: admin_l1 == admin_verification (legacy role string) ───────────
  admin_l1: {
    label: "Verification Administration Officer",
    allowedMenuSections: ["admin_controls", "user_panel", "command_center"],
    allowedAdminSubSections: ["access_verification"],
    allowedTabs: [
      "dashboard", "settings",
      "admin-dashboard", "admin-pending", "admin-applications",
      "admin-directory", "admin-verification",
    ],
    defaultTab: "admin-applications",
    redirectPath: "/dashboard",
  },

  // ── Level II Investigation Officer ──────────────────────────────────────
  investigation_l2: {
    label: "Level II Investigation Officer",
    allowedMenuSections: [
      "command_center",
      "verification_services",
      "user_panel",
    ],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "analytics", "fir", "networks",
      "news", "reports", "verification-document", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },

  // ── Level I Operational Officer ─────────────────────────────────────────
  investigation_l1: {
    label: "Level I Operational Officer",
    allowedMenuSections: ["command_center", "user_panel"],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "analytics", "fir", "networks",
      "news", "reports", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },

  // ── Field Operational Officer (base / legacy) ────────────────────────────
  investigation: {
    label: "Field Operational Officer",
    allowedMenuSections: ["command_center", "user_panel"],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "analytics", "fir", "networks",
      "news", "reports", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },
};

/**
 * Returns the RoleConfig for a given role string, or null if invalid/missing.
 */
export function getRoleConfig(role?: string | null): RoleConfig | null {
  if (!role) return null;
  return RBAC_CONFIG[role as DashboardRoleType] || null;
}

/**
 * Check if a role can access a top-level menu section
 */
export function canAccessMenuSection(
  role: string | undefined | null,
  section: MenuSection
): boolean {
  const config = getRoleConfig(role);
  if (!config) return false;
  return config.allowedMenuSections.includes(section);
}

/**
 * Check if a role can access an Admin Controls sub-section
 */
export function canAccessAdminSubSection(
  role: string | undefined | null,
  subSection: AdminSubSection
): boolean {
  const config = getRoleConfig(role);
  if (!config) return false;
  return config.allowedAdminSubSections.includes(subSection);
}

/**
 * Check if a role can access a specific tab ID or route
 */
export function canAccessTab(
  role: string | undefined | null,
  tabId: string
): boolean {
  const config = getRoleConfig(role);
  if (!config) return false;
  return config.allowedTabs.includes(tabId);
}

/**
 * Get post-login redirect configuration for a role
 */
export function getPostLoginRedirect(role?: string | null): {
  path: string;
  tab: string;
} {
  const config = getRoleConfig(role);
  if (!config) {
    return { path: "/dashboard", tab: "dashboard" };
  }
  return {
    path: config.redirectPath,
    tab: config.defaultTab,
  };
}
