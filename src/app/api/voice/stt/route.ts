import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { loadSettings } from "@/lib/systemSettings";
import { ziaStt } from "@/lib/ziaNlp";

/**
 * POST /api/voice/stt — transcribe dictated audio through Zia NLP (Catalyst).
 *
 * Replaces Sarvam. Auth is the same Catalyst OAuth token used for all data
 * operations — no separate credentials needed.
 *
 * TWO GATES, BOTH REQUIRED:
 *   - `voice.inputEnabled` — dictation is permitted at all;
 *   - `voice.sarvamStt`   — and the cloud STT route is chosen
 *     (setting key kept for backwards compatibility).
 */

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  const settings = await loadSettings().catch(() => ({} as Record<string, unknown>));
  if (!settings["voice.inputEnabled"] || !settings["voice.sarvamStt"]) {
    return NextResponse.json(
      { success: false, error: "Private dictation is not enabled in System Settings." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected an audio upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ success: false, error: "No audio file was sent." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ success: false, error: "The audio was empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "Audio too large — dictation is meant for short questions." },
      { status: 413 }
    );
  }

  const languageCode = String(form.get("language_code") || "unknown").trim() || "unknown";
  const filename = (file as File).name || "dictation.webm";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ziaStt(buffer, filename, languageCode);
    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      languageCode: result.languageCode,
    });
  } catch (error: any) {
    console.error("[voice/stt]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not transcribe the audio." },
      { status: 502 }
    );
  }
}
