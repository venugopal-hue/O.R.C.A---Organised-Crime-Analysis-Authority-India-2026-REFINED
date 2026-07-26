import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";

// Application Schema
export interface OfficerApplication {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  badgeId: string;
  rank: string;
  station: string;
  district: string;
  submittedAt: string;
  status: "pending" | "pending_verification" | "pending_documents" | "approved" | "active" | "suspended" | "inactive" | "transferred" | "retired" | "rejected" | "under_review" | "awaiting";
  priority: "HIGH" | "MEDIUM" | "LOW";
  mobile: string;
  govId: string;
  documents: string[];
  reason: string;
  experience: string;
  notes?: string;
  timeline: { status: string; date: string; remarks: string }[];
  remarks?: string;
  requestedAccess?: string;
  assignedReviewer?: string;
  securityClearance?: string;
  bgVerification?: string;
  deptVerification?: string;
  supervisorApproval?: string;
  internalRemarks?: string;
  clearanceLevel?: string;
  division?: string;
  stateUnit?: string;
  department?: string;
  reportingOfficer?: string;
  supervisor?: string;
  departmentHead?: string;
  commandingOfficer?: string;
  permissions?: Record<string, string>;
  permissionsHistory?: any[];
  stationHistory?: any[];
  assignedRole?: string;
  photoUrl?: string;
}

// GROQ key is server-side only — do NOT use NEXT_PUBLIC_ prefix here.
// The /api/chat route handles GROQ calls using process.env.GROQ_API_KEY (private).
const DEFAULT_GROQ_KEY = "";

export const PERMISSION_TEMPLATES: Record<string, { role: string; permissions: Record<string, string> }> = {
  "Investigation Dashboard": {
    role: "Investigation Officer",
    permissions: {
      "Dashboard": "View Only",
      "Reports": "Create",
      "Case Management": "Edit",
      "FIR Analytics": "Edit",
      "Criminal Database": "View Only",
      "Evidence Vault": "Create",
      "Crime Analytics": "View Only",
      "Relationship Mapping": "View Only",
      "Geospatial Heatmap": "View Only",
      "Document Verification": "View Only",
      "Officer Directory": "View Only",
      "Administration": "No Access",
      "Audit Logs": "No Access",
      "AI Chatbot": "Create",
      "AI Intelligence Copilot": "View Only",
      "Notifications": "Create",
      "System Settings": "No Access",
      "API Management": "No Access"
    }
  },
  "Administrative Dashboard - Level 1": {
    role: "Verification Officer",
    permissions: {
      "Dashboard": "View Only",
      "Reports": "No Access",
      "Case Management": "No Access",
      "FIR Analytics": "No Access",
      "Criminal Database": "No Access",
      "Evidence Vault": "No Access",
      "Crime Analytics": "No Access",
      "Relationship Mapping": "No Access",
      "Geospatial Heatmap": "No Access",
      "Document Verification": "Manage",
      "Officer Directory": "View Only",
      "Administration": "Manage",
      "Audit Logs": "No Access",
      "AI Chatbot": "View Only",
      "AI Intelligence Copilot": "No Access",
      "Notifications": "View Only",
      "System Settings": "No Access",
      "API Management": "No Access"
    }
  },
  "Administrative Dashboard - Level 2": {
    role: "Command Administrator",
    permissions: {
      "Dashboard": "Manage",
      "Reports": "Manage",
      "Case Management": "Manage",
      "FIR Analytics": "Manage",
      "Criminal Database": "Manage",
      "Evidence Vault": "Manage",
      "Crime Analytics": "Manage",
      "Relationship Mapping": "Manage",
      "Geospatial Heatmap": "Manage",
      "Document Verification": "Manage",
      "Officer Directory": "Manage",
      "Administration": "Manage",
      "Audit Logs": "Manage",
      "AI Chatbot": "Manage",
      "AI Intelligence Copilot": "Manage",
      "Notifications": "Manage",
      "System Settings": "Manage",
      "API Management": "Manage"
    }
  }
};

