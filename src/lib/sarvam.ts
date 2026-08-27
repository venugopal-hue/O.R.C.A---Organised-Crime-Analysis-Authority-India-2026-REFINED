/**
 * Sarvam AI access — SERVER-SIDE ONLY.
 *
 * Two things the browser cannot do on this machine:
 *   - narrate KANNADA — no Kannada voice is installed and Chrome's remote
 *     catalogue has none either (Hindi is the only Indic voice it offers);
 *   - transcribe speech WITHOUT sending the audio to Google — Chrome's
 *     SpeechRecognition streams to Google's servers, which is the whole reason
 *     dictation is gated off by default. Sarvam is Indian-hosted.
 *
 * WHY KEYS ARE HANDLED CAREFULLY HERE
 *
 * Each account carries a small fixed credit balance (~₹100). TTS bills per
 * 1,000 characters and STT per hour, so a spent key is a real, permanent event
 * within a demo, not a transient error. This module:
 *
 *   - reads SARVAM_API_KEY_1..8, in order, skipping empty slots;
 *   - moves to the next key on a quota/credit response (402/403/429), and
 *     marks the spent one dead FOR THE SESSION so it is not retried on every
 *     request;
 *   - caches TTS audio by content hash, so re-reading the same reply — or a
 *     demo run repeated three times — bills once, not three times.
 *
 * Never import this from a client component: it holds the keys.
 */

import crypto from "crypto";

const SARVAM_BASE = "https://api.sarvam.ai";

/** Collect the populated key slots, in priority order. */
function sarvamKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const v = process.env[`SARVAM_API_KEY_${i}`];
    if (v && v.trim()) keys.push(v.trim());
  }
  return keys;
}

export function isSarvamConfigured(): boolean {
  return sarvamKeys().length > 0;
}

/**
 * Keys proven spent this session. Keyed by the last 6 characters of the key so
 * the full secret never sits in a second structure, and so a log line can name
 * "key ...a1b2c3" without disclosing it.
 */
const exhausted = new Set<string>();
const tail = (k: string) => k.slice(-6);

export class SarvamAllKeysSpentError extends Error {
  constructor() {
    super("Every configured Sarvam key is spent or unavailable.");
    this.name = "SarvamAllKeysSpentError";
  }
}
export class SarvamNotConfiguredError extends Error {
  constructor() {
    super("No Sarvam keys are set. Add SARVAM_API_KEY_1..4 to .env.local.");
    this.name = "SarvamNotConfiguredError";
  }
}

/** How many keys are set, and how many remain usable — for a status line. */
export function sarvamKeyStatus(): { total: number; live: number } {
  const keys = sarvamKeys();
  return { total: keys.length, live: keys.filter((k) => !exhausted.has(tail(k))).length };
}

/** Quota/credit responses: this key is done, move on and remember it. */
const isQuota = (status: number) => status === 402 || status === 403 || status === 429;

/**
 * Try each live key in turn. `build` produces a fresh request per key, because
 * a multipart body (STT) cannot be reused across attempts.
 */
async function withKey(build: (key: string) => { path: string; init: RequestInit }): Promise<Response> {
  const keys = sarvamKeys();
  if (!keys.length) throw new SarvamNotConfiguredError();

  let lastDetail = "";
  for (const key of keys) {
    if (exhausted.has(tail(key))) continue;

    const { path, init } = build(key);
    let res: Response;
    try {
      res = await fetch(`${SARVAM_BASE}${path}`, {
        ...init,
        headers: { "api-subscription-key": key, ...(init.headers || {}) },
        cache: "no-store",
      });
    } catch (e: any) {
      // A network fault is not the key's fault — try the next, keep this one live.
      lastDetail = `network: ${e?.message || e}`;
      continue;
    }

    if (res.ok) return res;

    lastDetail = `${res.status} ${(await res.text()).slice(0, 200)}`;
    if (isQuota(res.status)) {
      exhausted.add(tail(key));
      console.warn(`[sarvam] key ...${tail(key)} spent (${res.status}); rotating`);
      continue;
    }
    // A non-quota error (bad request, 5xx) would recur on every key, so stop
    // rather than burn a call against each one for the same fault.
    throw new Error(`Sarvam request failed: ${lastDetail}`);
  }

  console.error(`[sarvam] all keys exhausted; last: ${lastDetail}`);
  throw new SarvamAllKeysSpentError();
}

/* ── Text to speech ──────────────────────────────────────────────────────── */

/** bulbul:v2 is the established model; v3 raises the limit to 2500. */
const TTS_MODEL = "bulbul:v2";
const TTS_SPEAKER = "anushka"; // documented v2 default
const TTS_CODEC = "mp3";
/** v2's hard limit. Longer text is truncated before the call, never chunked
 *  into several billed calls behind the officer's back. */
export const TTS_CHAR_LIMIT = 1500;

export interface TtsResult {
  audioBase64: string;
  codec: string;
  truncated: boolean;
  cached: boolean;
}

/**
 * Small content-addressed cache. The same reply text in the same language
 * always yields the same audio, so a replay or a repeated demo bills once.
 * In-memory and per-process: lost on restart, which for a credit-metered demo
 * is an acceptable trade against writing audio blobs into Catalyst.
 */
const ttsCache = new Map<string, TtsResult>();
const TTS_CACHE_MAX = 200;

export async function sarvamTts(rawText: string, languageCode: string): Promise<TtsResult> {
  const full = String(rawText || "").trim();
  const truncated = full.length > TTS_CHAR_LIMIT;
  const text = truncated ? full.slice(0, TTS_CHAR_LIMIT) : full;

  const hash = crypto
    .createHash("sha256")
    .update(`${TTS_MODEL}|${TTS_SPEAKER}|${languageCode}|${text}`)
    .digest("hex");

  const hit = ttsCache.get(hash);
  if (hit) return { ...hit, cached: true };

  const res = await withKey((_key) => ({
    path: "/text-to-speech",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language_code: languageCode,
        model: TTS_MODEL,
        speaker: TTS_SPEAKER,
        output_audio_codec: TTS_CODEC,
      }),
    },
  }));

  const body = await res.json();
  const audioBase64 = Array.isArray(body?.audios) ? body.audios[0] : null;
  if (!audioBase64) throw new Error("Sarvam returned no audio.");

  const result: TtsResult = { audioBase64, codec: TTS_CODEC, truncated, cached: false };

  if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
  ttsCache.set(hash, { ...result, cached: false });
  return result;
}

/* ── Speech to text ──────────────────────────────────────────────────────── */

/** saaras:v4 is the current transcription model. */
const STT_MODEL = "saaras:v4";

export interface SttResult {
  transcript: string;
  languageCode: string | null;
}

export async function sarvamStt(
  audio: Buffer,
  filename: string,
  languageCode: string
): Promise<SttResult> {
  const res = await withKey((_key) => {
    const form = new FormData();
    // A fresh Blob per attempt — a consumed multipart body cannot be replayed.
    form.append("file", new Blob([new Uint8Array(audio)]), filename || "audio.webm");
    form.append("model", STT_MODEL);
    // "unknown" asks Sarvam to auto-detect, which is what we want when the
    // officer has not pinned a language.
    form.append("language_code", languageCode || "unknown");
    return { path: "/speech-to-text", init: { method: "POST", body: form } };
  });

  const body = await res.json();
  return {
    transcript: String(body?.transcript || "").trim(),
    languageCode: body?.language_code ?? null,
  };
}
