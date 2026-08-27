import { NextRequest, NextResponse } from "next/server";
import { denyWrite } from "@/lib/writeGuard";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import {
  listCustody,
  appendCustody,
  verifyEvidenceChain,
  listFiles,
  getEvidence,
  EvidenceUnavailableError,
} from "@/lib/evidence";

/**
 * Chain of custody for one evidence item.
 *
 * GET  /api/evidence/custody?evidence=12  -> { item, chain, verdict, files }
 * POST /api/evidence/custody              -> APPENDS one event
 *
 * There is deliberately no PUT and no DELETE. A custody log that can be edited
 * is not a custody log; a mistake is corrected by appending a correcting event.
 */

const n = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

/** Catalyst datetime wants "YYYY-MM-DD HH:MM:SS" - the form gives "...THH:MM". */
const toCatalystDate = (v: any) => {
  const s = String(v || "").trim().replace("T", " ");
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
};

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  const evidenceId = Number(new URL(req.url).searchParams.get("evidence"));
  if (!Number.isFinite(evidenceId)) {
    return NextResponse.json({ success: false, error: "evidence id is required." }, { status: 400 });
  }

  try {
    const [item, chain, verdict, files] = await Promise.all([
      getEvidence(evidenceId),
      listCustody(evidenceId),
      verifyEvidenceChain(evidenceId),
      listFiles(evidenceId).catch(() => []),
    ]);
    return NextResponse.json({ success: true, item, chain, verdict, files });
  } catch (error: any) {
    if (error instanceof EvidenceUnavailableError) {
      return NextResponse.json({ success: false, error: error.reason }, { status: 503 });
    }
    console.error("[evidence/custody GET]", error);
    return NextResponse.json({ success: false, error: "Failed to read the custody chain." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const evidenceId = n(body.evidenceId);
  const eventTypeId = n(body.eventTypeId);

  if (!evidenceId) return NextResponse.json({ success: false, error: "evidenceId is required." }, { status: 400 });
  if (!eventTypeId) return NextResponse.json({ success: false, error: "Select what happened." }, { status: 400 });
  if (!String(body.eventAt || "").trim()) {
    return NextResponse.json({ success: false, error: "Date and time of the event is required." }, { status: 400 });
  }

  try {
    const row = await appendCustody(
      evidenceId,
      {
        eventTypeId,
        fromEmployeeId: n(body.fromEmployeeId),
        toEmployeeId: n(body.toEmployeeId),
        eventAt: toCatalystDate(body.eventAt),
        location: String(body.location || ""),
        remarks: String(body.remarks || ""),
        newStatusId: n(body.newStatusId),
      },
      officer.uid // identity from the session, never the body
    );
    return NextResponse.json({ success: true, row });
  } catch (error: any) {
    if (error instanceof EvidenceUnavailableError) {
      return NextResponse.json({ success: false, error: error.reason }, { status: 503 });
    }
    console.error("[evidence/custody POST]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to record the event." },
      { status: 500 }
    );
  }
}