// System Settings Schema
export interface SystemSettings {
  groqKey: string;
  ocrEngine: "tesseract" | "cloud_vision";
  autoApproveConstables: boolean;
  mfaEnforced: boolean;
  sessionTimeout: number;
  backupFrequency: "daily" | "weekly" | "monthly";
}

// Empty collections for pure live production data
export const MOCK_OFFICER_APPLICATIONS: OfficerApplication[] = [];
export const MOCK_OFFICERS: any[] = [];
export const MOCK_AUDIT_LOGS: any[] = [];
export const MOCK_VERIFICATIONS: any[] = [];

export const MOCK_SETTINGS: SystemSettings = {
  groqKey: DEFAULT_GROQ_KEY,
  ocrEngine: "tesseract",
  autoApproveConstables: false,
  mfaEnforced: true,
  sessionTimeout: 30,
  backupFrequency: "daily"
};

// Seed Database helper - only when explicitly requested
export async function seedAdminDatabase(): Promise<void> {
  const batch = writeBatch(db);
  const settingsDocRef = doc(db, "admin_settings", "canonical");
  batch.set(settingsDocRef, {
    groqKey: DEFAULT_GROQ_KEY,
    ocrEngine: "tesseract",
    autoApproveConstables: false,
    mfaEnforced: true,
    sessionTimeout: 30,
    backupFrequency: "daily"
  }, { merge: true });

  await batch.commit();
}

// Helper functions for localStorage fallback when Firestore rules restrict access
export function getLocalData<T>(key: string, defaultVal: T): T {
  if (typeof window === "undefined") return defaultVal;
  const data = localStorage.getItem(key);
  if (!data) return defaultVal;
  try {
    return JSON.parse(data) as T;
  } catch {
    return defaultVal;
  }
}

export function setLocalData<T>(key: string, val: T): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

// 1. Fetch Live Officer Applications
export async function fetchOfficerApplications(): Promise<OfficerApplication[]> {
  try {
    const [pendingSnap, appsSnap] = await Promise.all([
      getDocs(collection(db, "pendingRegistrations")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "officer_applications")).catch(() => ({ docs: [] }))
    ]);

    const map = new Map<string, OfficerApplication>();

    appsSnap.docs.forEach((docSnap: any) => {
      map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as OfficerApplication);
    });

    pendingSnap.docs.forEach((docSnap: any) => {
      const data = docSnap.data();
      map.set(docSnap.id, {
        id: docSnap.id,
        name: data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Officer Applicant",
        email: data.email || "",
        badgeId: data.badgeNumber || data.badgeId || `KSP-${docSnap.id.substring(0, 5).toUpperCase()}`,
        rank: data.rank || "Constable",
        station: data.policeStation || data.station || "Central Command Headquarters",
        district: data.district || "Bengaluru Urban",
        submittedAt: data.submittedAt || data.createdAt || new Date().toISOString(),
        status: data.status || "pending",
        priority: "MEDIUM",
        mobile: data.phone || data.mobile || "",
        govId: data.govId || `KSP-ID-${docSnap.id.substring(0, 5).toUpperCase()}`,
        documents: data.documents || [],
        reason: data.reason || "Requesting administrative dashboard clearance.",
        experience: data.experience || "Active State Police Duty",
        timeline: data.timeline || [{ status: "applied", date: new Date().toISOString(), remarks: "Pending Verification" }]
      } as OfficerApplication);
    });

    const list = Array.from(map.values()).sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    setLocalData("orca_applications", list);
    return list;
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore live applications fetch error:", error);
    return getLocalData("orca_applications", []);
  }
}

