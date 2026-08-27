import { NextRequest, NextResponse } from "next/server";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { clientIp } from "@/lib/requestIp";
import {
  normaliseReference,
  rateLimit,
  LOOKUP_LIMIT,
  STATUS_LABELS,
  PUBLIC_STATUS_NOTE,
} from "@/lib/supportTickets";

/**
 * PUBLIC ticket lookup: "check my ticket".
 *
 * GET /api/support/lookup?reference=ORCA-SUP-00012-K7F3QA
 *
 * WHAT THIS DELIBERATELY DOES NOT RETURN
 *
 * The reporter gets progress, not the case file. No submitter IP, no browser
 * diagnostics, no assignee identity, no internal priority, no event trail
 * naming the engineers who touched it. Those exist for triage and belong to
 * the admin console; echoing them to an unauthenticated caller would turn a
 * status page into a staff directory.
 *
 * The reference IS the credential — it carries a random suffix precisely so
 * this endpoint cannot be walked by counting upward. Two further guards back
 * that up: the reference is shape-checked before any read, and lookups are
 * rate limited per IP so the suffix cannot be brute-forced from one source.
 *
 * A malformed reference and an unknown reference return the SAME 404 body.
 * Distinguishing them would confirm which serials exist.
 */

const TABLE = "SupportTicket";
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

const NOT_FOUND = {
  success: false as const,
  error:
    "No ticket matches that reference. Check it against the confirmation you were shown — the reference includes the six characters after the final hyphen.",
};

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const verdict = rateLimit("support-lookup", ip, LOOKUP_LIMIT.max, LOOKUP_LIMIT.windowMs);
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many lookups from this connection. Please wait a few minutes.",
        retryAfterSeconds: verdict.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  const url = new URL(req.url);
  const reference = normaliseReference(url.searchParams.get("reference") || "");
  if (!reference) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Ticket lookup is unavailable right now. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const rows = await getAllRows(TABLE);
    const row = rows.map((r) => unwrap(r, TABLE)).find((r) => String(r.Reference || "") === reference);

    if (!row) return NextResponse.json(NOT_FOUND, { status: 404 });

    const status = String(row.Status || "NEW");

    return NextResponse.json({
      success: true,
      ticket: {
        reference,
        type: String(row.TicketType || "SUPPORT"),
        category: String(row.Category || ""),
        severity: String(row.Severity || ""),
        summary: String(row.Summary || ""),
        status,
        statusLabel: STATUS_LABELS[status] || status,
        statusNote: PUBLIC_STATUS_NOTE[status] || "",
        resolutionNote: String(row.ResolutionNote || ""),
        submittedAt: String(row.SubmittedAt || row.CREATEDTIME || ""),
        updatedAt: String(row.UpdatedAt || ""),
      },
    });
  } catch (err: any) {
    console.error("[support/lookup] failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Lookup failed. Please try again." },
      { status: 500 }
    );
  }
}
