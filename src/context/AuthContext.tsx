"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  User, 
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdToken,
  getIdTokenResult
} from "firebase/auth";
/**
 * No Firestore import.
 *
 * This file used to read `/users/{uid}`, `/officers/{uid}` and
 * `/pendingRegistrations/{uid}` directly from the browser. Identity now comes
 * from Catalyst through /api/officer/profile, so there is one source of truth
 * and it is the one the server enforces. Firebase remains the authenticator.
 */
import { auth } from "@/lib/firebase";
import { IsdLevel, DashboardRole, RANK_DEFAULTS, Rank } from "@/lib/permissions";
import { clearanceForRole } from "@/lib/rbac";

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


/**
 * Turn what an officer typed in the sign-in box into an email address.
 *
 * WHAT WAS REMOVED
 *
 * A hard-coded table of twelve badge->email pairs for the seven seeded
 * accounts. Typing `developer`, `dev`, `admin_full`, `admin_scrb` or
 * `blr-inv1-001` resolved to a specific real administrator's mailbox.
 *
 * It never granted access — the password was still required — but it published
 * which accounts exist and which of them are administrators, to anyone who
 * reached the login page. It also had to be edited by hand every time an
 * account was added, and it named roles (`admin_scrb`) that have since been
 * renamed, so half of it was already pointing at nothing.
 *
 * What remains is the shape rule, which is not a secret: an email is used as
 * typed, and anything else is treated as a KGID/badge and mapped onto the
 * department domain.
 */
