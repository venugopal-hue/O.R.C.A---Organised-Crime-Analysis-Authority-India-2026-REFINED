"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  User, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdToken,
  getIdTokenResult
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { IsdLevel, DashboardRole, RANK_DEFAULTS, Rank } from "@/lib/permissions";

export interface OfficerProfile {
  uid: string;
  email: string;
  name: string;
  rank: string;
  role: string; // Legacy / dynamic string
  district: string;
  clearanceLevel: string;
  isdLevel?: IsdLevel;
  dashboardRole?: DashboardRole;
  lastLogin: string;
  active: boolean;
  station?: string;
  division?: string;
  stateUnit?: string;
  department?: string;
  supervisor?: string;
  reportingOfficer?: string;
  departmentHead?: string;
  commandingOfficer?: string;
  permissions?: Record<string, string>;
  permissionsHistory?: any[];
  stationHistory?: any[];
  mobile?: string;
  phone?: string;
  photoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  officerProfile: OfficerProfile | null;
  loading: boolean;
  isdLevel: IsdLevel;
  dashboardRole: DashboardRole;
  login: (badgeId: string, pin: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
  hasAccess: (allowedRoles: string[]) => boolean;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getDocWithTimeout = (docRef: any, timeoutMs = 1500) => {
  return Promise.race([
    getDoc(docRef),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore Query Timeout")), timeoutMs))
  ]) as Promise<any>;
};

export const mapBadgeToEmail = (badgeId: string) => {
  const trimmed = badgeId.trim().toLowerCase();
  const badgeMap: Record<string, string> = {
    // Developer / Full Command Admin
    "developer": "developer@orca.gov",
    "dev": "developer@orca.gov",
    "admin_full": "admin2@orca.gov",
    "blr-full-001": "admin2@orca.gov",
    // SCRB Admin
    "admin_scrb": "scrbadmin@orca.gov",
    "blr-scrb-001": "scrbadmin@orca.gov",
    // Verification Admin
    "admin_verification": "admin1@orca.gov",
    "blr-ver-001": "admin1@orca.gov",
    // Investigation Officers
    "investigation_l2": "investigator2@orca.gov",
    "blr-inv2-001": "investigator2@orca.gov",
    "investigation_l1": "investigator1@orca.gov",
    "blr-inv1-001": "investigator1@orca.gov",
  };
  if (badgeMap[trimmed]) {
    return badgeMap[trimmed];
  }
  // If the input is already a full email address, use it directly
  if (trimmed.includes("@")) {
    return trimmed;
  }
  // For badge IDs — attempt to map to known domain
  const cleanBadge = trimmed.replace(/[^a-z0-9]/g, "_");
  return `${cleanBadge}@karnatakapolice.gov.in`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [officerProfile, setOfficerProfile] = useState<OfficerProfile | null>(null);
  const [isdLevel, setIsdLevel] = useState<IsdLevel>("ISD-LEVEL-IV");
  const [dashboardRole, setDashboardRole] = useState<DashboardRole>("investigation");
  const [loading, setLoading] = useState(true);

  const syncCookie = async (currentUser: any | null) => {
    if (currentUser) {
      try {
        let token = "demo-token";
        if (typeof currentUser.getIdToken === "function") {
          token = await getIdToken(currentUser);
        } else {
          token = `demo-token-${currentUser.uid || "user"}`;
        }
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        document.cookie = `authToken=${token}; path=/; max-age=86400; SameSite=Strict${isLocal ? "" : "; Secure"}`;
      } catch (e) {
        document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    } else {
      document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  };

  /**
   * Refreshes Firebase Auth ID token custom claims immediately
   */
  const refreshClaims = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      // Force token refresh from server to get latest custom claims
      const tokenResult = await getIdTokenResult(auth.currentUser, true);
      const claims = tokenResult.claims;

      let resolvedIsd: IsdLevel = (claims.isdLevel as IsdLevel) || "ISD-LEVEL-IV";
      let resolvedRole: DashboardRole = (claims.dashboardRole as DashboardRole) || "investigation_l1";

      // If claims not yet propagated, fall back to Firestore profile
      if (!claims.isdLevel || !claims.dashboardRole) {
        if (officerProfile) {
          resolvedIsd = officerProfile.isdLevel || (officerProfile.clearanceLevel as IsdLevel) || resolvedIsd;
          resolvedRole = officerProfile.dashboardRole || resolvedRole;
        }
      }

      setIsdLevel(resolvedIsd);
      setDashboardRole(resolvedRole);
      await syncCookie(auth.currentUser);
    } catch (e) {
      console.warn("Error refreshing ID token claims:", e);
    }
  }, [officerProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      await syncCookie(currentUser);

      if (currentUser) {
        // First resolve ID token claims (force fetch = true)
        let resolvedIsd: IsdLevel = "ISD-LEVEL-IV";
        let resolvedRole: DashboardRole = "investigation";

        try {
          const tokenResult = await getIdTokenResult(currentUser, true);
          if (tokenResult.claims.isdLevel) {
            resolvedIsd = tokenResult.claims.isdLevel as IsdLevel;
          }
          if (tokenResult.claims.dashboardRole) {
            resolvedRole = tokenResult.claims.dashboardRole as DashboardRole;
          }
        } catch (e) {
          // Fallback handled below
        }

        // Fetch matching Officer Profile from Firestore
        const docRef = doc(db, "users", currentUser.uid);
        const legacyRef = doc(db, "officers", currentUser.uid);

        try {
          let docSnap = await getDocWithTimeout(docRef);
          if (!docSnap.exists()) {
            docSnap = await getDocWithTimeout(legacyRef);
          }

          if (docSnap.exists()) {
            const profileData = docSnap.data();
            const rankKey = profileData.rank as Rank;
            const rankDefault = RANK_DEFAULTS[rankKey];

            // Normalise ISD level strings (numeric suffix → Roman numeral)
            // ISD-LEVEL-1 = Highest (I), ISD-LEVEL-4 = Lowest (IV)
            const rawIsd = profileData.isdLevel || profileData.clearanceLevel || resolvedIsd || rankDefault?.isdLevel || "ISD-LEVEL-IV";
            const finalIsd: IsdLevel =
              rawIsd === "ISD-LEVEL-1" ? "ISD-LEVEL-I" :
              rawIsd === "ISD-LEVEL-2" ? "ISD-LEVEL-II" :
              rawIsd === "ISD-LEVEL-3" ? "ISD-LEVEL-III" :
              rawIsd === "ISD-LEVEL-4" ? "ISD-LEVEL-IV" :
              (rawIsd as IsdLevel);

            // Prefer JWT custom claim role; fall back to Firestore profile role
            const rawRole = (["admin_full", "admin_scrb", "admin_verification", "investigation_l2", "investigation_l1"].includes(resolvedRole))
              ? resolvedRole
              : profileData.dashboardRole || profileData.role || resolvedRole;

            const isIPS = ["DGP", "ADGP", "IGP", "DIGP", "SP", "ASP", "DSP"].includes(String(rankKey || profileData.rank || ""));

            const finalRole: DashboardRole =
              rawRole === "admin_full" || rawRole === "ADMIN" || rawRole === "Administrative Dashboard - Level 2" || rawRole === "admin_l2" ? "admin_full" :
              rawRole === "admin_scrb" || rawRole === "IT Administration Dashboard" || rawRole === "it_admin" ? "admin_scrb" :
              rawRole === "admin_verification" || rawRole === "Administrative Dashboard - Level 1" || rawRole === "admin_l1" ? "admin_verification" :
              rawRole === "investigation_l2" ? "investigation_l2" :
              rawRole === "investigation_l1" ? "investigation_l1" :
              isIPS ? "investigation_l2" : "investigation_l1";

            setIsdLevel(finalIsd);
            setDashboardRole(finalRole);

            setOfficerProfile({
              ...profileData,
              uid: currentUser.uid,
              isdLevel: finalIsd,
              dashboardRole: finalRole,
            } as OfficerProfile);
          } else {
            // No Firestore profile yet — use claims directly
            setIsdLevel(resolvedIsd);
            setDashboardRole(resolvedRole !== "investigation" ? resolvedRole as DashboardRole : "investigation_l1");

            setOfficerProfile({
              uid: currentUser.uid,
              email: currentUser.email || "",
              name: currentUser.displayName || currentUser.email?.split("@")[0].toUpperCase().replace(/_/g, " ") || "Officer",
              rank: "SI",
              role: resolvedRole,
              district: "",
              clearanceLevel: resolvedIsd,
              isdLevel: resolvedIsd,
              dashboardRole: resolvedRole !== "investigation" ? resolvedRole as DashboardRole : "investigation_l1",
              lastLogin: new Date().toISOString(),
              active: true
            });
          }
        } catch (error) {
          // Firestore unreachable — fall back to claims only
          setIsdLevel(resolvedIsd);
          setDashboardRole(resolvedRole !== "investigation" ? resolvedRole as DashboardRole : "investigation_l1");

          setOfficerProfile({
            uid: currentUser.uid,
            email: currentUser.email || "",
            name: currentUser.displayName || "Officer",
            rank: "SI",
            role: resolvedRole,
            district: "",
            clearanceLevel: resolvedIsd,
            isdLevel: resolvedIsd,
            dashboardRole: resolvedRole !== "investigation" ? resolvedRole as DashboardRole : "investigation_l1",
            lastLogin: new Date().toISOString(),
            active: true
          });
        }
      } else {
        setOfficerProfile(null);
        setIsdLevel("ISD-LEVEL-IV");
        setDashboardRole("investigation");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (badgeId: string, pin: string) => {
    setLoading(true);
    const trimmedBadge = badgeId.trim();
    const trimmedPin = pin.trim();

    if (!trimmedBadge || !trimmedPin) {
      setLoading(false);
      throw new Error("Please enter your Officer Badge ID/Email and Password.");
    }

    const email = mapBadgeToEmail(trimmedBadge);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, trimmedPin);

      const docRef = doc(db, "users", userCredential.user.uid);
      const legacyRef = doc(db, "officers", userCredential.user.uid);
      let docSnap = await getDoc(docRef);
      if (!docSnap.exists()) docSnap = await getDoc(legacyRef);

      if (!docSnap.exists() || docSnap.data()?.active !== true) {
        const pendingRef = doc(db, "pendingRegistrations", userCredential.user.uid);
        const pendingSnap = await getDoc(pendingRef);
        await signOut(auth);
        if (pendingSnap.exists() && pendingSnap.data()?.status === "rejected") {
          throw new Error("Your registration was not approved. Contact your administrator for details.");
        }
        throw new Error("Your account is awaiting approval — please wait for administrator review.");
      }

      // Initialize fresh session timers & log START in Firestore
      if (typeof window !== "undefined") {
        const nowIso = new Date().toISOString();
        sessionStorage.setItem("orca_session_start", Date.now().toString());
        sessionStorage.setItem("orca_login_time", nowIso);

        // Record in persistent browser history
        try {
          const existing = JSON.parse(localStorage.getItem("orca_session_history") || "[]");
          const newEntry = {
            id: "sess_" + Date.now(),
            loginTime: nowIso,
            logoutTime: "Active Session Now",
            duration: "In Progress",
            status: "ACTIVE",
            term: `ISD-NODE-${userCredential.user.uid.substring(0, 6).toUpperCase()}`,
            method: "Cryptographic Officer Token"
          };
          localStorage.setItem("orca_session_history", JSON.stringify([newEntry, ...existing.slice(0, 49)]));
        } catch (e) {}

        fetch("/api/auth/session-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "START",
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            name: docSnap.data()?.name || userCredential.user.displayName || "Officer"
          })
        })
        .then(res => res.json())
        .then(data => {
          if (data.sessionId) {
            sessionStorage.setItem("orca_session_id", data.sessionId);
          }
        })
        .catch(e => console.error("Session start log failed", e));
      }

      // Prefer JWT custom claims; fall back to Firestore profile field
      let role: any = docSnap.data()?.dashboardRole || docSnap.data()?.role || null;
      try {
        const tokenResult = await getIdTokenResult(userCredential.user, true);
        if (tokenResult.claims.dashboardRole) {
          role = tokenResult.claims.dashboardRole;
        }
      } catch (e) {}

      return { user: userCredential.user, dashboardRole: role };
    } catch (error: any) {
      setLoading(false);
      console.warn("[Firebase Auth Error]:", error.code, error.message);

      if (process.env.NODE_ENV === "development") {
        console.warn("[Auth Dev Diagnostics]", {
          projectId: auth.app.options.projectId,
          attemptedEmail: email,
          errorCode: error.code,
          errorMessage: error.message,
        });
      }

      let friendlyMessage = "Authentication failed. Invalid Officer credentials.";
      if (error.code === "auth/user-disabled") {
        friendlyMessage = "Your account has been disabled. Contact your administrator.";
      } else if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        friendlyMessage = "Access Denied: Invalid Officer Badge ID/Email or Password.";
      } else if (error.code === "auth/invalid-email") {
        friendlyMessage = "Invalid format: Please enter a valid Officer Badge ID or Email.";
      } else if (error.code === "auth/too-many-requests") {
        friendlyMessage = "Access temporarily blocked due to multiple failed attempts. Please try again later.";
      } else if (error.message) {
        friendlyMessage = error.message;
      }

