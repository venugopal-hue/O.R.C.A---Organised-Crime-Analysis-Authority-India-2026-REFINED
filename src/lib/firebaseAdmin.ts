import * as admin from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { RBAC_CONFIG, clearanceForRole } from "@/lib/rbac";
import { getOfficerProfile } from "@/lib/officerAccount";

/**
 * A BAD CREDENTIAL MUST NOT TAKE THE WHOLE SERVER DOWN.
 *
 * `getAuth()` and `getFirestore()` used to run here, at module scope, with
 * nothing guarding them. If both `initializeApp` attempts failed there was no
 * default app, so `getAuth()` threw while this module was still being
 * imported — and every route that imports it answered 500 before its own code
 * ran. Seen on the deployed service: the one public route worked and every
 * authenticated route returned 500, which reads like a broken server rather
 * than a misconfigured key.
 *
 * They are resolved on first use instead. A missing or malformed service
 * account now fails the way it should: 401/403 on the routes that need an
 * identity, with the reason in the server log.
 */

/**
 * A private key survives .env files and console forms in three shapes: real
 * newlines, `\n`, or `\\n` where something has escaped the escape. All three
 * have to become real newlines or `cert()` rejects the key.
 */
function normalisePrivateKey(key: unknown): string {
  return String(key ?? "")
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

let adminApp: any = null;

function initAdminApp(): any {
  const existing = admin.getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "orca-india2026";
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson && serviceAccountJson.trim().startsWith("{")) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      serviceAccount.private_key = normalisePrivateKey(serviceAccount.private_key);
      return admin.initializeApp({ credential: admin.cert(serviceAccount) });
    } catch (err) {
      console.error(
        "[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is set but unusable — " +
          "token verification will fail and every officer will be refused. " +
          "Check it is the complete service-account JSON on one line:",
        err
      );
    }
  } else {
    console.error(
      "[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is not set. Without it no " +
        "ID token can be verified and every authenticated route will refuse."
    );
  }

  /*
   * A failed `initializeApp` can still leave a registered default app behind,
   * so this re-checks before trying again — otherwise the second call throws
   * "app already exists" and hides the real problem.
   */
  const afterFailure = admin.getApps();
  if (afterFailure.length) return afterFailure[0];

  try {
    return admin.initializeApp({ projectId });
  } catch (err) {
    console.error("[firebaseAdmin] no Firebase app could be initialised:", err);
    return null;
  }
}

function app(): any {
  if (!adminApp) adminApp = initAdminApp();
  return adminApp;
}

/**
 * Resolved on first property access, never at import.
 *
 * Call sites use `adminAuth.verifyIdToken(...)` directly, so the lazy step is
 * hidden behind a proxy rather than changing every caller.
 */
const lazy = <T extends object>(resolve: () => T): T =>
  new Proxy({} as T, {
    get(_target, prop) {
      const real = resolve() as any;
      const value = real[prop];
      return typeof value === "function" ? value.bind(real) : value;
    },
  });

export const adminAuth = lazy(() => {
  app();
  return getAuth();
});

export const adminDb = lazy(() => {
  app();
  return getFirestore();
});

/**
 * Verify ID Token from Authorization Header or Cookie and validate admin clearance.
 * Used by API routes that need to confirm a caller is an admin.
 */
/**
 * Roles that may reach Admin Controls.
 *
 * Taken from RBAC_CONFIG rather than re-listed: a role added there with
 * `admin_controls` in its menu sections is an administrator everywhere, and a
 * second hand-maintained list would eventually disagree with the one that
 * decides what the UI shows.
 */
const ADMIN_ROLES = new Set(
  (Object.keys(RBAC_CONFIG) as (keyof typeof RBAC_CONFIG)[]).filter((r) =>
    RBAC_CONFIG[r].allowedMenuSections.includes("admin_controls")
  ) as string[]
);

/** Pull the bearer token out of the cookie or the Authorization header. */
function bearerToken(req: Request | NextRequest): string | null {
  const cookieHeader = (req as NextRequest).headers?.get("cookie") || "";
  const fromCookie = cookieHeader.match(/authToken=([^;]+)/)?.[1] || null;
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (fromCookie) return fromCookie;
  return authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
}

/**
 * The officer's role and clearance, from Catalyst.
 *
 * `OfficerAccount` is the authority. This used to read the Firestore `officers`
 * and `users` documents FIRST, which broke the moment the admin console started
 * writing Catalyst: a role change took effect nowhere, because a stale
 * Firestore document kept answering first. Two stores, one of them silently
 * winning, is worse than either alone.
 *
 * Returns null when Catalyst cannot answer, so the caller can fall back to the
 * Firebase custom claims — which the same write paths keep in step — rather
 * than locking every officer out during an outage.
 */
async function catalystProfile(uid: string) {
  try {
    const profile = await getOfficerProfile(uid);
    if (!profile) return null;
    return profile;
  } catch {
    return null;
  }
}

