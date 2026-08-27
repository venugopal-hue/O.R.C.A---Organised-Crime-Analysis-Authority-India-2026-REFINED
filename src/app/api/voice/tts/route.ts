import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { loadSettings } from "@/lib/systemSettings";
import { sarvamTts, SarvamAllKeysSpentError, TTS_CHAR_LIMIT } from "@/lib/sarvam";

/**
 * POST /api/voice/tts — narrate a reply the browser cannot speak.
 *
 * This exists for ONE language: Kannada, which has no browser voice on this
 * platform. The client is expected to keep English and Hindi entirely local
 * and only fall through to here for a language with no local voice — but the
 * route does not trust that. It refuses anything but the languages Sarvam is
 * used for, so a client bug cannot start billing English narration.
 *
 * Gated on `voice.sarvamTts`. Billed per 1,000 characters, so the text is
 * capped at the model limit (never chunked into several billed calls) and the
 * audio is cached by content upstream.
 */

// The only languages we pay Sarvam to speak. Everything else has a free
// browser voice and must never reach this route.
const ALLOWED = new Set(["kn-IN"]);

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  const settings = await loadSettings().catch(() => ({} as Record<string, unknown>));
  if (!settings["voice.sarvamTts"]) {
    return NextResponse.json(
      { success: false, error: "Kannada read-aloud is switched off in System Settings." },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  const text = String(body?.text || "").trim();
  const languageCode = String(body?.language_code || "").trim();

  if (!text) {
    return NextResponse.json({ success: false, error: "No text to speak." }, { status: 400 });
  }
  if (!ALLOWED.has(languageCode)) {
    return NextResponse.json(
      { success: false, error: `Language ${languageCode || "(none)"} is not spoken through this service.` },
      { status: 400 }
    );
  }

  try {
    const result = await sarvamTts(text, languageCode);
    return NextResponse.json({
      success: true,
      audio: result.audioBase64,
      codec: result.codec,
      truncated: result.truncated,
      cached: result.cached,
      limit: TTS_CHAR_LIMIT,
    });
  } catch (error: any) {
    if (error instanceof SarvamAllKeysSpentError) {
      return NextResponse.json(
        { success: false, error: "Read-aloud credits are exhausted.", spent: true },
        { status: 402 }
      );
    }
    console.error("[voice/tts]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not generate audio." },
      { status: 502 }
    );
  }
}
