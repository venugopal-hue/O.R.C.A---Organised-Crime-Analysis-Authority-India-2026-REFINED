import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { loadSettings } from "@/lib/systemSettings";
import { sarvamStt, SarvamAllKeysSpentError } from "@/lib/sarvam";

/**
 * POST /api/voice/stt — transcribe dictated audio through Sarvam.
 *
 * The private alternative to the browser's own recogniser, which streams the
 * officer's audio to Google. Sarvam is Indian-hosted. Multipart body carrying
 * one `file`, exactly as the browser's MediaRecorder produces it.
 *
 * TWO GATES, BOTH REQUIRED:
 *   - `voice.inputEnabled` — dictation is permitted at all;
 *   - `voice.sarvamStt`   — and the Sarvam route specifically is chosen.
 * With the first off, no dictation happens anywhere. With the second off, the
 * client uses the browser recogniser and never reaches here.
 *
 * Billed per hour of audio, so this is never the silent default.
 */

/** A dictated question is seconds long; anything large is not dictation. */
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
    const result = await sarvamStt(buffer, filename, languageCode);
    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      languageCode: result.languageCode,
    });
  } catch (error: any) {
    if (error instanceof SarvamAllKeysSpentError) {
      return NextResponse.json(
        { success: false, error: "Dictation credits are exhausted.", spent: true },
        { status: 402 }
      );
    }
    console.error("[voice/stt]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not transcribe the audio." },
      { status: 502 }
    );
  }
}
