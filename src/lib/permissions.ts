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
  | "ASI"
  // Present in the Catalyst Rank table (RankID 11, hierarchy 11) but absent
  // from this union, so a Constable had no default role or clearance at all.
  | "Constable";

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
  "Constable",
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
  | "case_registration"
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
      "command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "case_registration", "basic_settings",
      "application_reviews", "directory_logs", "verification_overrides",
      "ai_monitoring", "audit_trails", "security_controls", "role_assignment", "system_telemetry"
    ],
  },
  scrb_officer: {
    label: "SCRB — State Crime Records Bureau",
    description:
      "Statewide crime records: analytics, AI oversight and audit trails. Applied for at sign-up, approved by an administrator, and limited to operational writes.",
    modules: ["ai_monitoring", "audit_trails", "security_controls", "system_telemetry", "basic_settings"],
  },
  /** @deprecated mirrors scrb_officer so the one live `admin_scrb` account still resolves. */
  admin_scrb: {
    label: "SCRB — State Crime Records Bureau",
    description: "Deprecated alias of scrb_officer. Retire once the live account is migrated.",
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
    modules: ["command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "case_registration", "verification_overrides", "basic_settings"],
  },
  investigation_l1: {
    label: "Level I Operational Officer",
    description: "Access to standard operational investigation tools.",
    modules: ["command_overview", "ingestion_copilot", "criminal_networks", "heatmaps", "ai_chatbot", "case_registration", "basic_settings"],
  },
  field_officer_l3: {
    label: "Field Officer (Level III)",
    description:
      "Operational dashboard for field investigations, network graphs, and evidence ingestion.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot", "case_registration",
      "basic_settings",
    ],
  },
  field_officer_l4: {
    label: "Field Officer (Level IV)",
    description:
      "Operational dashboard for field investigations, network graphs, and evidence ingestion.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot", "case_registration",
      "basic_settings",
    ],
  },
  verification_admin_l2: {
    label: "Verification Administrator (Level II)",
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
  verification_admin_l3: {
    label: "Verification Administrator (Level III)",
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
  command_admin_l1: {
    label: "Command Administrator (Level I)",
    description:
      "Complete platform administration including role assignments, AI monitoring, and security controls.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot", "case_registration",
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
  command_admin_l2: {
    label: "Command Administrator (Level II)",
    description:
      "Complete platform administration including role assignments, AI monitoring, and security controls.",
    modules: [
      "command_overview",
      "ingestion_copilot",
      "criminal_networks",
      "heatmaps",
      "ai_chatbot", "case_registration",
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
  DGP:       { isdLevel: "ISD-LEVEL-I",   dashboardRole: "command_admin_l1" },
  ADGP:      { isdLevel: "ISD-LEVEL-I",   dashboardRole: "command_admin_l1" },
  IGP:       { isdLevel: "ISD-LEVEL-II",  dashboardRole: "command_admin_l2" },
  DIGP:      { isdLevel: "ISD-LEVEL-II",  dashboardRole: "verification_admin_l2" },
  SP:        { isdLevel: "ISD-LEVEL-II",  dashboardRole: "verification_admin_l2" },
  ASP:       { isdLevel: "ISD-LEVEL-III", dashboardRole: "verification_admin_l3" },
  DSP:       { isdLevel: "ISD-LEVEL-III", dashboardRole: "field_officer_l3" },
  Inspector: { isdLevel: "ISD-LEVEL-III", dashboardRole: "field_officer_l3" },
  SI:        { isdLevel: "ISD-LEVEL-IV",  dashboardRole: "field_officer_l4" },
  ASI:       { isdLevel: "ISD-LEVEL-IV",  dashboardRole: "field_officer_l4" },
  Constable: { isdLevel: "ISD-LEVEL-IV",  dashboardRole: "field_officer_l4" },
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