/**
 * Verify the caller is an administrator.
 */
export async function verifyAdminRequest(req: Request | NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const emailStr = (decoded.email || "").toLowerCase();

    // 1. Catalyst is the authority.
    const profile = await catalystProfile(uid);
    if (profile) {
      // A suspended account is refused outright, whatever its claims still say.
      if (!profile.active) return null;
      if (!ADMIN_ROLES.has(profile.dashboardRole)) return null;
      return {
        uid,
        email: profile.email || emailStr,
        name: profile.name || decoded.name || "Command Administrator",
        role: profile.dashboardRole,
        dashboardRole: profile.dashboardRole,
        isdLevel: clearanceOf(profile.dashboardRole),
        active: true,
      };
    }

    /**
     * 2. Fall back to the custom claims, which every write path sets alongside
     *    the Catalyst row.
     *
     * SECURITY — what this replaced. The old fallback granted administrator to:
     *
     *     emailStr.startsWith("admin") ||
     *     emailStr === "developer@orca.gov" ||
     *     isdLevel === "ISD-LEVEL-I" || isdLevel === "ISD-LEVEL-II"
     *
     * Any account whose email merely BEGAN with "admin" was an administrator —
     * `administrator@gmail.com`, `admin.test@anything` — and one address was
     * hardcoded as a permanent backdoor. Clearance was also treated as a role,
     * so a senior investigating officer with ISD-LEVEL-II clearance silently
     * held admin rights they were never granted.
     *
     * Only the role decides now, and only a role RBAC_CONFIG marks as admin.
     */
    const role = String(decoded.dashboardRole || decoded.role || "");
    if (!ADMIN_ROLES.has(role)) return null;

    return {
      uid,
      email: emailStr,
      name: decoded.name || "Command Administrator",
      role,
      dashboardRole: role,
      isdLevel: clearanceOf(role),
      active: true,
    };
  } catch (error) {
    console.error("[verifyAdminRequest Error]:", error);
    return null;
  }
}

/**
 * Verify the caller is any active, authenticated officer — not necessarily an
 * administrator. Use this for operational endpoints (case registration,
 * document verification) that every officer is entitled to use. Gating those
 * on verifyAdminRequest would refuse the officers the feature exists for.
 */
/**
 * The clearance a caller actually holds.
 *
 * DERIVED FROM THE ROLE, not read from the stored string.
 *
 * Every one of these used to end `|| "ISD-LEVEL-IV"`, which quietly handed out
 * Field Officer clearance whenever the stored value was blank — so a record
 * with no clearance became a valid one, and a role whose real level is higher
 * was silently demoted (or, where a stale claim said ISD-LEVEL-1, promoted).
 *
 * Deriving it means the role is the single source, matching what
 * clearanceForRole enforces on every write path. An unrecognised role yields
 * "" and every gate then fails closed, which is the only safe direction.
 */
function clearanceOf(role: unknown): string {
  return clearanceForRole(String(role ?? "")) || "";
}

export async function verifyOfficerRequest(req: Request | NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return null;

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Catalyst first — same reason as above.
    const profile = await catalystProfile(uid);
    if (profile) {
      if (!profile.active) return null;
      return {
        uid,
        email: profile.email || decoded.email || "",
        name: profile.name || decoded.name || "Officer",
        rank: profile.rank || "",
        station: profile.station || "",
        district: profile.district || "",
        badgeId: profile.kgid || "",
        /*
         * The link from a Firebase account to a personnel record.
         *
         * `OfficerAccount.EmployeeID` is the only join between the two
         * systems, and the jurisdiction layer cannot place an officer in the
         * organisation without it. Null is a real answer — an account with no
         * Employee row has no unit, and therefore no scope beyond its own
         * tasks.
         */
        employeeId: profile.employeeId ?? null,
        dashboardRole: profile.dashboardRole || "field_officer",
        isdLevel: clearanceOf(profile.dashboardRole),
      };
    }

    const role = String(decoded.dashboardRole || decoded.role || "");
    if (!role) return null;
    return {
      uid,
      email: decoded.email || "",
      name: decoded.name || "Officer",
      rank: "",
      station: "",
      district: "",
      badgeId: "",
      employeeId: null,
      dashboardRole: role,
      isdLevel: clearanceOf(role),
    };
  } catch (error) {
    console.error("[verifyOfficerRequest Error]:", error);
    return null;
  }
}

/**
 * checkAdminAuth — Alias for verifyAdminRequest.
 * Validates that the calling officer has admin-level access.
 * Used by all admin API routes (approve-registration, reject, set-role, etc.)
 */
export async function checkAdminAuth(
  req: NextRequest,
  _context?: string
): Promise<{ uid: string; email: string; name: string; role: string; dashboardRole: string; isdLevel: string; active: boolean } | null> {
  return verifyAdminRequest(req);
}
