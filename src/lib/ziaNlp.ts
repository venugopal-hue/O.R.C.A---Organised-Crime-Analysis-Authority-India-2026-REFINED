/**
 * Zoho Catalyst Zia NLP — TTS and STT — SERVER-SIDE ONLY.
 *
 * TTS: POST https://api.catalyst.zoho.in/quickml/api/v1/models/zia/tts/synthesize
 *      Response: audio/wav (binary stream)
 *
 * STT: POST https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe
 *      Request: multipart/form-data  { file, language }
 *      Response: { status, language, text, processing_time_ms }
 *
 * Both require: CATALYST-ORG: 60072909184  +  Zoho OAuth token
 */

import crypto from "crypto";

const ACCOUNTS_DOMAIN =
  process.env.ORCA_DS_ACCOUNTS_DOMAIN ||
  process.env.CATALYST_ACCOUNTS_DOMAIN ||
  "https://accounts.zoho.in";

const CLIENT_ID     = process.env.ORCA_DS_CLIENT_ID     || process.env.CATALYST_CLIENT_ID;
const CLIENT_SECRET = process.env.ORCA_DS_CLIENT_SECRET || process.env.CATALYST_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ORCA_ZIA_REFRESH_TOKEN || process.env.ORCA_DS_REFRESH_TOKEN || process.env.CATALYST_REFRESH_TOKEN;

const CATALYST_ORG = "60072909184";
const ZIA_TTS_URL  = "https://api.catalyst.zoho.in/quickml/api/v1/models/zia/tts/synthesize";
const ZIA_STT_URL  = "https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe";

// ── Language code mapping (BCP-47 → Zia short code) ─────────────────────────

function ziaLang(languageCode: string): string {
  if (!languageCode) return "en";
  const lc = languageCode.toLowerCase();
  if (lc.startsWith("kn")) return "kn";
  if (lc.startsWith("hi")) return "hi";
  return "en";
}

// Default speakers per language
const DEFAULT_SPEAKER: Record<string, string> = {
  kn: "Suresh",
  hi: "Rohit",
  en: "Thomas",
};

// ── OAuth token (shared cache) ────────────────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  if (inFlight) return inFlight;
  inFlight = refreshToken().finally(() => { inFlight = null; });
  return inFlight;
}

async function refreshToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID as string,
    client_secret: CLIENT_SECRET as string,
    refresh_token: REFRESH_TOKEN as string,
  });
  const res = await fetch(`${ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.access_token)
    throw new Error(`Zia token refresh failed (${res.status}): ${data.error || JSON.stringify(data)}`);
  const ttl = Number(data.expires_in) || 3600;
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 };
  return cachedToken.value;
}

// ── TTS ──────────────────────────────────────────────────────────────────────

export const TTS_CHAR_LIMIT = 1500;

export interface TtsResult {
  audioBase64: string;
  codec: string;
  truncated: boolean;
  cached: boolean;
}

const ttsCache = new Map<string, TtsResult>();
const TTS_CACHE_MAX = 200;

export async function ziaTts(rawText: string, languageCode: string): Promise<TtsResult> {
  const full = String(rawText || "").trim();
  const truncated = full.length > TTS_CHAR_LIMIT;
  const text = truncated ? full.slice(0, TTS_CHAR_LIMIT) : full;

  const lang = ziaLang(languageCode);
  const hash = crypto.createHash("sha256")
    .update(`zia|tts|${lang}|${text}`)
    .digest("hex");

  const hit = ttsCache.get(hash);
  if (hit) return { ...hit, cached: true };

  const token = await getToken();
  const res = await fetch(ZIA_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "CATALYST-ORG": CATALYST_ORG,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      language: lang,
      speaker: DEFAULT_SPEAKER[lang] ?? "Thomas",
      pitch: "moderate",
      speed: "moderate",
      emotion: "neutral",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zia TTS failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  // Response is binary audio/wav — convert to base64
  const arrayBuf = await res.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuf).toString("base64");

  const result: TtsResult = { audioBase64, codec: "wav", truncated, cached: false };
  if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
  ttsCache.set(hash, { ...result, cached: false });
  return result;
}

// ── STT ──────────────────────────────────────────────────────────────────────

export interface SttResult {
  transcript: string;
  languageCode: string | null;
}

export async function ziaStt(
  audio: Buffer,
  filename: string,
  languageCode: string
): Promise<SttResult> {
  const token = await getToken();
  const lang = ziaLang(languageCode);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)]), filename || "audio.wav");
  form.append("language", lang);

  const res = await fetch(ZIA_STT_URL, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "CATALYST-ORG": CATALYST_ORG,
    },
    body: form,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zia STT failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const body = await res.json();
  // Response: { status, language, text, processing_time_ms }
  const transcript = String(body?.text ?? body?.data?.text ?? "").trim();

  return {
    transcript,
    languageCode: body?.language ?? null,
  };
}