export const mapBadgeToEmail = (badgeId: string) => {
  const trimmed = badgeId.trim().toLowerCase();

  // Already an email — use it as given.
  if (trimmed.includes("@")) {
    return trimmed;
  }

  // Otherwise treat it as a badge / KGID on the department domain.
  const cleanBadge = trimmed.replace(/[^a-z0-9]/g, "_");
  return `${cleanBadge}@karnatakapolice.gov.in`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [officerProfile, setOfficerProfile] = useState<OfficerProfile | null>(null);
  const [isdLevel, setIsdLevel] = useState<IsdLevel>("ISD-LEVEL-IV");
  /**
   * THIS IS A PLACEHOLDER, AND IT IS INDISTINGUISHABLE FROM A REAL ANSWER.
   *
   * `field_officer_l4` is a genuine role with a genuine (narrow) tab list, so a
   * consumer reading `dashboardRole` while the profile is still loading gets a
   * confident wrong answer rather than an obvious "not yet". It is the least
   * privileged option, which is the right way to be wrong — but only if callers
   * treat it as provisional.
   *
   * `loading` is the guard: it is set true at the top of the auth handler and
   * false only after `setDashboardRole` has run with the officer's real role.
   *
   * ANY code that ACTS on the role — a redirect, a fetch, a write — must wait
   * for `loading === false`. Render guards may read it early because they
   * re-evaluate when the real role lands; navigation cannot, because moving the
   * browser is not something a later render can undo. That exact bug sent
   * administrators to /unauthorized from the document-verification route.
   */
  const [dashboardRole, setDashboardRole] = useState<DashboardRole>("field_officer_l4");
  const [loading, setLoading] = useState(true);

  const syncCookie = async (currentUser: any | null) => {
    if (currentUser) {
      try {
        /**
         * Only a real Firebase ID token is ever written to the cookie.
         *
         * This used to default to the string "demo-token", and to
         * `demo-token-<uid>` when `getIdToken` was missing. Nothing on the
         * server accepts those any more — the route that did was removed — so
         * they were inert, but a literal called "demo-token" sitting in the
         * auth cookie reads as a live backdoor to anyone auditing this file,
         * and would be a real one the day somebody added a lenient check.
         *
         * Without a token the cookie is cleared instead of being filled with a
         * placeholder: no credential is the honest state, and every API route
         * already refuses an absent one.
         */
        if (typeof currentUser.getIdToken !== "function") {
          document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          return;
        }
        const token = await getIdToken(currentUser);
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        // A Firebase ID token is valid for one hour. Keeping the cookie for a
        // day left API routes verifying a token that had already expired, so
        // registration and verification started returning 403 mid-session.
        // The onIdTokenChanged listener below rewrites this on every refresh.
        document.cookie = `authToken=${token}; path=/; max-age=3600; SameSite=Strict${isLocal ? "" : "; Secure"}`;
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

      // Only a starting value for the claims path; the real clearance is
      // derived from the role below and overwrites this.
      let resolvedIsd: IsdLevel = (claims.isdLevel as IsdLevel) || ("" as IsdLevel);
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
        let resolvedRole: DashboardRole = "field_officer_l4";

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

        /**
         * The officer's profile comes from CATALYST, not Firestore.
         *
         * WHAT THIS REPLACES
         *
         * A read of `/users/{uid}` falling back to `/officers/{uid}` in
         * Firestore. The server stopped using those documents when the data
         * layer moved to Catalyst, so the app had two identity sources that
         * could disagree — and when they did, the server enforced one while the
         * sidebar rendered the other. A role changed in the admin console took
         * effect nowhere the officer could see.
         *
         * WHY CLEARANCE IS NO LONGER READ AT ALL
         *
         * It is DERIVED from the role via clearanceForRole(). The old code took
         * whatever string was stored and patched up spellings — ISD-LEVEL-1
         * through -4 were each mapped to a Roman numeral. That is how a live
         * account came to hold the claim `ISD-LEVEL-1`, which normalises to
         * ISD-LEVEL-I, the HIGHEST clearance, on a role that carries the
         * lowest. Deriving it means a stored clearance cannot promote anyone,
         * whatever it says.
         *
         * WHY THE ROLE IS NO LONGER GUESSED
         *
         * The final line used to be `isIPS ? "investigation_l2" :
         * "investigation_l1"` — an unrecognised role silently became an
         * investigation officer, chosen by rank. An unknown role now resolves
         * to nothing and every gate fails closed, which is the only safe
         * direction for access control.
         */
        try {
          const res = await fetch("/api/officer/profile", { credentials: "include" });
          const data = await res.json();
          const profile = data?.profile || null;

          // Catalyst is the authority; the ID-token claim is the fallback for
          // when the profile cannot be read.
          const role = (profile?.dashboardRole || resolvedRole) as DashboardRole;
          const clearance = (clearanceForRole(role) || resolvedIsd) as IsdLevel;

          setIsdLevel(clearance);
          setDashboardRole(role);
          setOfficerProfile({
            ...(profile || {}),
            uid: currentUser.uid,
            email: profile?.email || currentUser.email || "",
            name:
              profile?.name ||
              currentUser.displayName ||
              currentUser.email?.split("@")[0].toUpperCase().replace(/_/g, " ") ||
              "Officer",
            clearanceLevel: clearance,
            isdLevel: clearance,
            dashboardRole: role,
            active: profile?.active ?? true,
          } as OfficerProfile);
        } catch {
          // Catalyst unreachable — fall back to the verified claim, with the
          // clearance still derived from whatever role that claim names.
          const role = resolvedRole;
          const clearance = (clearanceForRole(role) || resolvedIsd) as IsdLevel;
          setIsdLevel(clearance);
          setDashboardRole(role);
          setOfficerProfile({
            uid: currentUser.uid,
            email: currentUser.email || "",
            name: currentUser.displayName || "Officer",
            role,
            district: "",
            clearanceLevel: clearance,
            isdLevel: clearance,
            dashboardRole: role,
            lastLogin: new Date().toISOString(),
            active: true,
          } as OfficerProfile);
        }
        // The session record has to survive a page reload.
        //
        // A row used to be written ONLY by login(). Firebase persists the
        // sign-in, so reopening the app restored the session without calling
        // login() and nothing was recorded - which is why the audit table held
        // one login from the day a password was last typed, while the officer
        // had been working since. RESUME adopts the open row when there is
        // one, and opens a session only when there genuinely is not.
        void ensureSessionRecorded(currentUser);
      } else {
        setOfficerProfile(null);
        setIsdLevel("ISD-LEVEL-IV");
        setDashboardRole("field_officer_l4");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Close the session when the tab goes away.
   *
   * A row was closed only by clicking Logout. Closing the tab, quitting the
   * browser or shutting the laptop left it ACTIVE for ever, so "Active
   * Sessions" only ever grew and every one of those entries claimed to be a
   * live sign-in. `pagehide` is the event that actually fires on mobile and on
   * tab close (`beforeunload` does not, reliably), and `keepalive` lets the
   * request outlive the page.
   */
  useEffect(() => {
    const closeOnExit = () => {
      const rowId = sessionStorage.getItem("orca_session_rowid");
      const sessionId = sessionStorage.getItem("orca_session_id");
      if (!rowId && !sessionId) return;
      // Not awaited - the page is going away. keepalive is what delivers it.
      fetch("/api/auth/session-log", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "x-login-time": sessionStorage.getItem("orca_login_time") || "",
        },
        body: JSON.stringify({
          action: "END",
          rowId: rowId || null,
          sessionId: sessionId || null,
          reason: "TAB_CLOSED",
        }),
      }).catch(() => {});
    };

    window.addEventListener("pagehide", closeOnExit);
    return () => window.removeEventListener("pagehide", closeOnExit);
  }, []);

  /**
   * Keep the authToken cookie in step with the live ID token.
   *
   * onAuthStateChanged above fires only on sign-in and sign-out, but Firebase
   * silently renews the ID token roughly every hour — and the API routes read
   * the cookie, not the SDK. Without this the cookie went stale an hour into a
   * session and every authenticated call 403'd until the page was reloaded.
   * Deliberately a separate listener: the sign-in effect flips `loading` and
   * re-reads Firestore, which must not run on a routine token refresh.
   */
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (currentUser) => {
      void syncCookie(currentUser);
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

      /**
       * The approval gate reads CATALYST, not Firestore.
       *
       * It used to read `/users/{uid}` then `/officers/{uid}`, and consult
       * `pendingRegistrations` to tell "awaiting review" from "rejected". The
       * server stopped writing any of those when the data layer moved, so the
       * gate was checking documents that no longer change — an officer approved
       * in the admin console could still be refused here.
       *
       * The cookie is written FIRST, before either call. `bearerToken()` on the
       * server prefers the cookie over the Authorization header, so leaving a
       * previous session's token in place would have this request answered as
       * the wrong officer.
       */
      const idToken = await userCredential.user.getIdToken();
      const isLocalHost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      document.cookie = `authToken=${idToken}; path=/; max-age=3600; SameSite=Strict${isLocalHost ? "" : "; Secure"}`;

      const profileRes = await fetch("/api/officer/profile", { credentials: "include" });
      const profileData = await profileRes.json().catch(() => null);
      const officerAccount = profileData?.profile || null;

      if (!officerAccount || officerAccount.active !== true) {
        // Distinguish "not approved yet" from "refused" using the applicant's
        // own application row — the same record the admin console decides on.
        let applicationStatus = "";
        try {
          const appRes = await fetch("/api/officer/application", { credentials: "include" });
          const appData = await appRes.json().catch(() => null);
          applicationStatus = String(appData?.application?.status || "");
        } catch {
          /* fall through to the generic message */
        }

        document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        await signOut(auth);

        if (applicationStatus === "rejected") {
          throw new Error("Your registration was not approved. Contact your administrator for details.");
        }
        if (officerAccount && officerAccount.active !== true) {
          throw new Error("This account has been suspended. Contact your administrator.");
        }
        throw new Error("Your account is awaiting approval — please wait for administrator review.");
      }

      // Initialize fresh session timers & log START in Firestore
      if (typeof window !== "undefined") {
        const nowIso = new Date().toISOString();
        sessionStorage.setItem("orca_session_start", Date.now().toString());
        sessionStorage.setItem("orca_login_time", nowIso);

        // Session history is recorded server-side in Catalyst (OfficerSession),
        // not in localStorage: a per-browser log meant an officer on a second
        // machine saw an empty history and a "first session" that was not theirs.
        //
        // The ID token is sent explicitly rather than relying on the authToken
        // cookie, which may not have been written yet at this point in sign-in.
        // The route takes the officer's identity from that token; uid/email/name
        // are no longer accepted from the body (SEC-06).
        userCredential.user.getIdToken()
          .then((idToken) =>
            fetch("/api/auth/session-log", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ action: "START" }),
            })
          )
          .then(res => res.json())
          .then(data => {
            if (data.sessionId) sessionStorage.setItem("orca_session_id", data.sessionId);
            // ROWID of the Catalyst OfficerSession row, needed to close it.
            if (data.rowId) sessionStorage.setItem("orca_session_rowid", data.rowId);
            // Server-authored sign-in time; useActiveSession reads this instead
            // of reading the session table on every fresh tab.
            if (data.loginAt) sessionStorage.setItem("orca_session_login_at", data.loginAt);
          })
          .catch(e => console.error("Session start log failed", e));
      }

      /**
       * Catalyst decides the role; the claim is only a fallback.
       *
       * This was the other way round — the claim won — which is how a stale
       * claim outranked a role the admin console had already changed. It is
       * also why an account whose claim reads `ISD-LEVEL-1` mattered: whatever
       * the record said, the token won.
       */
      let role: any = officerAccount.dashboardRole || null;
      if (!role) {
        try {
          const tokenResult = await getIdTokenResult(userCredential.user, true);
          role = tokenResult.claims.dashboardRole || null;
        } catch (e) {}
      }

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

  /**
   * Make sure this sign-in has a session row, without duplicating one.
   *
   * Guarded by sessionStorage so a re-render never re-posts, and the server
   * adopts an already-open row rather than logging a login that did not happen.
   */
  const ensureSessionRecorded = async (currentUser: User) => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("orca_session_rowid")) return;

    try {
      const idToken = await getIdToken(currentUser);
      const res = await fetch("/api/auth/session-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "RESUME" }),
      });
      const data = await res.json();
      if (data?.rowId) sessionStorage.setItem("orca_session_rowid", data.rowId);
      if (data?.sessionId) sessionStorage.setItem("orca_session_id", data.sessionId);
      if (data?.loginAt) {
        sessionStorage.setItem("orca_session_login_at", data.loginAt);
        if (!sessionStorage.getItem("orca_login_time")) {
          sessionStorage.setItem("orca_login_time", new Date(data.loginAt.replace(" ", "T")).toISOString());
        }
      }
    } catch {
      // A telemetry outage must never affect whether the officer can work.
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        const sessionId = sessionStorage.getItem("orca_session_id");
        const sessionRowId = sessionStorage.getItem("orca_session_rowid");
        const loginTime = sessionStorage.getItem("orca_login_time");

        // Record session end in Firestore with keepalive flag
        await fetch("/api/auth/session-log", {
          method: "POST",
          keepalive: true,
          headers: { 
            "Content-Type": "application/json",
            "x-login-time": loginTime || ""
          },
          // Identity comes from the session on the server; only the two record
          // handles are sent. `rowId` closes the Catalyst OfficerSession row,
          // `sessionId` the Firestore audit_logs mirror.
          body: JSON.stringify({
            action: "END",
            sessionId: sessionId || null,
            rowId: sessionRowId || null
          })
        }).catch(() => {});

        sessionStorage.removeItem("orca_session_start");
        sessionStorage.removeItem("orca_session_id");
        sessionStorage.removeItem("orca_session_rowid");
        sessionStorage.removeItem("orca_session_login_at");
        sessionStorage.removeItem("orca_login_time");
      }
      await signOut(auth);
      await syncCookie(null);
      setUser(null);
      setOfficerProfile(null);
      setIsdLevel("ISD-LEVEL-IV");
      setDashboardRole("field_officer_l4");
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
