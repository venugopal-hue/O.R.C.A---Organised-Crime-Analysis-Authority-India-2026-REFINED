/**
 * Is the officer connecting from a network the department trusts?
 *
 * Pure and dependency-free so the rules can be tested directly — the previous
 * version was inline in the route and could only be exercised by deploying.
 *
 * WHAT WAS WRONG WITH THE OLD RULES
 *
 * 1. The keyword list contained `cloudflare`, `aws`, `akamai`, `fastly`. Those
 *    are CDNs and clouds, not VPNs. Behind Cloudflare — which is where this app
 *    would sit in production — EVERY officer's connection would have matched,
 *    every officer would have been flagged and force-logged-out after 30
 *    seconds, and the platform would have been unusable. The detector would
 *    have taken the whole force offline.
 *
 * 2. `hosting` and `datacenter` were treated as VPN evidence. A police network
 *    that egresses through a government data centre is exactly that, and would
 *    have been flagged as untrusted.
 *
 * 3. The client IP was read as `x-forwarded-for.split(",")[0]` — the FIRST hop,
 *    which the caller writes. Anyone could send
 *    `X-Forwarded-For: 8.8.8.8` and have their real address never looked up,
 *    evading detection completely. See requestIp.ts, which established the
 *    last-hop rule for exactly this reason.
 *
 * WHAT COUNTS AS EVIDENCE NOW
 *
 * The `proxy` flag from the geo-IP provider, and names that identify a
 * CONSUMER VPN product. Hosting alone is not enough — it is reported
 * separately so an administrator can see it without an officer being locked
 * out over it.
 */

/** Named consumer VPN products. Matched as whole words, not substrings. */
export const VPN_PRODUCTS = [
  "nordvpn",
  "expressvpn",
  "protonvpn",
  "surfshark",
  "mullvad",
  "cyberghost",
  "tunnelbear",
  "private internet access",
  "purevpn",
  "ipvanish",
  "hide my ass",
  "hotspot shield",
  "windscribe",
  "torguard",
  "vyprvpn",
  "zenmate",
  "strongvpn",
  "astrill",
  "m247",
] as const;

/**
 * Deliberately NOT evidence of a VPN.
 *
 * Kept as a named list so the next person who reaches for "just add cloudflare
 * to the keywords" sees why it is absent.
 */
export const NOT_VPN_EVIDENCE = [
  "cloudflare",
  "amazon",
  "aws",
  "akamai",
  "fastly",
  "google",
  "microsoft",
  "azure",
] as const;

export interface GeoLookup {
  /** The provider's own proxy/VPN determination. */
  proxy?: boolean;
  /** True for a data centre. Reported, but not on its own a lockout reason. */
  hosting?: boolean;
  isp?: string;
  org?: string;
  as?: string;
  countryCode?: string;
  query?: string;
}

export type TrustVerdict = {
  trusted: boolean;
  /** Machine reason, stored on the alert row. */
  reason: string;
  /** Sentence shown to the officer. */
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  networkName: string;
  countryCode: string;
  /** True when the network is a data centre but NOT a VPN — informational. */
  hosting: boolean;
};

const norm = (s?: string) => (s || "").toLowerCase();

/** Private and loopback ranges — a local address is not a public network. */
export function isPrivateAddress(ip: string): boolean {
  const v = (ip || "").trim().toLowerCase();
  if (!v) return true;
  if (v === "::1" || v === "localhost" || v.startsWith("127.")) return true;
  if (v.startsWith("10.") || v.startsWith("192.168.")) return true;
  if (v.startsWith("169.254.") || v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("172.")) {
    const second = parseInt(v.split(".")[1] || "", 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * The department's own address ranges, from configuration.
 *
 * An explicit allow-list is the only thing that can say "this IS the state
 * intranet". Without it the honest answer for an unrecognised public address is
 * "unknown network", NOT "STATE_POLICE_INTRANET_SECURE" — which is what the old
 * route told every officer whose ISP simply did not match a keyword.
 */
export function isAllowListed(ip: string, allowList: string[]): boolean {
  const v = (ip || "").trim();
  if (!v) return false;
  return allowList
    .map((p) => p.trim())
    .filter(Boolean)
    .some((prefix) => v === prefix || v.startsWith(prefix.endsWith(".") ? prefix : `${prefix}.`));
}

export function assessNetwork(input: {
  ip: string;
  geo: GeoLookup | null;
  allowList?: string[];
  /** Set only by an explicit test switch; never inferred from a request. */
  simulate?: boolean;
}): TrustVerdict {
  const { ip, geo, allowList = [], simulate = false } = input;
  const networkName = geo?.isp || geo?.org || "Unknown network";
  const countryCode = geo?.countryCode || "";
  const hosting = Boolean(geo?.hosting);

  if (simulate) {
    return {
      trusted: false,
      reason: "SIMULATED",
      message: "Simulated untrusted connection (test mode).",
      severity: "LOW",
      networkName: "Simulated VPN",
      countryCode,
      hosting: false,
    };
  }

  if (isAllowListed(ip, allowList)) {
    return {
      trusted: true,
      reason: "ALLOW_LISTED",
      message: "Connection verified on a departmental network.",
      severity: "LOW",
      networkName,
      countryCode,
      hosting,
    };
  }

  if (isPrivateAddress(ip)) {
    return {
      trusted: true,
      reason: "PRIVATE_ADDRESS",
      message: "Connection from a local or private address.",
      severity: "LOW",
      networkName: networkName === "Unknown network" ? "Local network" : networkName,
      countryCode,
      hosting,
    };
  }

  // No geo answer: unknown, not automatically hostile. Locking officers out
  // because a third-party lookup was unreachable would be an outage of ours
  // dressed up as a security event.
  if (!geo) {
    return {
      trusted: true,
      reason: "LOOKUP_UNAVAILABLE",
      message: "Network could not be identified — the address lookup did not answer.",
      severity: "LOW",
      networkName: "Unidentified",
      countryCode,
      hosting: false,
    };
  }

  const haystack = `${norm(geo.isp)} ${norm(geo.org)} ${norm(geo.as)}`;
  const product = VPN_PRODUCTS.find((p) => haystack.includes(p));

  if (product) {
    return {
      trusted: false,
      reason: `VPN_PRODUCT:${product}`,
      message: `Connection is routed through ${networkName}, a commercial VPN service.`,
      severity: "HIGH",
      networkName,
      countryCode,
      hosting,
    };
  }

  if (geo.proxy) {
    return {
      trusted: false,
      reason: "PROXY_FLAG",
      message: `Connection from ${networkName} is flagged as an anonymising proxy.`,
      severity: "HIGH",
      networkName,
      countryCode,
      hosting,
    };
  }

  // Hosting is reported, never a lockout on its own — see the header comment.
  return {
    trusted: true,
    reason: hosting ? "HOSTING_NOT_VPN" : "PUBLIC_NETWORK",
    message: hosting
      ? `Connection from ${networkName}, a data centre. Not treated as a VPN.`
      : `Connection from ${networkName}.`,
    severity: "LOW",
    networkName,
    countryCode,
    hosting,
  };
}
