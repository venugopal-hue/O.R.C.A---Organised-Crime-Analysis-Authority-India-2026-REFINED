import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { loadSettings } from "@/lib/systemSettings";
import { sarvamTts } from "@/lib/sarvamTts";

/**
 * POST /api/voice/tts — narrate a reply through Sarvam AI (Indian-hosted).
 * Gated on `voice.sarvamTts` in System Settings.
 * Only kn-IN and hi-IN reach this route; all other languages use the browser voice.
 */

const ALLOWED = new Set(["kn-IN", "hi-IN"]);

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
      { success: false, error: "Indian-language read-aloud is switched off in System Settings." },
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
    });
  } catch (error: any) {
    console.error("[voice/tts]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not generate audio." },
      { status: 502 }
    );
  }
}
