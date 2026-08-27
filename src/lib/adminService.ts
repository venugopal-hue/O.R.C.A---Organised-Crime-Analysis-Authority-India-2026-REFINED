/**
 * Permission templates for the officer review drawer.
 *
 * WHAT THIS FILE USED TO BE
 *
 * The admin console's whole data layer: `fetchOfficerApplications`,
 * `fetchOfficers`, `fetchAuditLogs`, `fetchVerificationOversight`,
 * `fetchSystemSettings`, `saveSystemSettings`, `seedAdminDatabase`, and a
 * localStorage "sandbox" (`getLocalData` / `setLocalData`) that mirrored officer
 * records into the browser and was silently substituted whenever a Firestore
 * read failed.
 *
 * All of it read nine Firestore collections the rest of the platform had
 * stopped writing to when the data layer moved to Catalyst — which is why the
 * console showed an empty officer directory while seven officers existed. It is
 * replaced by src/lib/adminData.ts, reading Catalyst, and the localStorage
 * mirror is gone: caching the officer roster in every administrator's browser
 * was a data-retention problem as much as a correctness one.
 *
 * WHAT REMAINS, AND ITS STATUS
 *
 * `PERMISSION_TEMPLATES` is presentational. It pre-fills the module grid shown
 * in the review drawer so a reviewer can see the shape of a role at a glance.
 * It does NOT grant anything: access is decided by RBAC_CONFIG in
 * src/lib/rbac.ts, keyed on `dashboardRole`, and nothing reads the values
 * below at authorisation time. Kept because the drawer displays it; do not
 * mistake it for an access-control list.
 */

/**
 * The application shape the review drawer was originally typed against.
 *
 * The live shape is `AdminApplicationRow` in src/lib/useAdminOverview.ts, mapped
 * from the Catalyst `OfficerApplication` table. This interface is retained only
 * so the fields the old Firestore documents carried are on record — several of
 * them (priority, govId, documents, experience, timeline) were never written by
 * registration and always read as their defaults.
 */
export interface OfficerApplication {
  id: string;
  name: string;
  email: string;
  badgeId: string;
  rank: string;
  station: string;
  district: string;
  submittedAt: string;
  status: string;
  mobile: string;
  requestedAccess?: string;
  photoUrl?: string;
}

export const PERMISSION_TEMPLATES: Record<string, { role: string; permissions: Record<string, string> }> = {
  "Investigation Dashboard": {
    role: "Investigation Officer",
    permissions: {
      "Dashboard": "View Only",
      "Reports": "Create",
      "Case Registration": "Create",
      "Evidence Management": "Create",
      "Crime Analytics": "View Only",
      "Criminal Database": "View Only",
      "Relationship Mapping": "View Only",
      "Geospatial Heatmap": "View Only",
      "Document Verification": "View Only",
      "Officer Directory": "View Only",
      "Administration": "No Access",
      "Audit Logs": "No Access",
      "AI Chatbot": "Create",
      "AI Intelligence Copilot": "View Only",
      "System Settings": "No Access",
    },
  },
  "Administrative Dashboard - Level 1": {
    role: "Verification Officer",
    permissions: {
      "Dashboard": "View Only",
      "Reports": "No Access",
      "Case Registration": "No Access",
      "Evidence Management": "No Access",
      "Crime Analytics": "No Access",
      "Criminal Database": "No Access",
      "Relationship Mapping": "No Access",
      "Geospatial Heatmap": "No Access",
      "Document Verification": "Manage",
      "Officer Directory": "View Only",
      "Administration": "Manage",
      "Audit Logs": "No Access",
      "AI Chatbot": "View Only",
      "AI Intelligence Copilot": "No Access",
      "System Settings": "No Access",
    },
  },
  "Administrative Dashboard - Level 2": {
    role: "Command Administrator",
    permissions: {
      "Dashboard": "Manage",
      "Reports": "Manage",
      "Case Registration": "Manage",
      "Evidence Management": "Manage",
      "Crime Analytics": "Manage",
      "Criminal Database": "Manage",
      "Relationship Mapping": "Manage",
      "Geospatial Heatmap": "Manage",
      "Document Verification": "Manage",
      "Officer Directory": "Manage",
      "Administration": "Manage",
      "Audit Logs": "Manage",
      "AI Chatbot": "Manage",
      "AI Intelligence Copilot": "Manage",
      "System Settings": "Manage",
    },
  },
};
