import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { clientIp } from "@/lib/requestIp";
import { assessNetwork, isPrivateAddress, type GeoLookup } from "@/lib/networkTrust";
import { networkSecuritySettings } from "@/lib/systemSettings";
import { raiseSecurityAlert } from "@/lib/adminData";

/**
 * Network trust check.
 *
 * GET  — assess the caller's network and say how long they have to disconnect.
 * POST — record the warning, and escalate it to a lockout when the grace
 *        period expires.
 *
 * WHAT WAS WRONG BEFORE
 *
 * 1. BOTH verbs were UNAUTHENTICATED. The POST took `officerName`,
 *    `officerEmail` and `clientIp` straight from the request body, so anyone
 *    who could reach the URL could file a HIGH_SECURITY_ALERT against any
 *    officer by name, or flood the audit log. Identity now comes from the
 *    verified session and the body is ignored — the same rule as SEC-05/06.
 *
 * 2. The client address was read as `x-forwarded-for.split(",")[0]` — the FIRST
 *    hop, which the caller writes. Sending `X-Forwarded-For: 8.8.8.8` meant the
 *    real address was never looked up and detection was bypassed entirely. It
 *    now uses clientIp(), which takes the LAST hop.
 *
 * 3. `?simulateVpn=true` was honoured for anyone. A query parameter that
 *    fabricates a security event, writable by the person being monitored, is
 *    not a test switch — it is a way to pollute the record. It is now accepted
 *    only outside production.
 *
 * 4. It wrote to Firestore `audit_logs`, which nothing reads any more.
 *
 * 5. It answered "STATE_POLICE_INTRANET_SECURE" for every network that failed
 *    to match a keyword — asserting a secure departmental connection about an
 *    address it knew nothing about. See networkTrust.ts.
 */

const GEO_FIELDS = "status,message,countryCode,isp,org,as,proxy,hosting,query";

/**
 * Cached geo lookups, keyed by address.
 *
 * WHY THIS EXISTS
 *
 * ip-api.com's free tier allows 45 requests per minute FROM THIS SERVER, not
 * per officer. The dashboard polls this route every few seconds, so a handful
 * of officers signed in at once exhausted the quota permanently. Once
 * exhausted, every lookup failed, every failure produced LOOKUP_UNAVAILABLE,
 * and LOOKUP_UNAVAILABLE is trusted — so the VPN check quietly stopped
 * checking anything while continuing to report "secure".
 *
 * An address's network does not change second to second, so the answer is
 * cached. That turns N officers x 12 lookups a minute into roughly one lookup
 * per distinct address per TTL.
 */
const GEO_TTL_MS = 10 * 60 * 1000;
const geoCache = new Map<string, { value: GeoLookup | null; expiresAt: number }>();

/**
 * When the quota IS hit, back off rather than hammering it.
 *
 * ip-api answers 429 and returns X-Ttl, the seconds until the window resets.
 * Continuing to call during that window keeps the quota pinned at zero.
 */
let backoffUntil = 0;

/** True when the last lookup was refused for rate limiting, not for content. */
let lastLookupRateLimited = false;

