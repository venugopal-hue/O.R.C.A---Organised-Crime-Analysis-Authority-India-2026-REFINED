/**
 * Single Source of Truth for O.R.C.A Role-Based Access Control System
 * Enforces menu section visibility, Admin Controls sub-section visibility,
 * and post-login redirection paths.
 *
 * NOTE: Keep this in sync with permissions.ts DashboardRole type.
 */

import type { ClearanceLevel } from "@/lib/clearance";

export type DashboardRoleType =
  | "orca_owner"
  | "orca_engineer"
  | "orca_support"
  | "orca_demo"
  | "admin_full"
  | "scrb_officer"
  /** @deprecated superseded by `scrb_officer`; kept so the one live account resolves. */
  | "admin_scrb"
  | "admin_verification"
  | "it_admin"
  | "command_admin_l1"
  | "command_admin_l2"
  | "verification_admin_l2"
  | "verification_admin_l3"
  | "investigation_l2"
  | "investigation_l1"
  | "field_officer_l3"
  | "field_officer_l4";

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
  /**
   * The ISD clearance this role carries — ONE level, always.
   *
   * Role and clearance used to be independent fields, so the same role could be
   * held at different levels: `investigation_l1` is ISD-LEVEL-IV on one live
   * officer and ISD-LEVEL-III on another, and `command_admin` spanned I and II.
   * Nothing said which was correct. Binding the level to the role means the
   * name states the clearance, and the write paths reject a mismatch.
   */
  clearance: ClearanceLevel;
  /**
   * What this role may CHANGE, as distinct from what it may see.
   *
   *   full         everything, including roles, system settings and AI config
   *   operational  day-to-day records (cases, evidence, approvals) but NOT
   *                configuration or anyone else's access
   *   none         read only — every mutating route refuses
   *
   * Tab visibility alone was never enough: RBAC gated which screens rendered
   * and nothing stopped a write, so a "read only" role would have been a label
   * with nothing behind it.
   */
  writeAccess: "full" | "operational" | "none";
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
    clearance: "ISD-LEVEL-I",
    writeAccess: "full",
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── Command Administrator, by clearance ─────────────────────────────────
  command_admin_l1: {
    label: "Command Administrator (Level I)",
    clearance: "ISD-LEVEL-I",
    writeAccess: "full",
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },
  command_admin_l2: {
    label: "Command Administrator (Level II)",
    clearance: "ISD-LEVEL-II",
    writeAccess: "full",
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── O.R.C.A Owner ─────────────────────────────────────────
  orca_owner: {
    label: "O.R.C.A Owner",
    clearance: "ORCA-LEVEL-I",
    writeAccess: "full",
    // Developer main. The only role permitted to create or modify other O.R.C.A accounts.
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── O.R.C.A Engineer ─────────────────────────────────────────
  orca_engineer: {
    label: "O.R.C.A Engineer",
    clearance: "ORCA-LEVEL-II",
    writeAccess: "full",
    // IT team. Settings, AI configuration and role assignment.
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── O.R.C.A Support ─────────────────────────────────────────
  orca_support: {
    label: "O.R.C.A Support",
    clearance: "ORCA-LEVEL-III",
    writeAccess: "operational",
    // IT team. Sees everything; cannot change roles, settings or AI configuration.
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── O.R.C.A Demonstration (Read Only) ─────────────────────────────────────────
  orca_demo: {
    label: "O.R.C.A Demonstration (Read Only)",
    clearance: "ORCA-LEVEL-IV",
    writeAccess: "none",
    // Demonstration. Every screen, no writes — enforced by the route guard, not just by hiding controls.
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
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks", "news", "reports",
      "verification-document", "settings",
      "admin-dashboard", "admin-pending", "admin-applications", "admin-directory",
      "admin-roles", "admin-verification", "admin-analytics", "admin-ai",
      "admin-model", "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-reports", "admin-settings",
    ],
    defaultTab: "admin-dashboard",
    redirectPath: "/dashboard",
  },

  // ── SCRB — State Crime Records Bureau ───────────────────────────────────
  /**
   * The records bureau posting, on its own CRB-LEVEL-I clearance.
   *
   * WHAT CHANGED FROM `admin_scrb`
   *
   * Two things, and the second is the reason for the first.
   *
   * 1. Clearance moved from ISD-LEVEL-II to CRB-LEVEL-I. SCRB is a posting,
   *    not a rung on the police command ladder; CRB-LEVEL-I is granted sight of
   *    exactly what ISD-LEVEL-II reached before, so no screen changes hands.
   *
   * 2. writeAccess dropped from "full" to "operational", and the role is no
   *    longer in EXECUTIVE_ROLES. This role can now be APPLIED FOR — an
   *    applicant declares an SCRB posting at sign-up and an administrator
   *    approves it — so it must not be able to grant `admin_full` or to change
   *    anyone's role, settings or AI configuration. A self-registerable role
   *    holding the power to promote accounts to full command would be a way in
   *    for anyone who can get one application approved.
   *
   * The tab list is unchanged: statewide analytics, AI oversight, audit trails
   * and reports are the bureau's actual work.
   */
  scrb_officer: {
    label: "SCRB — State Crime Records Bureau",
    clearance: "CRB-LEVEL-I",
    writeAccess: "operational",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["ai_intelligence", "audit_infrastructure"],
    allowedTabs: [
      "admin-pending", "admin-analytics", "admin-ai", "admin-model",
      "admin-audit", "admin-security", "admin-warnings", "admin-reports", "reports",
      "admin-settings", "settings",
    ],
    defaultTab: "admin-analytics",
    redirectPath: "/dashboard",
  },

  /**
   * DEPRECATED — the old manually-provisioned SCRB role.
   *
   * Kept resolvable ON PURPOSE. `scrbadmin@orca.gov` still carries
   * `admin_scrb` in its Firebase claim and its Catalyst profile; deleting the
   * key here would make `getRoleConfig` return null for that account, and
   * because every gate fails closed, the officer would be locked out of the
   * platform at their next sign-in rather than merely losing a permission.
   *
   * It therefore mirrors `scrb_officer` exactly — INCLUDING the reduced write
   * access and its removal from EXECUTIVE_ROLES, which are the security fix and
   * are meant to apply to the live account immediately.
   *
   * Retire it once that one account has been moved to `scrb_officer`.
   */
  admin_scrb: {
    label: "SCRB — State Crime Records Bureau",
    clearance: "CRB-LEVEL-I",
    writeAccess: "operational",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["ai_intelligence", "audit_infrastructure"],
    allowedTabs: [
      "admin-pending", "admin-analytics", "admin-ai", "admin-model",
      "admin-audit", "admin-security", "admin-warnings", "admin-reports", "reports",
      "admin-settings", "settings",
    ],
    defaultTab: "admin-analytics",
    redirectPath: "/dashboard",
  },

  // ── IT System Security Administrator ────────────────────────────────────
  it_admin: {
    label: "IT System Security Administrator",
    clearance: "ISD-LEVEL-III",
    writeAccess: "full",
    allowedMenuSections: ["admin_controls", "user_panel"],
    allowedAdminSubSections: ["audit_infrastructure"],
    allowedTabs: [
      "admin-audit", "admin-security", "admin-warnings", "admin-support", "admin-settings", "settings",
    ],
    defaultTab: "admin-audit",
    redirectPath: "/dashboard",
  },

  // ── Verification Administration Officer ─────────────────────────────────
  admin_verification: {
    label: "Verification Administration Officer",
    clearance: "ISD-LEVEL-III",
    writeAccess: "full",
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
  verification_admin_l2: {
    label: "Verification Administrator (Level II)",
    clearance: "ISD-LEVEL-II",
    writeAccess: "full",
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
  verification_admin_l3: {
    label: "Verification Administrator (Level III)",
    clearance: "ISD-LEVEL-III",
    writeAccess: "full",
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
    clearance: "ISD-LEVEL-III",
    writeAccess: "full",
    allowedMenuSections: [
      "command_center",
      "verification_services",
      "user_panel",
    ],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks",
      "news", "reports", "verification-document", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },

  // ── Level I Operational Officer ─────────────────────────────────────────
  investigation_l1: {
    label: "Level I Operational Officer",
    clearance: "ISD-LEVEL-IV",
    writeAccess: "full",
    allowedMenuSections: ["command_center", "user_panel"],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks",
      "news", "reports", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },

  // ── Field Operational Officer (base / legacy) ────────────────────────────
  field_officer_l3: {
    label: "Field Officer (Level III)",
    clearance: "ISD-LEVEL-III",
    writeAccess: "full",
    allowedMenuSections: ["command_center", "user_panel"],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks",
      "news", "reports", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },
  field_officer_l4: {
    label: "Field Officer (Level IV)",
    clearance: "ISD-LEVEL-IV",
    writeAccess: "full",
    allowedMenuSections: ["command_center", "user_panel"],
    allowedAdminSubSections: [],
    allowedTabs: [
      "dashboard", "chatbot", "case-registration", "evidence", "property-register", "tasks", "analytics", "fir", "networks",
      "news", "reports", "settings",
    ],
    defaultTab: "dashboard",
    redirectPath: "/dashboard",
  },
};

/**
 * Roles that still RESOLVE but must no longer be ASSIGNED.
 *
 * A deprecated role is kept in RBAC_CONFIG so the accounts already carrying it
 * keep working — every gate fails closed, so deleting the key would lock those
 * officers out rather than merely demote them. But it must not appear in the
 * assignment dropdowns: `admin_scrb` and `scrb_officer` render as the same
 * words, and a reviewer picking the wrong one would put a brand-new officer on
 * a role that is scheduled for removal.
 *
 * Empty this set once the accounts have been migrated, then delete the configs.
 *
 * THE OTHER TWO ARE EXACT DUPLICATES, not renames:
 *
 *   admin_full        === command_admin_l1   (ISD-LEVEL-I, same 25 tabs, full)
 *   investigation_l1  === field_officer_l4   (ISD-LEVEL-IV, same 10 tabs, full)
 *
 * Byte-for-byte the same permissions under two names, which meant the access
 * matrix showed the same column twice and two officers could hold "different"
 * roles that were in fact identical. In each pair the survivor is the one whose
 * name states its clearance — that is the whole point of the `_lN` scheme.
 * `investigation_l1` is doubly wrong there: its suffix means a seniority tier,
 * not a level, so it reads as ISD-LEVEL-I while carrying ISD-LEVEL-IV.
 *
 * Deprecating rather than deleting: four live accounts hold these two names and
 * every gate fails closed, so removing the configs would lock those officers
 * out rather than move them. They keep exactly the access they have.
 */
export const DEPRECATED_ROLES: ReadonlySet<string> = new Set([
  "admin_scrb",         // -> scrb_officer
  "admin_full",         // -> command_admin_l1
  "investigation_l1",   // -> field_officer_l4
]);

/** Roles a reviewer may assign today — RBAC_CONFIG minus the deprecated ones. */
export function isAssignableRole(role?: string | null): boolean {
  if (!role) return false;
  return role in RBAC_CONFIG && !DEPRECATED_ROLES.has(role);
}

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

/**
 * The clearance a role carries. Null for an unknown role.
 *
 * This is what makes the level in the name binding rather than decorative:
 * every write path resolves the clearance FROM the role instead of accepting
 * one alongside it. Two officers can no longer hold `investigation_l1` at
 * different levels, which is what the live data showed before the split
 * (ISD-LEVEL-IV on one, ISD-LEVEL-III on another, with nothing saying which
 * was right).
 */
export function clearanceForRole(role?: string | null): ClearanceLevel | null {
  const cfg = role ? RBAC_CONFIG[role as DashboardRoleType] : undefined;
  return cfg ? cfg.clearance : null;
}

/**
 * Does this clearance match the one the role carries?
 *
 * Used by the write paths to refuse a mismatch outright rather than silently
 * storing whichever value arrived last.
 */
export function clearanceMatchesRole(role: string, clearance: string): boolean {
  const expected = clearanceForRole(role);
  return expected !== null && expected === clearance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write access
// ─────────────────────────────────────────────────────────────────────────────

export type WriteAccess = "full" | "operational" | "none";

/** What a role may change. Unknown roles get "none" — access must not fall open. */
export function writeAccessOf(role?: string | null): WriteAccess {
  const cfg = role ? RBAC_CONFIG[role as DashboardRoleType] : undefined;
  return cfg ? cfg.writeAccess : "none";
}

/**
 * The two kinds of change a route can make.
 *
 *   operational  day-to-day records — register a case, add evidence, approve an
 *                officer, record a custody event
 *   config       the platform itself — system settings, AI parameters, and
 *                anyone's role or clearance
 *
 * They are separated because O.R.C.A Support is meant to be able to help with
 * the first and not touch the second. Collapsing them into one permission would
 * mean choosing between a support role that cannot do its job and one that can
 * grant itself anything.
 */
export type WriteKind = "operational" | "config";

export function canWrite(role: string | null | undefined, kind: WriteKind): boolean {
  const access = writeAccessOf(role);
  if (access === "full") return true;
  if (access === "operational") return kind === "operational";
  return false;
}

/**
 * Why a write was refused, in words the caller can show.
 *
 * Names the role rather than saying "forbidden", because the officer has done
 * nothing wrong — the account is simply not one that changes things.
 */
export function writeDenialReason(role: string | null | undefined, kind: WriteKind): string {
  const label = role ? RBAC_CONFIG[role as DashboardRoleType]?.label || role : "This account";
  const access = writeAccessOf(role);
  if (access === "none") {
    return `${label} is read-only. Nothing on this platform can be changed from this account.`;
  }
  if (access === "operational" && kind === "config") {
    return `${label} cannot change platform configuration, roles or clearances. Ask an O.R.C.A Engineer or Owner.`;
  }
  return `${label} is not permitted to make this change.`;
}
