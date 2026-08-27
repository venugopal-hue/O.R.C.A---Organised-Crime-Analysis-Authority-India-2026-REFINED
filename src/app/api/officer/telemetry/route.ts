import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { clientIp } from "@/lib/requestIp";
import {
  listTelemetry,
  startSession,
  endSession,
  recordActivity,
  TelemetryUnavailableError,
  type ActivityType,
} from "@/lib/officerTelemetry";

/**
 * The signed-in officer's own session and activity history.
 *
 * GET  /api/officer/telemetry            -> { sessions, downloads, aiQueries }
 * POST /api/officer/telemetry            -> { action: "SESSION_START" | "SESSION_END" | "ACTIVITY" }
 *
 * There is deliberately no `uid` parameter anywhere: an officer reads and
 * writes only their own trail. Viewing someone else's belongs behind an admin
 * route with its own role check.
 *
 * While the tables are absent the route answers `configured: false` with empty
 * lists, so the profile screen renders an honest empty state instead of
 * erroring — and never falls back to invented rows, which is what it used to
 * display.
 */

const VALID_ACTIVITY: ActivityType[] = ["DOWNLOAD", "AI_QUERY", "PRINT", "EXPORT"];

const EMPTY = { sessions: [], downloads: [], aiQueries: [] };

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sessions, downloads, aiQueries } = await listTelemetry(officer.uid);
    return NextResponse.json({ success: true, configured: true, sessions, downloads, aiQueries });
  } catch (error: any) {
    if (error instanceof TelemetryUnavailableError) {
      return NextResponse.json({ success: true, configured: false, reason: error.reason, ...EMPTY });
    }
    console.error("[officer/telemetry GET]", error);
    return NextResponse.json({ success: false, error: "Failed to read telemetry." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (body.action === "SESSION_START") {
      // Recorded server-side. The client cannot claim an address or identity.
      const ipAddress = clientIp(req);
      const userAgent = req.headers.get("user-agent") || "";
      const { rowId, sessionId, loginAt } = await startSession(officer.uid, { ipAddress, userAgent });
      return NextResponse.json({ success: true, rowId, sessionId, loginAt });
    }

    if (body.action === "SESSION_END") {
      const rowId = String(body.rowId || "");
      if (!rowId) {
        return NextResponse.json({ success: false, error: "rowId is required." }, { status: 400 });
      }
      // endSession only matches rows owned by this officer.
      const closed = await endSession(officer.uid, rowId, String(body.reason || ""));
      return NextResponse.json({ success: closed, closed });
    }

    if (body.action === "ACTIVITY") {
      const type = String(body.type || "") as ActivityType;
      if (!VALID_ACTIVITY.includes(type)) {
        return NextResponse.json(
          { success: false, error: `type must be one of ${VALID_ACTIVITY.join(", ")}` },
          { status: 400 }
        );
      }
      if (!String(body.title || "").trim()) {
        return NextResponse.json({ success: false, error: "title is required." }, { status: 400 });
      }
      await recordActivity(officer.uid, {
        type,
        title: String(body.title),
        category: String(body.category || ""),
        detail: String(body.detail || ""),
        sizeBytes: Number.isFinite(Number(body.sizeBytes)) ? Number(body.sizeBytes) : null,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    if (error instanceof TelemetryUnavailableError) {
      return NextResponse.json({ success: false, configured: false, reason: error.reason }, { status: 503 });
    }
    console.error("[officer/telemetry POST]", error);
    return NextResponse.json({ success: false, error: "Failed to write telemetry." }, { status: 500 });
  }
}
