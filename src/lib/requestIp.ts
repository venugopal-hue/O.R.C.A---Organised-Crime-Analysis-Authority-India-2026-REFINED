import type { NextRequest } from "next/server";

/**
 * The caller's IP address, for the audit trail.
 *
 * Two rules, both learned from what was here before.
 *
 * 1. NEVER invent one. Four admin routes used to fall back to a hardcoded
 *    "10.0.12.94" when the header was missing, so an audit entry for approving
 *    an officer carried an address belonging to nobody. An audit column that
 *    invents a plausible value is worse than an empty one - an empty one is
 *    visibly empty. This returns "" and the column stays blank.
 *
 * 2. Read the LAST entry of x-forwarded-for, not the first. The header is a
 *    list that the client can seed: a caller sending
 *    "X-Forwarded-For: 1.2.3.4" against a proxy that appends produces
 *    "1.2.3.4, <real address>". Taking the first entry records whatever the
 *    caller claimed. The last entry is the one the nearest proxy wrote.
 *
 * If the platform turns out not to set the header at all, this returns "" and
 * the column is honestly empty - which is the signal to go and configure the
 * proxy, rather than a fiction that hides the gap.
 */
export function clientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1].slice(0, 64);
  }
  return (req.headers.get("x-real-ip") || "").trim().slice(0, 64);
}
