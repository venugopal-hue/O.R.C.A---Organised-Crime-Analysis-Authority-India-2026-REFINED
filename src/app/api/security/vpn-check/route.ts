import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) return true;
  if (ip.startsWith("172.")) {
    const parts = ip.split(".");
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const vercelIp = req.headers.get("x-vercel-forwarded-for");
    const url = new URL(req.url);

    let rawClientIp = (forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || vercelIp || "")).trim();
    let clientIp = rawClientIp || "127.0.0.1";
    let isVpnOrProxy = false;
    let ispName = "Localhost Ingress";

    const simulatedVpn = url.searchParams.get("simulateVpn") === "true";

    // Detect headers or simulated query
    const isVpnHeader = 
      req.headers.has("x-vpn-detected") || 
      req.headers.has("via") || 
      req.headers.has("x-proxy-id") ||
      req.headers.get("forwarded")?.toLowerCase().includes("vpn") ||
      simulatedVpn;

    if (isVpnHeader) {
      isVpnOrProxy = true;
      ispName = "Simulated Commercial VPN";
    }

    // Public IP & ASN Geolocation Lookup
    // If clientIp is public (e.g. on Vercel/Production), pass clientIp to ip-api.
    // If local/private (on localhost dev), query without IP to check dev machine's egress IP.
    const isLocal = isPrivateOrLocalIp(rawClientIp);
    const ipApiUrl = isLocal
      ? "http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,query"
      : `http://ip-api.com/json/${rawClientIp}?fields=status,message,country,countryCode,regionName,city,isp,org,as,proxy,hosting,query`;

    try {
      const ipRes = await fetch(ipApiUrl, {
        cache: "no-store",
        headers: { "User-Agent": "ORCA-Security-Monitor/1.0" }
      });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.status === "success") {
          clientIp = ipData.query || clientIp;
          ispName = ipData.isp || ipData.org || "Unknown Net";
          
          const orgLower = (ipData.org || "").toLowerCase() + " " + (ipData.isp || "").toLowerCase() + " " + (ipData.as || "").toLowerCase();
          
          const vpnKeywords = [
            "vpn", "proxy", "hosting", "datacenter", "nord", "expressvpn", 
            "proton", "surfshark", "mullvad", "cyberghost", "tunnelbear", 
            "private internet access", "cloudflare", "digitalocean", "linode", "aws", "m247", "ovh", "fastly", "akamai", "hetzner"
          ];

          const isVpnKeywordMatch = vpnKeywords.some(kw => orgLower.includes(kw));

          if (ipData.proxy || ipData.hosting || isVpnKeywordMatch) {
            isVpnOrProxy = true;
          }
        }
      }
    } catch (netErr) {
      console.warn("[VPN Check API Error]:", netErr);
    }

    const vpnDetected = isVpnOrProxy || simulatedVpn;

    return NextResponse.json({
      success: true,
      clientIp,
      ispName,
      vpnDetected,
      networkType: vpnDetected ? `UNTRUSTED_VPN_PROXY (${ispName})` : "STATE_POLICE_INTRANET_SECURE",
      warningMessage: vpnDetected 
        ? `SECURITY ALERT: External VPN/Proxy connection detected [ISP: ${ispName}]. Operational telemetry flagged for ISD audit.`
        : "Connection verified on Secure State Intranet."
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, vpnDetected: false, error: err.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { officerName, officerEmail, clientIp, vpnDetails } = await req.json();

    if (adminDb) {
      await adminDb.collection("audit_logs").add({
        timestamp: FieldValue.serverTimestamp(),
        action: "VPN_PROXY_SECURITY_FLAGGED",
        operator: officerName || officerEmail || "Unknown Officer",
        details: `UNTRUSTED NETWORK INGRESS: External VPN / Proxy detected from IP [${clientIp || "External"}]. ${vpnDetails || ""}`,
        severity: "HIGH_SECURITY_ALERT"
      });
    }

    return NextResponse.json({ success: true, logged: true });
  } catch (err: any) {
    console.error("[VPN Security Audit Log Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
