import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { recordActivitySafe } from "@/lib/officerTelemetry";
import { aiRuntimeSettings, DEFAULT_SYSTEM_PROMPT } from "@/lib/systemSettings";
import { resolveScope } from "@/lib/jurisdiction";
import {
  contradictsRetrieval,
  deniesRecords,
  directPlan,
  executePlan,
  supportedTokens,
  looksLikeRecordsQuestion,
  toolCatalogue,
  unsupportedReferences,
  validatePlan,
  visibleAnswer,
  type QueryPlan,
  type RetrievalResult,
} from "@/lib/crimeQuery";

/**
 * Vision model, used ONLY to read an image - never to answer about one.
 *
 * Measured on a real scanned notice: the 11B returns a complete, character
 * accurate transcription in ~3.4s (3/3), while the 90B takes 17-44s for the
 * same result. Asked instead to translate the notice directly, the 90B replied
 * "I cannot provide a response" 3/3, and the 11B mistranslated "0600 HOURS" as
 * "six at night" in 2/3. Reading is the reliable job; answering is not.
 */
const VISION_MODEL_FALLBACK = "meta/llama-3.2-11b-vision-instruct";

/**
 * Deliberately blunt. A politer "transcribe this" made the model summarise the
 * page instead, dropping the reference number in 3/3 runs.
 */
const TRANSCRIBE_PROMPT =
  "Read this image. Output ONLY the text that appears in it, line by line, " +
  "character for character, including every number and reference code - do not " +
  "summarise, translate or comment on it. If the image contains no text, write " +
  "NO TEXT instead. Then add one final line beginning 'VISUAL:' describing in a " +
  "single sentence what the image shows.";

const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 2_000_000;   // ~1.5 MB of image, per file
const VISION_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Transcribe one image. Returns null when it cannot be read, so the caller can
 * say so rather than answering as though the page were blank.
 */
async function transcribeImage(
  apiKey: string,
  image: { name: string; dataUrl: string },
  model: string = VISION_MODEL_FALLBACK
): Promise<string | null> {
  try {
    const res = await fetch(VISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              { type: "image_url", image_url: { url: image.dataUrl } },
            ],
          },
        ],
        temperature: 0,      // transcription is not a creative task
        max_tokens: 1024,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content || "").trim();
    return text || null;
  } catch {
    return null;
  }
}

/* ── Retrieval ───────────────────────────────────────────────────────────── */

/**
 * The standing rule, sent on EVERY request.
 *
 * Without it the model treats its own training as the crime register and
 * answers "what cases are open in Kalaburagi" with confident invention. It has
 * no database access; it has whatever this route retrieved and handed it, and
 * saying so is the only honest default.
 */
const NO_DATA_RULE =
  "\n\nDATABASE ACCESS: You have NONE, except through a RETRIEVED RECORDS block " +
  "in the officer's message. If no such block is present and the officer asks " +
  "about specific cases, FIRs, accused persons, victims, property reports or " +
  "case counts, say plainly that you could not retrieve those records and " +
  "point them to the relevant module. NEVER invent, illustrate or give an " +
  "example of an FIR number, a case, a person or a statistic.";

/** Rules attached alongside retrieved rows. Deliberately blunt for an 8B model. */
const GROUNDING_RULES =
  "\n\nGROUNDING RULES — these override every other instruction:\n" +
  "1. State ONLY what appears in the RETRIEVED RECORDS block. If something is not there, say it is not recorded.\n" +
  "2. If 0 records were retrieved, say plainly that no matching record was found. Do NOT invent an example or an illustration to fill the gap.\n" +
  "3. Never alter or invent an FIR number, name, date, district or status.\n" +
  "4. Quote identifiers exactly as they appear above.\n" +
  "5. Report what is recorded. Do not speculate about guilt, motive or what the investigation should conclude.\n" +
  "6. Write for the officer in your own sentences. Do NOT paste the block back verbatim.";

/**
 * SAY WHAT THE COUNT SAYS.
 *
 * Rule 2 above turned out to be something an 8B model applies to NON-empty
 * results too, when the conversation above it happens to contain genuine
 * no-match replies. Observed live: two FIRs retrieved and listed in the
 * evidence trail, and the answer still read "No matching record was found."
 *
 * An officer told a person has no history while the register shows two cases
 * is the worst thing this feature can produce, so the count is stated as an
 * instruction rather than left to inference — and `contradictsRetrieval`
 * catches it on the way out if the model does it anyway.
 */
const resultDirective = (matched: number) =>
  matched === 0
    ? "\n\nRESULT: 0 records were retrieved. Tell the officer plainly that no matching " +
      "record was found. Do not invent an example to fill the gap."
    : `\n\nRESULT: ${matched} record(s) WERE retrieved and are listed above. Report them to ` +
      "the officer. You must NOT say that no record was found — that would contradict the " +
      "records in front of you.";

/** The facts block, capped so a large result cannot crowd out the question. */
const MAX_FACT_CHARS = 12_000;

/**
 * Extra tokens granted on top of the configured answer length.
 *
 * `ai.maxTokens` means "how long may the ANSWER be" — that is what an
 * administrator is choosing on the AI Model Management screen. But a reasoning
 * model spends part of the same budget thinking, and the thinking is invisible
 * to the officer. With the cap set low the model reasoned right up to the limit
 * and returned empty content: a 16-token cap produced no reply at all, and even
 * a modest cap can.
 *
 * So the request asks for the configured length PLUS room to think. The
 * setting keeps meaning what it says, and a reasoning model no longer starves
 * the answer to pay for its own deliberation.
 */
const REASONING_HEADROOM = 512;

