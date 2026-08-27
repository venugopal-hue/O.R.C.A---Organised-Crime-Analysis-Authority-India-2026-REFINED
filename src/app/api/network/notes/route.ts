import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { isCatalystConfigured } from "@/lib/catalyst";
import { buildNotesGraph } from "@/lib/networkGraph";
import { NoAIProviderError } from "@/lib/aiProviders";

/**
 * POST /api/network/notes  { text }
 *
 * Turns free-text investigation notes into a graph: the AI extracts the people,
 * vehicles and links the officer WROTE (never inventing), then the Accused
 * records confirm which people are real. Solid nodes matched a record; hollow
 * nodes are from the notes only. See src/lib/networkGraph.ts.
 */
export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, configured: false, error: "Records store not connected." });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }
  const text = String(body?.text || "").trim();
  if (!text) {
    return NextResponse.json({ success: false, error: "Paste some notes first." }, { status: 400 });
  }

  try {
    const graph = await buildNotesGraph(text);
    return NextResponse.json({ success: true, configured: true, graph });
  } catch (error: any) {
    if (error instanceof NoAIProviderError) {
      return NextResponse.json(
        { success: false, error: "No AI provider is configured to read the notes." },
        { status: 503 }
      );
    }
    console.error("[network/notes]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not read the notes." },
      { status: 502 }
    );
  }
}