/** Never let a slow third party hold an officer's dashboard open. */
async function geoLookup(ip: string): Promise<GeoLookup | null> {
  /**
   * A private address is never sent anywhere.
   *
   * This used to call ip-api with NO address for private clients, which makes
   * the service answer about the SERVER's own connection — a lookup that says
   * nothing about the officer, spends quota, and tells a third party where this
   * deployment runs. assessNetwork() already trusts private addresses on their
   * own merits, so there is nothing to ask.
   */
  if (isPrivateAddress(ip)) return null;

  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.expiresAt) {
    lastLookupRateLimited = false;
    return cached.value;
  }

  if (Date.now() < backoffUntil) {
    lastLookupRateLimited = true;
    return null;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${GEO_FIELDS}`, {
      cache: "no-store",
      headers: { "User-Agent": "ORCA-Security-Monitor/1.0" },
      signal: AbortSignal.timeout(4000),
    });

    if (res.status === 429) {
      const ttl = Number(res.headers.get("X-Ttl")) || 60;
      backoffUntil = Date.now() + ttl * 1000;
      lastLookupRateLimited = true;
      console.warn(`[vpn-check] ip-api rate limit hit; backing off ${ttl}s`);
      return null;
    }

    if (!res.ok) {
      lastLookupRateLimited = false;
      return null;
    }

    const data = await res.json();
    const value = data?.status === "success" ? (data as GeoLookup) : null;
    geoCache.set(ip, { value, expiresAt: Date.now() + GEO_TTL_MS });
    lastLookupRateLimited = false;
    return value;
  } catch {
    // Unreachable lookup is NOT evidence of a VPN — see assessNetwork().
    lastLookupRateLimited = false;
    return null;
  }
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const ip = clientIp(req);
    const settings = await networkSecuritySettings().catch(() => ({
      enforce: true,
      graceSeconds: 30,
      allowList: [] as string[],
    }));

    // Only outside production, and only then.
    const simulate =
      process.env.NODE_ENV !== "production" &&
      req.nextUrl.searchParams.get("simulateVpn") === "true";

    const geo = await geoLookup(ip);
    const verdict = assessNetwork({ ip, geo, allowList: settings.allowList, simulate });

    return NextResponse.json({
      success: true,
      // The address as the SERVER sees it. Blank when the platform sends no
      // forwarding header — honestly empty, never substituted.
      clientIp: geo?.query || ip,
      networkName: verdict.networkName,
      countryCode: verdict.countryCode,
      hosting: verdict.hosting,
      trusted: verdict.trusted,
      // Kept under the old name so nothing downstream has to change meaning.
      vpnDetected: !verdict.trusted,
      reason: verdict.reason,
      message: verdict.message,
      severity: verdict.severity,
      // Enforcement is a setting: an untrusted network is always RECORDED, but
      // whether it signs the officer out is the department's decision.
      enforce: settings.enforce,
      graceSeconds: settings.graceSeconds,
      /**
       * Whether this verdict was reached WITHOUT a network lookup.
       *
       * LOOKUP_UNAVAILABLE is trusted on purpose — an outage at a third party
       * must not lock out the force — but that made a degraded check
       * indistinguishable from a clean one. An administrator looking at the
       * security screen could not tell "no VPN detected" from "we did not
       * look". This says which.
       */
      lookupDegraded: verdict.reason === "LOOKUP_UNAVAILABLE",
      lookupRateLimited: lastLookupRateLimited,
      // Seconds until the geo provider's quota window resets, when known.
      lookupRetryInSeconds: backoffUntil > Date.now()
        ? Math.ceil((backoffUntil - Date.now()) / 1000)
        : 0,
    });
  } catch (err: any) {
    console.error("[vpn-check GET]", err);
    return NextResponse.json({ success: false, error: "Network check failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const ip = clientIp(req);
    const settings = await networkSecuritySettings().catch(() => ({
      enforce: true,
      graceSeconds: 30,
      allowList: [] as string[],
    }));
    const simulate =
      process.env.NODE_ENV !== "production" && body.simulate === true;

    /**
     * Re-assessed HERE rather than trusting what the client reports.
     *
     * The browser says "I saw a VPN"; the server checks for itself. Otherwise
     * an alert's contents — network name, severity, the reason it fired —
     * would be whatever the reporting page chose to send.
     */
    const geo = await geoLookup(ip);
    const verdict = assessNetwork({ ip, geo, allowList: settings.allowList, simulate });

    if (verdict.trusted) {
      return NextResponse.json({
        success: true,
        recorded: false,
        message: "Network is trusted; nothing recorded.",
      });
    }

    const escalated = body.outcome === "LOCKED_OUT" && settings.enforce;
    const { alertId, created } = await raiseSecurityAlert({
      firebaseUid: officer.uid,
      alertType: "UNTRUSTED_NETWORK",
      severity: verdict.severity,
      ipAddress: geo?.query || ip,
      networkName: verdict.networkName,
      countryCode: verdict.countryCode,
      reason: `${verdict.reason} — ${verdict.message}`,
      userAgent: req.headers.get("user-agent") || "",
      // Ties the alert to the session row, which is what makes one warning per
      // session possible instead of one per poll.
      sessionRowId: String(body.sessionRowId || ""),
      outcome: escalated ? "LOCKED_OUT" : "WARNED",
    });

    return NextResponse.json({
      success: true,
      recorded: true,
      created,
      alertId,
      outcome: escalated ? "LOCKED_OUT" : "WARNED",
    });
  } catch (err: any) {
    console.error("[vpn-check POST]", err);
    return NextResponse.json({ success: false, error: "Could not record the alert." }, { status: 500 });
  }
}