const s = (v: unknown) => String(v ?? "").trim();

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;
const IPV6_RE =
  /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1\d|[1-9])?\d)\.){3}(?:25[0-5]|(?:2[0-4]|1\d|[1-9])?\d)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1\d|[1-9])?\d)\.){3}(?:25[0-5]|(?:2[0-4]|1\d|[1-9])?\d)/;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/i;
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/;
// Matches India-style (+91 or 0-prefix) and generic international numbers (7–15 digits)
const PHONE_RE = /(?:\+91[\s\-]?)?(?:\+?[1-9]\d{0,2}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{6,10}\b/;

type OsintKind = "ip" | "domain" | "email" | "phone";

function osintTarget(question: string): { kind: OsintKind; value: string } | null {
  const lower = question.toLowerCase();
  const intent =
    /\b(osint|reputation|malicious|blacklist|threat|abuse|phishing|scam|proxy|vpn|botnet|c2|ioc|indicator|domain|ip address|ip|email|breach|leaked|compromised|phone|mobile|carrier|number)\b/.test(lower);
  if (!intent) return null;

  const email = question.match(EMAIL_RE)?.[0];
  if (email) return { kind: "email", value: email.toLowerCase() };

  const ip4 = question.match(IPV4_RE)?.[0];
  if (ip4) return { kind: "ip", value: ip4 };

  const ip6 = question.match(IPV6_RE)?.[0];
  if (ip6) return { kind: "ip", value: ip6 };

  const domain = question.match(DOMAIN_RE)?.[0];
  if (domain) return { kind: "domain", value: domain.toLowerCase() };

  // Phone is last — the regex is broad and overlaps with case/FIR numbers
  if (/\b(phone|mobile|number|carrier)\b/.test(lower)) {
    const phone = question.match(PHONE_RE)?.[0]?.replace(/[\s\-()]/g, "");
    if (phone && phone.length >= 7) return { kind: "phone", value: phone };
  }

  return null;
}

/* ── VirusTotal ──────────────────────────────────────────────────────────── */

async function vtLookup(kind: "ip" | "domain", value: string, key: string): Promise<string | null> {
  const endpoint = kind === "ip"
    ? `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(value)}`
    : `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(value)}`;
  const data = await jsonFetch(endpoint, { headers: { "x-apikey": key } }, 10_000);
  if (!data?.data?.attributes) return null;
  const a = data.data.attributes;
  const stats = a.last_analysis_stats ?? {};
  const total = Object.values(stats as Record<string, number>).reduce((acc: number, v) => acc + (Number(v) || 0), 0);
  const malicious = Number(stats.malicious ?? 0);
  const suspicious = Number(stats.suspicious ?? 0);
  const reputation = Number(a.reputation ?? 0);
  const categories = a.categories
    ? Object.values(a.categories as Record<string, string>).slice(0, 4).join(", ")
    : "";
  const lines: string[] = [
    `VirusTotal: ${malicious}/${total} engines flagged malicious, ${suspicious} flagged suspicious.`,
    `VirusTotal reputation score: ${reputation} (negative = bad actor).`,
  ];
  if (categories) lines.push(`VirusTotal categories: ${categories}.`);
  if (a.as_owner) lines.push(`VirusTotal AS owner: ${s(a.as_owner)}.`);
  if (a.country) lines.push(`VirusTotal registered country: ${s(a.country)}.`);
  return lines.join("\n");
}

/* ── Shodan ──────────────────────────────────────────────────────────────── */

async function shodanHost(ip: string, key: string): Promise<string | null> {
  const data = await jsonFetch(
    `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(key)}`,
    {},
    12_000
  );
  if (!data || data.error) return null;
  const lines: string[] = [];
  const org = s(data.org || data.isp);
  if (org) lines.push(`Shodan org/ISP: ${org}.`);
  const os = s(data.os);
  if (os) lines.push(`Shodan OS: ${os}.`);
  if (Array.isArray(data.ports) && data.ports.length) {
    lines.push(`Shodan open ports: ${data.ports.slice(0, 20).join(", ")}.`);
  }
  if (Array.isArray(data.vulns) && data.vulns.length) {
    lines.push(`Shodan known CVEs: ${(data.vulns as string[]).slice(0, 10).join(", ")} — verify before treating as confirmed.`);
  }
  if (Array.isArray(data.hostnames) && data.hostnames.length) {
    lines.push(`Shodan hostnames: ${(data.hostnames as string[]).slice(0, 6).join(", ")}.`);
  }
  if (Array.isArray(data.tags) && data.tags.length) {
    lines.push(`Shodan tags: ${(data.tags as string[]).join(", ")}.`);
  }
  return lines.length ? lines.join("\n") : null;
}

/* ── LeakCheck email breach lookup ──────────────────────────────────────── */

// Well-known disposable email domains — sampled list, not exhaustive
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","10minutemail.com","tempmail.com","throwaway.email",
  "yopmail.com","sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info",
  "spam4.me","trashmail.com","trashmail.me","dispostable.com","fakeinbox.com",
  "maildrop.cc","mailnull.com","spamgourmet.com","spamgourmet.net","discard.email",
  "mailnesia.com","mintemail.com","mt2015.com",
]);

async function leakCheckLookup(email: string, key: string): Promise<string | null> {
  const domain = email.split("@")[1] ?? "";
  const isDisposable = DISPOSABLE_DOMAINS.has(domain.toLowerCase());
  const data = await jsonFetch(
    `https://leakcheck.io/api/v2/query/${encodeURIComponent(email)}`,
    { headers: { "X-API-Key": key } },
    10_000
  );
  const lines: string[] = [];
  lines.push(`Disposable/throwaway domain check: ${isDisposable ? "YES — known disposable provider" : "not in disposable-domain list"}.`);
  if (!data || data.success === false) {
    lines.push("LeakCheck: lookup failed or returned an error.");
    return lines.join("\n");
  }
  const found = Number(data.found ?? 0);
  if (found === 0) {
    lines.push("LeakCheck: no known data breaches found for this email address.");
  } else {
    lines.push(`LeakCheck: found in ${found} breach source(s).`);
    if (Array.isArray(data.sources) && data.sources.length) {
      const names = (data.sources as any[]).slice(0, 8).map((src: any) =>
        `${s(src.name)}${src.date ? ` (${s(src.date)})` : ""}`
      );
      lines.push(`Sources: ${names.join("; ")}.`);
    }
    if (Array.isArray(data.fields) && data.fields.length) {
      lines.push(`Data fields exposed: ${(data.fields as string[]).slice(0, 8).join(", ")}.`);
    }
  }
  return lines.join("\n");
}

/* ── numverify phone OSINT ───────────────────────────────────────────────── */

