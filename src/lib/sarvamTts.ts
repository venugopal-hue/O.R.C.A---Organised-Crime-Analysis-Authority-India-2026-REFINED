/**
 * Sarvam AI TTS — SERVER-SIDE ONLY.
 * POST https://api.sarvam.ai/text-to-speech
 * Returns base64 WAV audio for Indian languages.
 * Keys are tried in order; exhausted/erroring keys are skipped.
 */

import crypto from "crypto";

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

const KEYS = [
  process.env.SARVAM_API_KEY_1,
  process.env.SARVAM_API_KEY_2,
  process.env.SARVAM_API_KEY_3,
  process.env.SARVAM_API_KEY_4,
].filter(Boolean) as string[];


export const SARVAM_TTS_CHAR_LIMIT = 500;

export interface SarvamTtsResult {
  audioBase64: string;
  codec: string;
  truncated: boolean;
  cached: boolean;
}

const cache = new Map<string, SarvamTtsResult>();
const CACHE_MAX = 200;

export async function sarvamTts(rawText: string, languageCode: string): Promise<SarvamTtsResult> {
  if (!KEYS.length) throw new Error("No Sarvam API keys configured.");

  const full = String(rawText || "").trim();
  const truncated = full.length > SARVAM_TTS_CHAR_LIMIT;
  const text = truncated ? full.slice(0, SARVAM_TTS_CHAR_LIMIT) : full;

  const hash = crypto.createHash("sha256")
    .update(`sarvam|tts|${languageCode}|${text}`)
    .digest("hex");

  const hit = cache.get(hash);
  if (hit) return { ...hit, cached: true };

  let lastError: Error | null = null;
  for (const key of KEYS) {
    try {
      const res = await fetch(SARVAM_TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": key,
        },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: languageCode,
          model: "bulbul:v3",
          enable_preprocessing: true,
        }),
        cache: "no-store",
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        lastError = new Error(`Sarvam TTS key failed (${res.status}): ${detail.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const audioBase64: string = data?.audios?.[0];
      if (!audioBase64) throw new Error("Sarvam TTS returned no audio.");

      const result: SarvamTtsResult = { audioBase64, codec: "wav", truncated, cached: false };
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(hash, { ...result, cached: false });
      return result;
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("All Sarvam TTS keys failed.");
}