      throw new Error(friendlyMessage);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        const sessionId = sessionStorage.getItem("orca_session_id");
        const loginTime = sessionStorage.getItem("orca_login_time");

        // Record session end in Firestore with keepalive flag
        await fetch("/api/auth/session-log", {
          method: "POST",
          keepalive: true,
          headers: { 
            "Content-Type": "application/json",
            "x-login-time": loginTime || ""
          },
          body: JSON.stringify({
            action: "END",
            uid: officerProfile?.uid || user?.uid || "",
            email: officerProfile?.email || user?.email || "",
            name: officerProfile?.name || "Officer",
            sessionId: sessionId || null
          })
        }).catch(() => {});

        // Update session in persistent browser history
        try {
          const existing = JSON.parse(localStorage.getItem("orca_session_history") || "[]");
          const loginTimeStr = sessionStorage.getItem("orca_login_time");
          const nowStr = new Date().toISOString();
          let durationStr = "00h 05m 00s";
          if (loginTimeStr) {
            const diffSecs = Math.floor((Date.now() - new Date(loginTimeStr).getTime()) / 1000);
            const h = Math.floor(diffSecs / 3600);
            const m = Math.floor((diffSecs % 3600) / 60);
            const s = diffSecs % 60;
            durationStr = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
          }
          if (existing.length > 0 && existing[0].status === "ACTIVE") {
            existing[0].logoutTime = nowStr;
            existing[0].duration = durationStr;
            existing[0].status = "NORMAL_LOGOUT";
            existing[0].reason = "USER_LOGOUT";
            localStorage.setItem("orca_session_history", JSON.stringify(existing));
          }
        } catch (e) {}

        sessionStorage.removeItem("orca_session_start");
        sessionStorage.removeItem("orca_session_id");
        sessionStorage.removeItem("orca_login_time");
      }
      await signOut(auth);
      await syncCookie(null);
      setUser(null);
      setOfficerProfile(null);
      setIsdLevel("ISD-LEVEL-IV");
      setDashboardRole("investigation");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Sign-out failure: ", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (allowedRoles: string[]) => {
    if (!officerProfile && !dashboardRole) return false;
    return allowedRoles.includes(dashboardRole) || (officerProfile ? allowedRoles.includes(officerProfile.role) : false);
  };

  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{ user, officerProfile, loading, isdLevel, dashboardRole, login, logout, refreshClaims, hasAccess, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
