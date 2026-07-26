// ============================================================================
// O.R.C.A Three-Layer Role-Based Access Control (RBAC) Architecture
// Single Source of Truth
// ============================================================================

/**
 * 1. RANK
 * Organizational / cosmetic title only. Does not itself grant permissions.
 * Used for org-chart hierarchy and default profile pre-filling.
 */
export type Rank =
  | "DGP"
  | "ADGP"
  | "IGP"
  | "DIGP"
  | "SP"
  | "ASP"
  | "DSP"
  | "Inspector"
  | "SI"
  | "ASI";

export const RANKS: Rank[] = [
  "DGP",
  "ADGP",
  "IGP",
  "DIGP",
  "SP",
  "ASP",
  "DSP",
  "Inspector",
  "SI",
  "ASI",
];

/**
 * 2. ISD CLEARANCE LEVEL
 * Governs access to sensitive data and specialized intelligence tools
 * (e.g., Forensic Evidence Copilot, AI Chatbot data classification).
 */
export type IsdLevel =
  | "ISD-LEVEL-I"
  | "ISD-LEVEL-II"
  | "ISD-LEVEL-III"
  | "ISD-LEVEL-IV";

export interface IsdLevelConfig {
  label: string;
  description: string;
  rankRange: string;
}

export const ISD_LEVELS: Record<IsdLevel, IsdLevelConfig> = {
  "ISD-LEVEL-I": {
    label: "ISD Level I — Highest Clearance",
    description: "Full command-level clearance for top executive officers.",
    rankRange: "DGP / ADGP / IGP / SP",
  },
  "ISD-LEVEL-II": {
    label: "ISD Level II — High Clearance",
    description: "Clearance for administrative and oversight reviews.",
    rankRange: "DIGP / ASP / DSP",
  },
  "ISD-LEVEL-III": {
    label: "ISD Level III — Medium Clearance",
    description: "Clearance for IT systems, auditing, and technical review.",
    rankRange: "IT & Auditing Officers",
  },
  "ISD-LEVEL-IV": {
    label: "ISD Level IV — Standard Clearance",
    description: "Standard field clearance for operational investigation tasks.",
    rankRange: "Inspector / SI / ASI",
  },
};

/**
 * Platform Modules that can be gated in UI
 */
export type PlatformModule =
  // Investigation Modules
  | "command_overview"
  | "ingestion_copilot"
  | "criminal_networks"
  | "heatmaps"
  | "ai_chatbot"
  | "basic_settings"
  // L1 Administration Modules
  | "application_reviews"
  | "directory_logs"
  | "verification_overrides"
  // L2 Complete Administration Modules
  | "ai_monitoring"
  | "audit_trails"
  | "security_controls"
  | "role_assignment"
  // IT Administration Modules
  | "system_telemetry";

/**
 * 3. DASHBOARD ROLE
 * Governs which UI modules/tabs render for the logged-in officer.
 */
export type DashboardRole =
  | "admin_full"
  | "admin_scrb"
  | "admin_verification"
  | "investigation_l2"
  | "investigation_l1"
  | "investigation"
  | "admin_l1"
  | "admin_l2"
  | "it_admin";

export interface DashboardRoleConfig {
  label: string;
  description: string;
  modules: PlatformModule[];
}

export const DASHBOARD_ROLES: Record<DashboardRole, DashboardRoleConfig> = {
  admin_full: {
    label: "Full Command Administrator",
    description: "Full access to all operational and administration modules.",
    modules: [
      "command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "basic_settings",
      "application_reviews", "directory_logs", "verification_overrides",
      "ai_monitoring", "audit_trails", "security_controls", "role_assignment", "system_telemetry"
    ],
  },
  admin_scrb: {
    label: "SCRB Executive Administrator",
    description: "Access to AI & Intelligence and Audit Infrastructure.",
    modules: ["ai_monitoring", "audit_trails", "security_controls", "system_telemetry", "basic_settings"],
  },
  admin_verification: {
    label: "Verification Administration Officer",
    description: "Access to Verification and Application reviews.",
    modules: ["application_reviews", "directory_logs", "role_assignment", "verification_overrides", "basic_settings"],
  },
  investigation_l2: {
    label: "Level II Investigation Officer",
    description: "Access to operational investigation tools and verification services.",
    modules: ["command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "verification_overrides", "basic_settings"],
  },
  investigation_l1: {
    label: "Level I Operational Officer",
    description: "Access to standard operational investigation tools.",
    modules: ["command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "basic_settings"],
  },
  investigation: {
    label: "Field Operational Officer",
    description:
      "Operational dashboard for field investigations, network graphs, and evidence ingestion.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot",
      "basic_settings",
    ],
  },
  admin_l1: {
    label: "Verification Administration Officer",
    description:
      "First-level administrative oversight for officer applications, directories, and verifications.",
    modules: [
      "command_overview",
      "basic_settings",
      "application_reviews",
      "directory_logs",
      "verification_overrides",
    ],
  },
  admin_l2: {
    label: "Full Command Administrator",
    description:
      "Complete platform administration including role assignments, AI monitoring, and security controls.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot",
      "basic_settings",
      "application_reviews",
      "directory_logs",
      "verification_overrides",
      "ai_monitoring",
      "audit_trails",
      "security_controls",
      "role_assignment",
      "system_telemetry",
    ],
  },
  it_admin: {
    label: "IT System Security Administrator",
    description:
      "Infrastructure dashboard for system telemetry, security audits, and logs (no investigation data access).",
    modules: [
      "basic_settings",
      "system_telemetry",
      "audit_trails",
      "security_controls",
    ],
  },
};

/**
 * RANK_DEFAULTS
 * Maps every rank to a default ISD Clearance Level and Dashboard Role
 * at initial profile creation. An admin_l2 officer can override either
 * field per-officer at any time.
 */
export interface RankDefault {
  isdLevel: IsdLevel;
  dashboardRole: DashboardRole;
}

export const RANK_DEFAULTS: Record<Rank, RankDefault> = {
  DGP: {
    isdLevel: "ISD-LEVEL-I",
    dashboardRole: "admin_l2",
  },
  ADGP: {
    isdLevel: "ISD-LEVEL-I",
    dashboardRole: "admin_l2",
  },
  IGP: {
    isdLevel: "ISD-LEVEL-I",
    dashboardRole: "admin_l2",
  },
  DIGP: {
    isdLevel: "ISD-LEVEL-I",
    dashboardRole: "admin_l1",
  },
  SP: {
    isdLevel: "ISD-LEVEL-I",
    dashboardRole: "admin_l1",
  },
  ASP: {
    isdLevel: "ISD-LEVEL-II",
    dashboardRole: "admin_l1",
  },
  DSP: {
    isdLevel: "ISD-LEVEL-II",
    dashboardRole: "investigation",
  },
  Inspector: {
    isdLevel: "ISD-LEVEL-IV",
    dashboardRole: "investigation",
  },
  SI: {
    isdLevel: "ISD-LEVEL-IV",
    dashboardRole: "investigation",
  },
  ASI: {
    isdLevel: "ISD-LEVEL-IV",
    dashboardRole: "investigation",
  },
};

/**
 * Shape of Firestore `/users/{uid}` document
 */
export interface OfficerUserDoc {
  uid: string;
  name: string;
  email: string;
  rank: Rank;
  isdLevel: IsdLevel;
  dashboardRole: DashboardRole;
  station: string;
  badgeNumber: string;
  active: boolean;
  updatedBy?: string;
  updatedAt?: string;
}