// 2. Fetch Live Officers Directory
export async function fetchOfficers(): Promise<any[]> {
  try {
    const [officersSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "officers")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "users")).catch(() => ({ docs: [] }))
    ]);

    // Start with /officers as the authoritative source
    const map = new Map<string, any>();

    officersSnap.docs.forEach((docSnap: any) => {
      map.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() });
    });

    // Merge /users data — only fill in missing fields, don't overwrite officer data
    usersSnap.docs.forEach((docSnap: any) => {
      const data = docSnap.data();
      const existing = map.get(docSnap.id) || {};
      map.set(docSnap.id, {
        // Identity fields — /officers takes priority, /users fills gaps
        uid: docSnap.id,
        name: existing.name || data.name || data.displayName || "State Officer",
        badgeId: existing.badgeId || data.badgeNumber || data.badgeId || `KSP-${docSnap.id.substring(0, 6).toUpperCase()}`,
        email: existing.email || data.email || "",
        rank: existing.rank || data.rank || "Officer",
        // Role / clearance — /users (more recently updated) takes priority
        role: data.dashboardRole || data.role || existing.role || "investigation_l1",
        dashboardRole: data.dashboardRole || existing.dashboardRole || data.role || "investigation_l1",
        clearanceLevel: data.clearanceLevel || data.isdLevel || existing.clearanceLevel || "ISD-LEVEL-IV",
        isdLevel: data.isdLevel || data.clearanceLevel || existing.isdLevel || "ISD-LEVEL-IV",
        // Location fields — /officers takes priority
        district: existing.district || data.district || "Bengaluru Urban",
        station: existing.station || existing.policeStation || data.policeStation || data.station || "Central Command",
        // Status
        active: data.active !== undefined ? data.active : (existing.active !== undefined ? existing.active : true),
        lastLogin: data.lastLogin || existing.lastLogin || new Date().toISOString()
      });
    });

    const list = Array.from(map.values());
    setLocalData("orca_officers", list);
    return list;
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore live officers directory fetch error:", error);
    return getLocalData("orca_officers", []);
  }
}

// 3. Fetch Live Audit Logs
export async function fetchAuditLogs(): Promise<any[]> {
  try {
    const [auditSnap, rbacSnap] = await Promise.all([
      getDocs(collection(db, "audit_logs")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "rbac_audit_logs")).catch(() => ({ docs: [] }))
    ]);

    const list: any[] = [];
    auditSnap.docs.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    rbacSnap.docs.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });

    const sorted = list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());
    setLocalData("orca_audit_logs", sorted);
    return sorted;
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore live audit logs fetch error:", error);
    return getLocalData("orca_audit_logs", []);
  }
}

// 4. Fetch Live Verification Records
export async function fetchVerificationOversight(): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "verified_documents"));
    const list: any[] = [];
    querySnapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    const sorted = list.sort((a, b) => new Date(b.verificationDate || 0).getTime() - new Date(a.verificationDate || 0).getTime());
    setLocalData("orca_verifications", sorted);
    return sorted;
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore live verification records fetch error:", error);
    return getLocalData("orca_verifications", []);
  }
}

// 5. Fetch Live System Settings
export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const querySnapshot = await getDocs(collection(db, "admin_settings"));
    let config: SystemSettings = {
      groqKey: DEFAULT_GROQ_KEY,
      ocrEngine: "tesseract",
      autoApproveConstables: false,
      mfaEnforced: true,
      sessionTimeout: 30,
      backupFrequency: "daily"
    };
    querySnapshot.forEach(doc => {
      if (doc.id === "canonical") {
        config = { ...config, ...doc.data() };
      }
    });
    setLocalData("orca_settings", config);
    return config;
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore live settings fetch error:", error);
    return getLocalData("orca_settings", MOCK_SETTINGS);
  }
}

// 6. Save Live System Settings
export async function saveSystemSettings(settings: SystemSettings): Promise<void> {
  try {
    const settingsDocRef = doc(db, "admin_settings", "canonical");
    await setDoc(settingsDocRef, settings, { merge: true });
    setLocalData("orca_settings", settings);
  } catch (error) {
    console.warn("[O.R.C.A Admin] Firestore settings save error:", error);
    setLocalData("orca_settings", settings);
  }
}
