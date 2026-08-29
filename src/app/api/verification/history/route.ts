import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, isCatalystConfigured } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Verification scan log — the audit trail of every document check.
 *
 * GET  /api/verification/history   — the most recent scans, newest first
 * POST /api/verification/history   — append one scan
 *
 * Written server-side on purpose. An audit log the browser can post arbitrary
 * rows into is worth nothing, so `ScannedBy` is taken from the verified session
 * and never from the request body — the same rule SEC-05 established for
 * /api/verification/register.
 *
 * The backing table may not exist yet: creating it needs the
 * ZohoCatalyst.tables.CREATE scope, which the Self Client token does not carry.
 * Until then every call returns `configured: false` and the console keeps its
 * own local history, rather than the page erroring out.
 */

const TABLE = "VerificationScan";
const MAX_SCANS = 200;

/**
 * A missing table must degrade to local history, not surface as an error.
 * Catalyst answers a read on a table that does not exist with
 * `(404): No such resource with the given id exists`.
 */
function isMissingTable(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("(404)") ||
    m.includes("no such resource") ||
    m.includes("not exist") ||
    m.includes("not found") ||
    m.includes("invalid table")
  );
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, scans: [] });
  }

  try {
    const rows = await getAllRows(TABLE);
    const scans = rows
      .map((r: any) => {
        const rec = r[TABLE] || r;
        return {
          id: String(rec.ScanID ?? rec.ROWID ?? ""),
          timestamp: String(rec.ScannedAt ?? ""),
          verificationId: String(rec.VerificationID ?? ""),
          caseNumber: String(rec.CrimeNo ?? ""),
          documentName: String(rec.DocumentName ?? ""),
          status: String(rec.ScanStatus ?? "INVALID"),
          verifiedBy: String(rec.ScannedBy ?? ""),
          processingTime: String(rec.ProcessingTime ?? ""),
          errorDetails: rec.ErrorDetail ? String(rec.ErrorDetail) : undefined,
        };
      })
      // Newest first. ScannedAt is "YYYY-MM-DD HH:MM:SS", so it sorts as text.
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, MAX_SCANS);

    return NextResponse.json({ success: true, configured: true, scans });
  } catch (error: any) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ success: true, configured: false, scans: [] });
    }
    console.error("[Verification History Read]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false });
  }

  try {
    const body = await req.json();

    // Only ever the statuses the verification route can produce.
    const ALLOWED = ["VERIFIED", "TAMPERED", "DOCUMENT NOT FOUND", "INVALID"];
    const status = ALLOWED.includes(String(body.status)) ? String(body.status) : "INVALID";

    await insertRows(TABLE, [
      {
        ScanID: String(body.id || `scan-${Date.now()}`).slice(0, 255),
        ScannedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        VerificationID: String(body.verificationId || "").slice(0, 255),
        CrimeNo: String(body.caseNumber || "").slice(0, 255),
        DocumentName: String(body.documentName || "").slice(0, 255),
        ScanStatus: status,
        // From the verified session, never the body.
        ScannedBy: (officer.name || officer.email || "Officer").slice(0, 255),
        ProcessingTime: String(body.processingTime || "").slice(0, 50),
        ErrorDetail: String(body.errorDetails || "").slice(0, 10000),
      },
    ]);

    return NextResponse.json({ success: true, configured: true });
  } catch (error: any) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ success: true, configured: false });
    }
    console.error("[Verification History Write]:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
