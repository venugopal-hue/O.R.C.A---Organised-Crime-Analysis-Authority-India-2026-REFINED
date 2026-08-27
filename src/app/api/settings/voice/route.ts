import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { isCatalystConfigured } from "@/lib/catalyst";
import { loadSettings } from "@/lib/systemSettings";
import { isSarvamConfigured, sarvamKeyStatus } from "@/lib/sarvam";

/**
 * GET /api/settings/voice — may this officer dictate to the assistant?
 *
 * The assistant runs in the browser, so it has to ask. There is deliberately no
 * public settings route (the security posture is not something an
 * unauthenticated caller should be able to enumerate), and this returns exactly
 * one flag rather than the settings map.
 *
 * FAILS CLOSED. If Catalyst is unreachable or the read throws, the answer is
 * "no dictation" — not "assume yes". Getting this wrong the other way would
 * stream an officer's speech to a third party during an outage, which is the
 * one outcome the setting exists to prevent.
 *
 * Narration is not gated here at all. Text-to-speech runs entirely in the
 * browser, no audio leaves the machine, and there is nothing to permit.
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({
      success: true,
      inputEnabled: false,
      sarvamTts: false,
      sarvamStt: false,
      sarvamReady: false,
      reason: "not-configured",
    });
  }

  try {
    const settings = await loadSettings();
    // A setting can be ON while no key is installed. `sarvamReady` says whether
    // the feature can actually run, so the client offers it only when it works
    // rather than failing at the moment of use.
    const sarvamReady = isSarvamConfigured() && sarvamKeyStatus().live > 0;
    return NextResponse.json({
      success: true,
      inputEnabled: Boolean(settings["voice.inputEnabled"]),
      sarvamTts: Boolean(settings["voice.sarvamTts"]) && sarvamReady,
      sarvamStt: Boolean(settings["voice.sarvamStt"]) && sarvamReady,
      sarvamReady,
    });
  } catch (error: any) {
    console.error("[settings/voice]", error?.message);
    return NextResponse.json({
      success: true,
      inputEnabled: false,
      sarvamTts: false,
      sarvamStt: false,
      sarvamReady: false,
      reason: "unavailable",
    });
  }
}