async function numverifyLookup(phone: string, key: string): Promise<string | null> {
  const data = await jsonFetch(
    `http://apilayer.net/api/validate?access_key=${encodeURIComponent(key)}&number=${encodeURIComponent(phone)}&country_code=IN&format=1`,
    {},
    8_000
  );
  if (!data || data.error) return null;
  const lines: string[] = [
    `numverify: valid=${Boolean(data.valid)}, number=${s(data.international_format) || phone}.`,
  ];
  if (data.country_name) lines.push(`numverify: country=${s(data.country_name)} (${s(data.country_code)}).`);
  if (data.carrier) lines.push(`numverify: carrier=${s(data.carrier)}.`);
  if (data.line_type) lines.push(`numverify: line type=${s(data.line_type)} (mobile/landline/voip/etc).`);
  if (data.location) lines.push(`numverify: location=${s(data.location)}.`);
  return lines.join("\n");
}

/* ── Tor exit node cache ─────────────────────────────────────────────────── */

let _torExitNodes: Set<string> | null = null;
let _torCacheTs = 0;
const TOR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function isTorExitNode(ip: string): Promise<boolean | null> {
  const now = Date.now();
  if (!_torExitNodes || now - _torCacheTs > TOR_CACHE_TTL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("https://check.torproject.org/torbulkexitlist", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const text = await res.text();
      _torExitNodes = new Set(
        text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
      );
      _torCacheTs = now;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return _torExitNodes ? _torExitNodes.has(ip) : null;
}

/* ── crt.sh certificate transparency ────────────────────────────────────── */

async function crtShCerts(domain: string): Promise<{ count: number; earliest: string; latest: string; sample: string[] } | null> {
  const data = await jsonFetch(
    `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`,
    {},
    10_000
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const sorted = [...data].sort(
    (a, b) => new Date(b.not_before ?? 0).getTime() - new Date(a.not_before ?? 0).getTime()
  );
  const names = Array.from(
    new Set(sorted.slice(0, 20).map((c: any) => String(c.name_value ?? "").split("\n")[0]).filter(Boolean))
  ).slice(0, 6);
  return {
    count: data.length,
    earliest: s(sorted[sorted.length - 1]?.not_before),
    latest: s(sorted[0]?.not_before),
    sample: names,
  };
}

async function jsonFetch(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function urlhausHost(host: string): Promise<any | null> {
  return jsonFetch(
    "https://urlhaus-api.abuse.ch/v1/host/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ host }).toString(),
    },
    8000
  );
}

function envAny(...names: string[]): string {
  for (const name of names) {
    const value = s(process.env[name]);
    if (value) return value;
  }
  return "";
}

async function publicOsintBlock(target: { kind: OsintKind; value: string }): Promise<string> {
  const lines: string[] = [
    "--- PUBLIC OSINT LOOKUP (facts from live public sources) ---",
    `Target type: ${target.kind}`,
    `Target: ${target.value}`,
  ];

  /* ── Email branch ──────────────────────────────────────────────────────── */
  if (target.kind === "email") {
    const leakCheckKey = envAny("LEAKCHECK_API_KEY", "NEXT_LEAKCHECK_API_KEY");
    lines.push(`Sources queried: disposable-domain list${leakCheckKey ? ", LeakCheck" : ""}.`);
    if (leakCheckKey) {
      const result = await leakCheckLookup(target.value, leakCheckKey).catch(() => null);
      if (result) {
        lines.push(result);
      } else {
        lines.push("LeakCheck: lookup failed or no data returned.");
      }
    } else {
      // Still run the disposable check even without LeakCheck key
      const domain = target.value.split("@")[1] ?? "";
      const isDisposable = DISPOSABLE_DOMAINS.has(domain.toLowerCase());
      lines.push(`Disposable/throwaway domain check: ${isDisposable ? "YES — known disposable provider" : "not in disposable-domain list"}.`);
      lines.push("LeakCheck: not checked because LEAKCHECK_API_KEY is not configured.");
    }
  }

  /* ── Phone branch ──────────────────────────────────────────────────────── */
  else if (target.kind === "phone") {
    const numKey = envAny("NUMVERIFY_API_KEY", "NEXT_NUMVERIFY_API_KEY");
    lines.push(`Sources queried: ${numKey ? "numverify" : "(none — NUMVERIFY_API_KEY not configured)"}.`);
    if (numKey) {
      const result = await numverifyLookup(target.value, numKey).catch(() => null);
      if (result) {
        lines.push(result);
      } else {
        lines.push("numverify: lookup failed or returned an error.");
      }
    } else {
      lines.push("numverify: not checked because NUMVERIFY_API_KEY is not configured.");
    }
  }

  else if (target.kind === "ip") {
    const abuseIpDbKey = envAny("ABUSEIPDB_API_KEY", "NEXT_ABUSEIPDB_API_KEY");
    const vtKey = envAny("VIRUSTOTAL_API_KEY", "NEXT_VIRUSTOTAL_API_KEY");
    const shodanKey = envAny("SHODAN_API_KEY", "NEXT_SHODAN_API_KEY");
    const isIPv6 = IPV6_RE.test(target.value);
    const [geo, rdap, abuse, abuseIpDb, torResult, vtResult, shodanResult] = await Promise.all([
      // ip-api does not support IPv6 on the free tier; skip gracefully
      isIPv6
        ? Promise.resolve(null)
        : jsonFetch(
            `http://ip-api.com/json/${encodeURIComponent(target.value)}?fields=status,message,query,country,countryCode,regionName,city,isp,org,as,asname,proxy,hosting,mobile`
          ),
      jsonFetch(`https://rdap.org/ip/${encodeURIComponent(target.value)}`),
      urlhausHost(target.value),
      abuseIpDbKey
        ? jsonFetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target.value)}&maxAgeInDays=90&verbose`, {
            headers: { Key: abuseIpDbKey, Accept: "application/json" },
          })
        : Promise.resolve(null),
      isTorExitNode(target.value),
      vtKey ? vtLookup("ip", target.value, vtKey).catch(() => null) : Promise.resolve(null),
      shodanKey ? shodanHost(target.value, shodanKey).catch(() => null) : Promise.resolve(null),
    ]);

    const sourcesQueried = [
      isIPv6 ? null : "ip-api.com",
      "rdap.org",
      "URLhaus by abuse.ch",
      "Tor Project exit list",
      abuseIpDbKey ? "AbuseIPDB" : null,
      vtKey ? "VirusTotal" : null,
      shodanKey ? "Shodan" : null,
    ].filter(Boolean).join(", ");
    lines.push(`Sources queried: ${sourcesQueried}.`);
    if (isIPv6) lines.push("Note: target is an IPv6 address; geolocation from ip-api.com is unavailable on the free tier.");

    if (geo?.status === "success") {
      const proxy = Boolean(geo.proxy);
      const hosting = Boolean(geo.hosting);
      const riskFlags = [
        proxy ? "anonymising proxy/VPN flag" : "",
        hosting ? "hosting/datacenter flag" : "",
      ].filter(Boolean);
      lines.push(`ip-api: country=${s(geo.country)} (${s(geo.countryCode)}), region=${s(geo.regionName)}, city=${s(geo.city)}.`);
      lines.push(`ip-api: ISP=${s(geo.isp)}, org=${s(geo.org)}, ASN=${s(geo.as)} ${s(geo.asname)}.`);
      lines.push(`ip-api: proxy=${proxy}, hosting=${hosting}, mobile=${Boolean(geo.mobile)}.`);
      lines.push(
        riskFlags.length
          ? `Risk indicators present: ${riskFlags.join(", ")}. Treat this as suspicious infrastructure, not as proof of malware or criminal use.`
          : "Risk indicators present: none from ip-api proxy/hosting/mobile flags."
      );
    } else if (geo?.message) {
      lines.push(`ip-api: unavailable (${s(geo.message)}).`);
    }

    if (rdap) {
      lines.push(`RDAP ownership: name=${s(rdap.name) || "not listed"}, handle=${s(rdap.handle) || "not listed"}.`);
      // IP block registration details
      if (rdap.startAddress || rdap.endAddress) {
        lines.push(`RDAP IP range: ${s(rdap.startAddress)} – ${s(rdap.endAddress)}, type=${s(rdap.type) || "not listed"}.`);
      }
      // Events: registration / last changed
      if (Array.isArray(rdap.events)) {
        for (const ev of rdap.events) {
          if (ev?.eventAction === "registration" || ev?.eventAction === "last changed") {
            lines.push(`RDAP event: ${s(ev.eventAction)} on ${s(ev.eventDate)}.`);
          }
        }
      }
      // Remarks (abuse contacts, policy notes)
      if (Array.isArray(rdap.remarks) && rdap.remarks[0]) {
        const desc = Array.isArray(rdap.remarks[0].description) ? rdap.remarks[0].description[0] : "";
        if (desc) lines.push(`RDAP remark: ${String(desc).slice(0, 200)}.`);
      }
      const entity = Array.isArray(rdap.entities) ? rdap.entities[0] : null;
      if (entity?.vcardArray?.[1]) {
        const fn = entity.vcardArray[1].find((x: any[]) => x?.[0] === "fn")?.[3];
        const email = entity.vcardArray[1].find((x: any[]) => x?.[0] === "email")?.[3];
        if (fn) lines.push(`RDAP registrant: ${s(fn)}${email ? ` <${s(email)}>` : ""}.`);
      }
    }

    // Tor exit node check
    if (torResult === true) {
      lines.push("Tor exit node check: POSITIVE — this IP is a known Tor exit node. Traffic through it is anonymised and origin is unverifiable.");
    } else if (torResult === false) {
      lines.push("Tor exit node check: not listed as a known Tor exit node.");
    } else {
      lines.push("Tor exit node check: list unavailable (fetch failed).");
    }

    if (abuse?.query_status) {
      const urlCount = Array.isArray(abuse.urls) ? abuse.urls.length : 0;
      lines.push(`URLhaus malware URL listing: status=${s(abuse.query_status)}, listed URLs=${urlCount}.`);
      if (Array.isArray(abuse.urls) && abuse.urls[0]) {
        lines.push(`URLhaus latest sample: ${s(abuse.urls[0].url).slice(0, 300)}.`);
      }
    }
    if (abuseIpDb?.data) {
      const d = abuseIpDb.data;
      lines.push(
        `AbuseIPDB: abuse confidence=${Number(d.abuseConfidenceScore ?? 0)}/100, total reports=${Number(d.totalReports ?? 0)}, usage=${s(d.usageType) || "not listed"}.`
      );
    } else if (!abuseIpDbKey) {
      lines.push("AbuseIPDB: not checked because ABUSEIPDB_API_KEY is not configured.");
    }
    if (vtResult) {
      lines.push(vtResult);
    } else if (!vtKey) {
      lines.push("VirusTotal: not checked because VIRUSTOTAL_API_KEY is not configured.");
    }
    if (shodanResult) {
      lines.push(shodanResult);
    } else if (!shodanKey) {
      lines.push("Shodan: not checked because SHODAN_API_KEY is not configured.");
    }
  } else {
    const vtKey2 = envAny("VIRUSTOTAL_API_KEY", "NEXT_VIRUSTOTAL_API_KEY");
    const [dns, abuse, rdap, certs, vtDomainResult] = await Promise.all([
      jsonFetch(`https://dns.google/resolve?name=${encodeURIComponent(target.value)}&type=A`),
      urlhausHost(target.value),
      jsonFetch(`https://rdap.org/domain/${encodeURIComponent(target.value)}`),
      crtShCerts(target.value),
      vtKey2 ? vtLookup("domain", target.value, vtKey2).catch(() => null) : Promise.resolve(null),
    ]);

    const domainSources = [
      "Google Public DNS",
      "URLhaus by abuse.ch",
      "rdap.org",
      "crt.sh (certificate transparency)",
      vtKey2 ? "VirusTotal" : null,
    ].filter(Boolean).join(", ");
    lines.push(`Sources queried: ${domainSources}.`);
    const ips = Array.isArray(dns?.Answer)
      ? dns.Answer.filter((a: any) => a?.type === 1).map((a: any) => s(a.data)).filter(Boolean)
      : [];
    lines.push(`DNS A records: ${ips.length ? ips.join(", ") : "none returned"}.`);

    if (rdap) {
      lines.push(`RDAP registrar: ${s(rdap.port43) || "not listed"}.`);
      if (Array.isArray(rdap.events)) {
        for (const ev of rdap.events) {
          if (["registration", "expiration", "last changed"].includes(ev?.eventAction)) {
            lines.push(`RDAP: ${s(ev.eventAction)} on ${s(ev.eventDate)}.`);
          }
        }
      }
      if (Array.isArray(rdap.nameservers) && rdap.nameservers.length) {
        const ns = rdap.nameservers.slice(0, 4).map((n: any) => s(n.ldhName)).filter(Boolean);
        if (ns.length) lines.push(`RDAP nameservers: ${ns.join(", ")}.`);
      }
      const status = Array.isArray(rdap.status) ? rdap.status.slice(0, 3).join(", ") : "";
      if (status) lines.push(`RDAP domain status: ${status}.`);
      const registrant = Array.isArray(rdap.entities)
        ? rdap.entities.find((e: any) => Array.isArray(e.roles) && e.roles.includes("registrant"))
        : null;
      if (registrant?.vcardArray?.[1]) {
        const fn = registrant.vcardArray[1].find((x: any[]) => x?.[0] === "fn")?.[3];
        if (fn) lines.push(`RDAP registrant: ${s(fn)}.`);
      }
    }

    if (certs) {
      lines.push(`crt.sh certificate transparency: ${certs.count} certificate(s) ever issued.`);
      lines.push(`crt.sh: earliest cert issued ${certs.earliest || "unknown"}, most recent ${certs.latest || "unknown"}.`);
      if (certs.sample.length) {
        lines.push(`crt.sh: sample subject names: ${certs.sample.join(", ")}.`);
      }
    } else {
      lines.push("crt.sh: no certificates found or lookup failed.");
    }

    if (abuse?.query_status) {
      lines.push(`URLhaus malware URL listing: status=${s(abuse.query_status)}, listed URLs=${Array.isArray(abuse.urls) ? abuse.urls.length : 0}.`);
      if (Array.isArray(abuse.urls) && abuse.urls[0]) {
        lines.push(`URLhaus latest sample: ${s(abuse.urls[0].url).slice(0, 300)}.`);
      }
    }
    if (vtDomainResult) {
      lines.push(vtDomainResult);
    } else if (!vtKey2) {
      lines.push("VirusTotal: not checked because VIRUSTOTAL_API_KEY is not configured.");
    }
  }

  lines.push(
    "Grounding rule: use this block only for the target's live network/OSINT facts. " +
    "You may still answer the officer's wider question normally, but do not invent source results. " +
    "If proxy or hosting is true, call it suspicious infrastructure and recommend caution/escalation, but do not say it proves malicious activity. " +
    "If Tor exit node check is POSITIVE, flag it clearly — the real origin IP is unverifiable. " +
    "If VirusTotal shows malicious detections, state the count and recommend escalation; do not conclude guilt. " +
    "If Shodan shows open ports or CVEs, state them factually; a CVE being listed does not confirm exploitation. " +
    "If crt.sh returned unexpected subdomains, list them and note they may indicate broader infrastructure scope. " +
    "If LeakCheck shows breaches, list the source names and data fields, and advise the officer to treat affected credentials as compromised. " +
    "If a phone number shows as VOIP or unknown carrier, note it may be a virtual/temporary number. " +
    "Do not claim any source was checked unless it appears above."
  );
  lines.push("--- end public OSINT lookup ---\n\n");
  return lines.join("\n");
}


/**
 * Pull the first balanced JSON object out of a model reply.
 *
 * An 8B model wraps its JSON in prose and fences roughly half the time, so
 * JSON.parse on the raw string fails for reasons that have nothing to do with
 * the plan being wrong.
 */
function firstJsonObject(text: string): any {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Ask the model which single query, if any, answers this question.
 *
 * Temperature zero and a small token budget: this is a routing decision, not a
 * piece of writing. A failure here returns null and the conversation carries on
 * without data rather than failing the officer's request outright.
 */
async function planQuery(
  providers: { name: string; url: string; key?: string }[],
  model: string,
  question: string,
  history: any[]
): Promise<QueryPlan | null> {
  /*
   * ONLY THE OFFICER'S OWN EARLIER MESSAGES.
   *
   * The planner used to see the assistant's replies too, and they poisoned it:
   * after two genuine "no matching record" answers earlier in a thread, it
   * decided a plainly answerable question ("criminal history of X") needed no
   * lookup at all — so nothing was retrieved, and the model then asserted the
   * person had no history without anything having been read.
   *
   * The officer's own turns are what carry the referent a follow-up depends on
   * ("and his associates?"). The replies carry only the shape of past outcomes,
   * which is exactly the wrong thing to condition a lookup decision on.
   */
  const recent = (history || [])
    .filter((m: any) => m?.sender === "user")
    .slice(-3)
    .map((m: any) => `Officer: ${String(m.text || "").slice(0, 300)}`)
    .join("\n");

  const planPrompt =
    "You plan database lookups for a police records system. Decide whether the officer's " +
    "latest message needs a lookup.\n\n" +
    "Reply with ONE JSON object and nothing else.\n" +
    'Lookup needed:  {"tool":"<name>","args":{...}}\n' +
    'No lookup:      {"tool":"none"}\n\n' +
    "Tools:\n" +
    toolCatalogue() +
    "\n\nRules:\n" +
    "- Use only the argument names listed for that tool.\n" +
    "- Omit any argument you do not have a value for. Never invent a district, name or number the officer did not give.\n" +
    "- Dates are YYYY-MM-DD.\n" +
    "- Add a date range ONLY if the officer named one.\n" +
    /*
     * Without this the planner treats a question it has seen before as already
     * dealt with and answers "none" — so the repeat gets no lookup and the
     * model falls back on reproducing its earlier reply from memory.
     */
    "- Judge the LATEST message only. Earlier messages are context for pronouns " +
    "such as \"his\" or \"that case\". A repeated question still needs its own lookup.\n" +
    '- Greetings, legal questions, drafting, translation and explanations need no lookup: answer {"tool":"none"}.';

  /*
   * The planner tries the SAME provider chain as the answer.
   *
   * Pinned to one provider, a dead primary meant the planner returned null on
   * every question — so nothing was retrieved, and the assistant answered from
   * memory with no evidence trail to show anything was wrong. A provider
   * outage must not quietly switch off the database.
   */
  let planText = "";
  for (const provider of providers) {
    if (!provider.key) continue;
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: planPrompt },
            {
              role: "user",
              content: (recent ? `Earlier in this conversation:\n${recent}\n\n` : "") +
                `Officer's latest message:\n${question}`,
            },
          ],
          temperature: 0,
          /*
           * Generous, because a reasoning model thinks before it writes. At
           * 200 tokens gpt-oss spends the whole budget reasoning and returns
           * empty content — the plan is never emitted and every question
           * silently loses its database lookup.
           */
          max_tokens: 600,
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = visibleAnswer(data?.choices?.[0]?.message?.content);
      if (text) { planText = text; break; }
    } catch {
      // Try the next provider.
    }
  }

  try {
    if (!planText) return null;
    const parsed = firstJsonObject(planText);
    // The question is passed in so a date range the officer never asked for
    // can be dropped — see validatePlan.
    const checked = validatePlan(parsed, question);
    return "plan" in checked ? checked.plan : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // SEC-04. This route spends the server's paid AI credits and answers in the
    // voice of the Karnataka State Police, so it is not open. Any signed-in
    // officer may use it - it is deliberately NOT admin-only, since the
    // assistant is mounted on the dashboard for every rank.
    const officer = await verifyOfficerRequest(req);
    if (!officer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { prompt, history, moduleContext, activeCaseId, speechLanguage, images, auditPrompt } =
      await req.json();

    // Images arrive as data URLs, already downscaled by the client. Capped here
    // as well, because the client is not the only possible caller.
    const allImages: { name: string; dataUrl: string }[] = Array.isArray(images)
      ? images.filter(
          (i: any) =>
            i && typeof i.dataUrl === "string" && i.dataUrl.startsWith("data:image/")
        )
      : [];
    const attachedImages = allImages.slice(0, MAX_IMAGES);
    // A three-page scan plus a photo already reaches the cap. Dropping the rest
    // quietly would have the assistant answer on partial input as though it had
    // seen everything, so the shortfall is stated instead.
    const droppedImages = allImages.slice(MAX_IMAGES).map((i) => i.name);

    const oversized = attachedImages.find((i) => i.dataUrl.length > MAX_IMAGE_CHARS);
    if (oversized) {
      return NextResponse.json(
        { error: `"${oversized.name}" is too large to send. Please attach a smaller image.` },
        { status: 413 }
      );
    }
    
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    /**
     * A PROVIDER CHAIN, NOT A KEY-PRESENCE CHECK.
     *
     * This used to be `useNvidia = !!nvidiaKey` — the fallback triggered on the
     * key being ABSENT, never on it failing. So when NVIDIA retired
     * `meta/llama-3.1-8b-instruct` at 09:00Z on 2026-08-26 and started
     * answering 410 Gone, the route kept calling NVIDIA on every request and
     * the assistant was simply down, with a perfectly good Groq key sitting
     * unused in the environment.
     *
     * Now each provider is tried in turn and a failure moves to the next one.
     * The model id is the same on both, so a failover changes who answers, not
     * how.
     */
    const providers = [
      { name: "NVIDIA", url: "https://integrate.api.nvidia.com/v1/chat/completions", key: nvidiaKey },
      { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groqKey },
    ].filter((p) => !!p.key);

    if (!providers.length) {
      return NextResponse.json(
        {
          error:
            "No AI provider key is configured on the server. Set NVIDIA_API_KEY or GROQ_API_KEY " +
            "in the deployment environment.",
        },
        { status: 500 }
      );
    }

    const hasImages = attachedImages.length > 0;

    // Reading an image needs the vision model, which only NVIDIA serves on this
    // account. Rather than silently discarding the attachment, say so.
    if (hasImages && !nvidiaKey) {
      return NextResponse.json(
        { error: "Reading an attached document needs the NVIDIA key, which is not configured on this server." },
        { status: 501 }
      );
    }

    /**
     * Runtime parameters come from the SystemSetting table, not from literals.
     *
     * The AI Model Management tab had a temperature slider, a max-tokens slider
     * and a system-prompt editor, none of which was read by anything - the
     * values below were hardcoded here. They are now loaded per request, so a
     * change on that screen takes effect on the next question.
     *
     * A settings-store outage falls back to the catalogue defaults rather than
     * failing the officer's query.
     */
    const ai = await aiRuntimeSettings().catch(() => ({
      temperature: 0.3,
      maxTokens: 1024,
      maxTokensWithImages: 2048,
      historyMessages: 6,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      model: "openai/gpt-oss-20b",
      visionModel: "meta/llama-3.2-11b-vision-instruct",
    }));

    const modelName = ai.model;

    let systemPrompt = ai.systemPrompt;

    if (speechLanguage === "hi-IN") {
      systemPrompt =
        `ABSOLUTE RULE — HIGHEST PRIORITY: Respond ONLY in Hindi (हिन्दी) using Devanagari script. ` +
        `Do NOT use any English words, phrases, or sentences anywhere in your response. ` +
        `Every single word must be in Hindi. If you must name a technical term with no Hindi equivalent, transliterate it into Devanagari — never write Latin/English characters.\n\n` +
        systemPrompt;
    } else if (speechLanguage === "kn-IN") {
      systemPrompt =
        `ABSOLUTE RULE — HIGHEST PRIORITY: Respond ONLY in Kannada (ಕನ್ನಡ) using Kannada script. ` +
        `Do NOT use any English words, phrases, or sentences anywhere in your response. ` +
        `Every single word must be in Kannada. If you must name a technical term with no Kannada equivalent, transliterate it into Kannada script — never write Latin/English characters.\n\n` +
        systemPrompt;
    }

    if (moduleContext) {
      systemPrompt += `\nCURRENT PAGE CONTEXT: The investigating officer is currently viewing the "${moduleContext}" module. Answer questions in relation to this section when appropriate.`;
    }
    if (activeCaseId) {
      systemPrompt += `\nACTIVE CASE ID REFERENCE: The active case file loaded in context is "${activeCaseId}". If the officer asks to summarize, analyze or audit the active case or FIR, you should speak in reference to this ID.`;
    }

    /**
     * Stage one: read every attached image, in parallel.
     *
     * The transcription is handed to the answering model as ordinary text, so
     * the rest of the pipeline - the language mandate, the case context, the
     * history - works exactly as it does for a typed question.
     */
    let imageText = "";
    if (hasImages) {
      const transcripts = await Promise.all(
        attachedImages.map(async (img) => ({
          name: img.name,
          text: await transcribeImage(nvidiaKey as string, img, ai.visionModel),
        }))
      );

      const read = transcripts.filter((t) => t.text);
      const failed = transcripts.filter((t) => !t.text).map((t) => t.name);

      if (read.length) {
        imageText =
          "\n\n--- Text read from the attached image(s) ---\n" +
          read.map((t) => `[${t.name}]\n${t.text}`).join("\n\n") +
          "\n--- end of attached content ---\n" +
          "Answer the officer using this content. Quote numbers and reference " +
          "codes exactly as they appear above.";
      }
      if (failed.length) {
        imageText += `\n\n[These attachments could not be read: ${failed.join(", ")}. Say so plainly.]`;
      }
      if (droppedImages.length) {
        imageText += `\n\n[Only the first ${MAX_IMAGES} images could be read. Not included: ${droppedImages.join(", ")}. Say so in your answer.]`;
      }
    }

    /**
     * Stage: consult the crime database.
     *
     * A deterministic route comes first — a crime number in the question is an
     * instruction, not a hint, and answering it must not depend on how the 8B
     * planner is feeling. Only when there is no such marker is the model asked
     * to choose a query, and whatever it proposes is validated against a
     * whitelist before anything is read.
     *
     * Skipped for image questions: the officer has put the source document in
     * front of the assistant, and that document is what they are asking about.
     */
    let retrieval: RetrievalResult | null = null;
    let retrievalError: string | null = null;

    if (!hasImages && s(prompt)) {
      let plan = directPlan(String(prompt)) ??
        (await planQuery(providers, modelName, String(prompt), history || []));

      /*
       * One retry, with no conversation context at all.
       *
       * The planner declines records questions it has seen earlier in the
       * thread, and a decline is silent: nothing is retrieved and the model
       * answers from whatever it can remember. Asking again with the question
       * alone removes the only thing that could have caused the decline, and
       * costs one small temperature-zero call on the rare path.
       */
      if (!plan && looksLikeRecordsQuestion(String(prompt))) {
        plan = await planQuery(providers, modelName, String(prompt), []);
      }

      if (plan) {
        try {
          // Jurisdiction is resolved per request from the officer's own
          // personnel record, never from anything the client sent.
          const scope = await resolveScope({
            employeeId: (officer as any).employeeId ?? null,
            kgid: (officer as any).badgeId ?? null,
            dashboardRole: officer.dashboardRole,
          });
          retrieval = await executePlan(plan, scope);
        } catch (e: any) {
          // A Catalyst outage must not become a confident answer from memory.
          retrievalError = e?.message || "The records store could not be reached.";
        }
      }
    }

    /**
     * THE RECORDS TRAVEL IN THE OFFICER'S OWN TURN, NOT THE SYSTEM PROMPT.
     *
     * They started in the system prompt, which reads correctly and behaved
     * badly: the conversation history sits BETWEEN the system prompt and the
     * question, and an 8B model weights what is nearest. With two genuine
     * no-match replies earlier in the thread, a query that retrieved two FIRs
     * was answered "No criminal history is recorded" — the model copied the
     * shape of the recent turns instead of reading the rows it was given.
     *
     * Putting the rows immediately before the question makes them the last
     * thing the model sees. The system prompt keeps the persona and the
     * standing no-database rule; the evidence goes where evidence is used.
     */
    let groundingBlock = "";
    let osintBlock = "";
    const osint = !hasImages ? osintTarget(String(prompt || "")) : null;

    if (osint) {
      osintBlock = await publicOsintBlock(osint).catch(() =>
        "PUBLIC OSINT LOOKUP UNAVAILABLE: live source lookups failed. Tell the officer this plainly and continue with non-source-dependent guidance only.\n\n"
      );
    }

    if (retrieval) {
      groundingBlock =
        "--- RETRIEVED RECORDS (the only facts you may state) ---\n" +
        retrieval.facts.slice(0, MAX_FACT_CHARS) +
        (retrieval.truncated
          ? `\n[${retrieval.matched - retrieval.returned} further matching record(s) were not included. Tell the officer to narrow the query rather than implying this is the whole set.]`
          : "") +
        (retrieval.notes.length ? `\nCaveats to pass on: ${retrieval.notes.join(" ")}` : "") +
        "\n--- end of retrieved records ---" +
        GROUNDING_RULES +
        resultDirective(retrieval.matched) +
        "\n\nThe officer's question follows. Ignore the pattern of any earlier reply in " +
        "this conversation and answer from the records above.\n\n";
    } else if (retrievalError) {
      groundingBlock =
        `RECORDS UNAVAILABLE: the crime database could not be read (${retrievalError}). ` +
        "Tell the officer this plainly and do not answer from memory.\n\n";
      systemPrompt += NO_DATA_RULE;
    } else {
      systemPrompt += NO_DATA_RULE;
      /*
       * No lookup ran, and the officer is asking about records. Saying nothing
       * here is how "no criminal history is recorded" gets produced by a model
       * that never queried anything.
       */
      if (looksLikeRecordsQuestion(String(prompt || ""))) {
        groundingBlock =
          "NO DATABASE LOOKUP WAS RUN for this question. You therefore do NOT know " +
          "whether any such record exists. Say that you could not run a records lookup " +
          "and point the officer to the relevant module. You must NOT state that a " +
          "person, case or record does or does not exist.\n\n";
      }
    }

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      // `slice(-0)` returns the WHOLE array, not none — so a history setting of
      // zero would have sent every previous message instead of suppressing them.
      ...(ai.historyMessages > 0 ? (history || []).slice(-ai.historyMessages) : []).map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      })),
      { role: "user", content: osintBlock + groundingBlock + (prompt || "") + imageText },
    ];

    /**
     * Latency is MEASURED around the provider call, not estimated.
     *
     * It brackets only the answering request. The vision pass above is
     * deliberately outside it: an image query would otherwise look several
     * seconds slower than a text one for reasons that have nothing to do with
     * the answering model, and the monitoring console compares them side by side.
     */
    const startedAt = Date.now();

    /**
     * Ask each provider in turn until one actually answers.
     *
     * "Answers" means a 200 AND non-empty content. The second half matters:
     * a reasoning model given too small a budget spends the whole allowance
     * on hidden reasoning and returns `content: ""` with a 200 — observed on
     * Groq's gpt-oss. Treating that as success shipped the officer a canned
     * "ORCA AI Core processed your query", which reads like an answer and is
     * not one.
     */
    let replyText = "";
    let usage: any = {};
    let servedBy = providers[0].name;
    const attempts: string[] = [];

    for (const provider of providers) {
      try {
        const res = await fetch(provider.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.key}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: messagesPayload,
            temperature: ai.temperature,
            // Reading a document out of a photo runs long; a plain answer does
            // not. Headroom on top, so a reasoning model does not spend the
            // officer's answer budget on its own thinking.
            max_tokens: (hasImages ? ai.maxTokensWithImages : ai.maxTokens) + REASONING_HEADROOM,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({} as any));
          const detail = errData?.error?.message || errData?.detail || `HTTP ${res.status}`;
          // A retired model is worth naming exactly — it is a scheduled event
          // an administrator fixes in AI Model Management, not an outage.
          attempts.push(
            res.status === 410
              ? `${provider.name}: model "${modelName}" has reached end of life (${detail})`
              : `${provider.name}: ${detail}`
          );
          continue;
        }

        const data = await res.json();
        // Reasoning is stripped BEFORE the empty check, so a reply that is
        // nothing but thinking counts as no answer and moves to the next
        // provider rather than being shown to an officer.
        const text = visibleAnswer(data?.choices?.[0]?.message?.content);
        if (!text) {
          attempts.push(
            `${provider.name}: returned no usable answer (the model spent its whole token budget on reasoning)`
          );
          continue;
        }

        replyText = text;
        usage = data.usage || {};
        servedBy = provider.name;
        break;
      } catch (e: any) {
        attempts.push(`${provider.name}: ${e?.message || "unreachable"}`);
      }
    }

    const latencyMs = Date.now() - startedAt;

    // Shared between the success and failure paths so a failed query is
    // recorded too. It previously logged nothing on error, which meant the
    // audit trail showed only the questions that happened to work.
    const auditBase = {
      type: "AI_QUERY" as const,
      category: moduleContext ? String(moduleContext) : "Chatbot Inquiry",
      // What the officer TYPED, never the assembled prompt: that carries the
      // text of any attached file, and this column is only truncated, not
      // filtered. An audit trail should say a document was consulted, not
      // reproduce it.
      title: String(auditPrompt ?? prompt ?? "").slice(0, 255) || "(attachment only)",
      detail: [
        activeCaseId ? `Active case in context: ${activeCaseId}` : "",
        // An image query leaves the department's network, so it is worth naming
        // in the audit trail rather than logging as an ordinary text question.
        hasImages ? `Images attached: ${attachedImages.map((i) => i.name).join(", ")}` : "",
        /*
         * WHICH RECORDS THE ASSISTANT READ.
         *
         * An AI query that consulted the crime register is a different event
         * from one that did not, and an audit trail that cannot tell them
         * apart cannot answer "what did this officer look at". The tool, its
         * filters and the match count go in; the retrieved rows themselves do
         * not — they are already in the tables being audited.
         */
        retrieval
          ? `Records consulted: ${retrieval.tool}(${JSON.stringify(retrieval.args)}) → ${retrieval.matched} match(es)`
          : "",
        osint ? `Public OSINT consulted: ${osint.kind} ${osint.value}` : "",
        retrievalError ? `Records lookup FAILED: ${retrievalError}` : "",
        // Named only when it is NOT the primary, so a degraded provider shows
        // up in the audit trail instead of passing as a normal answer.
        attempts.length ? `Served by ${servedBy} after ${attempts.length} provider failure(s)` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      model: modelName,
      latencyMs,
    };

    if (!replyText) {
      /*
       * Every provider failed. The officer is told what was tried and why —
       * "AI Communication Error" alone gives an administrator nothing to act
       * on, and this is precisely the case where the reason (a retired model)
       * is both specific and fixable.
       */
      const message = `No AI provider could answer. ${attempts.join(" | ")}`;
      console.error("[chat] all providers failed:", attempts);
      recordActivitySafe(officer.uid, {
        ...auditBase,
        outcome: "ERROR",
        responseText: `[no answer] ${message}`,
      });
      throw new Error(message);
    }

    if (attempts.length) {
      // Served, but not by the first choice. Worth a server log so a silently
      // degraded primary does not go unnoticed for weeks.
      console.warn(`[chat] answered by ${servedBy} after ${attempts.length} failure(s):`, attempts);
    }

    // Audit trail for the profile screen and the AI Monitoring console.
    // Fire-and-forget: a telemetry outage must never fail the officer's query.
    recordActivitySafe(officer.uid, {
      ...auditBase,
      outcome: "OK",
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      responseText: replyText,
    });

    /**
     * The evidence trail is built from what was READ, not from what was said.
     *
     * Citations come out of the retrieval record; the model never gets a
     * chance to author one. `unsupported` then names any FIR or property
     * reference in the answer that no retrieved row backs — so an invented
     * record number is labelled on screen instead of reading as a finding.
     */
    const unsupported = unsupportedReferences(
      replyText,
      supportedTokens(retrieval, String(prompt || ''))
    );

    /*
     * The safety net for the failure above: an answer that denies records the
     * retrieval actually found. The prose cannot be un-generated, so it is
     * labelled on screen next to the trail that proves it wrong.
     */
    const contradiction = contradictsRetrieval(replyText, retrieval);

    /*
     * Absence asserted without anything having been read. Distinct from a
     * contradiction — there is no retrieval to contradict — and just as
     * misleading to an officer, so it is labelled too.
     */
    const unverifiedAbsence =
      !retrieval &&
      !retrievalError &&
      looksLikeRecordsQuestion(String(prompt || "")) &&
      deniesRecords(replyText);

    if (unverifiedAbsence) {
      console.warn(`[chat] Absence asserted with no lookup for uid=${officer.uid}`);
    }
    if (contradiction) {
      console.warn(
        `[chat] Answer denied ${retrieval?.matched} retrieved record(s) for uid=${officer.uid}`
      );
    }

    if (unsupported.length) {
      console.warn(
        `[chat] Unsupported reference(s) in answer for uid=${officer.uid}: ${unsupported.join(", ")}`
      );
    }

    return NextResponse.json({
      success: true,
      text: replyText,
      retrieval: retrieval
        ? {
            tool: retrieval.tool,
            toolLabel: retrieval.toolLabel,
            args: retrieval.args,
            matched: retrieval.matched,
            returned: retrieval.returned,
            truncated: retrieval.truncated,
            citations: retrieval.citations,
            scopeNote: retrieval.scopeNote,
            notes: retrieval.notes,
          }
        : null,
      retrievalError,
      unsupported,
      contradiction,
      unverifiedAbsence,
    });
  } catch (error: any) {
    console.error("[O.R.C.A AI Chat Route Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to generate AI response." }, { status: 500 });
  }
}
