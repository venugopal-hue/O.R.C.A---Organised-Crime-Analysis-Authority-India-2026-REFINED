import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { catalystNow } from "@/lib/adminData";
import { clientIp } from "@/lib/requestIp";
import { denyWrite } from "@/lib/writeGuard";
import {
  buildReference,
  normaliseReference,
  validateSubmission,
  rateLimit,
  HONEYPOT_FIELD,
  SUBMIT_LIMIT,
  TICKET_TYPES,
  STATUSES,
  PRIORITIES,
  LIMITS,
} from "@/lib/supportTickets";

/**
 * Support tickets and incident reports.
 *
 * POST  /api/support/tickets — PUBLIC. Submit a ticket.
 * GET   /api/support/tickets — officers only. The triage queue.
 * GET   /api/support/tickets?reference=… — officers only. One ticket + its events.
 * PATCH /api/support/tickets — officers only, operational write. Triage it.
 *
 * WHY POST IS PUBLIC
 *
 * `/support` and `/report-issue` sit in the public footer, before the login
 * screen. The people who need them most are the ones who cannot get in —
 * locked accounts, failed badge mapping, a broken password reset. Putting the
 * form behind a login would make the footer link a dead end for exactly its
 * audience.
 *
 * That openness is paid for here, not in the browser: a honeypot, a per-IP
 * rate limit, server-side length caps and a fixed category list. Nothing the
 * caller sends decides status, priority or assignment.
 */

/** Catalyst wraps each row as { TableName: {...} } on some reads. */
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

const TABLE = "SupportTicket";
const EVENT_TABLE = "SupportTicketEvent";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  // Honeypot. A human never sees this field, so a value in it means a bot.
  // Answer 200 with a plausible shape and store nothing — a 403 would just
  // teach the script which field to leave alone next time.
  if (String(body[HONEYPOT_FIELD] ?? "").trim()) {
    return NextResponse.json({ success: true, reference: "" });
  }

  const ip = clientIp(req);
  const verdict = rateLimit("support-submit", ip, SUBMIT_LIMIT.max, SUBMIT_LIMIT.windowMs);
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many submissions from this connection. Try again in ${Math.ceil(
          verdict.retryAfterSeconds / 60
        )} minute(s).`,
        retryAfterSeconds: verdict.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  const checked = validateSubmission(body);
  if (!checked.ok || !checked.value) {
    return NextResponse.json({ success: false, error: checked.error }, { status: 400 });
  }
  const t = checked.value;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error:
          "The ticket store is not reachable right now. Please try again later, or contact your district administrator.",
      },
      { status: 503 }
    );
  }

  try {
    const serial = await nextId(TABLE, "TicketID");
    const reference = buildReference(t.type, serial);
    const now = catalystNow();

    await insertRows(TABLE, [
      {
        TicketID: serial,
        TicketType: t.type,
        Reference: reference,
        ReporterName: t.reporterName,
        ReporterBadge: t.reporterBadge,
        ReporterEmail: t.reporterEmail,
        Category: t.category,
        Severity: t.severity,
        Summary: t.summary,
        Details: t.details,
        Diagnostics: t.diagnostics,
        Status: "NEW",
        TicketPriority: "",
        AssignedTo: "",
        ResolutionNote: "",
        SubmittedIP: ip,
        SubmittedAt: now,
        UpdatedAt: now,
      },
    ]);

    const eventId = await nextId(EVENT_TABLE, "EventID");
    await insertRows(EVENT_TABLE, [
      {
        EventID: eventId,
        TicketID: reference,
        Action: "SUBMITTED",
        Actor: t.reporterName,
        Note: `${t.type === "INCIDENT" ? "Incident report" : "Support ticket"} received.`,
        At: now,
      },
    ]);

    return NextResponse.json({ success: true, reference, status: "NEW", submittedAt: now });
  } catch (err: any) {
    console.error("[support/tickets] submit failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not record the ticket. Please try again." },
      { status: 500 }
    );
  }
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
    return NextResponse.json({ success: true, configured: false, tickets: [] });
  }

  const url = new URL(req.url);
  const typeFilter = String(url.searchParams.get("type") || "").toUpperCase();
  const statusFilter = String(url.searchParams.get("status") || "").toUpperCase();
  const wanted = normaliseReference(url.searchParams.get("reference") || "");

  try {
    const raw = await getAllRows(TABLE);
    let tickets = raw
      .map((r) => unwrap(r, TABLE))
      .map((r) => ({
        rowId: String(r.ROWID || ""),
        ticketId: Number(r.TicketID || 0),
        reference: String(r.Reference || ""),
        type: String(r.TicketType || "SUPPORT"),
        reporterName: String(r.ReporterName || ""),
        reporterBadge: String(r.ReporterBadge || ""),
        reporterEmail: String(r.ReporterEmail || ""),
        category: String(r.Category || ""),
        severity: String(r.Severity || "MEDIUM"),
        summary: String(r.Summary || ""),
        details: String(r.Details || ""),
        diagnostics: String(r.Diagnostics || ""),
        status: String(r.Status || "NEW"),
        priority: String(r.TicketPriority || ""),
        assignedTo: String(r.AssignedTo || ""),
        resolutionNote: String(r.ResolutionNote || ""),
        submittedIp: String(r.SubmittedIP || ""),
        submittedAt: String(r.SubmittedAt || r.CREATEDTIME || ""),
        updatedAt: String(r.UpdatedAt || ""),
      }))
      .filter((t) => t.reference);

    // Single-ticket detail: the full record plus its event trail.
    if (wanted) {
      const one = tickets.find((t) => t.reference === wanted);
      if (!one) {
        return NextResponse.json({ success: false, error: "No such ticket." }, { status: 404 });
      }
      const events = (await getAllRows(EVENT_TABLE))
        .map((r) => unwrap(r, EVENT_TABLE))
        .filter((r) => String(r.TicketID || "") === wanted)
        .map((r) => ({
          id: String(r.EventID || r.ROWID || ""),
          action: String(r.Action || ""),
          actor: String(r.Actor || ""),
          note: String(r.Note || ""),
          at: String(r.At || r.CREATEDTIME || ""),
        }))
        .sort((a, b) => a.at.localeCompare(b.at));

      return NextResponse.json({ success: true, configured: true, ticket: one, events });
    }

    if (TICKET_TYPES.includes(typeFilter as any)) {
      tickets = tickets.filter((t) => t.type === typeFilter);
    }
    if (STATUSES.includes(statusFilter as any)) {
      tickets = tickets.filter((t) => t.status === statusFilter);
    }

    tickets.sort((a, b) => b.ticketId - a.ticketId);

    const counts = { NEW: 0, TRIAGED: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, REJECTED: 0 } as Record<
      string,
      number
    >;
    for (const t of tickets) if (t.status in counts) counts[t.status] += 1;

    return NextResponse.json({ success: true, configured: true, tickets, counts });
  } catch (err: any) {
    console.error("[support/tickets] list failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not load the ticket queue." },
      { status: 500 }
    );
  }
}

/**
 * Triage a ticket: status, priority, assignee, resolution note.
 *
 * Gated by `denyWrite(..., "operational")` — the O.R.C.A Demonstration account
 * can read the queue and cannot change it. Hiding the buttons is not the
 * control; this is.
 *
 * Every change also writes a SupportTicketEvent, so the history is appended
 * rather than overwritten: "who moved this to RESOLVED, and when" survives the
 * next edit.
 */
export async function PATCH(req: NextRequest) {
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
    return NextResponse.json(
      { success: false, error: "Ticket store is not configured." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  const reference = normaliseReference(String(body.reference || ""));
  if (!reference) {
    return NextResponse.json({ success: false, error: "A ticket reference is required." }, { status: 400 });
  }

  const status = String(body.status ?? "").toUpperCase();
  const priority = String(body.priority ?? "").toUpperCase();
  const assignedTo = String(body.assignedTo ?? "").trim().slice(0, LIMITS.assignedTo);
  const resolutionNote = String(body.resolutionNote ?? "").trim().slice(0, LIMITS.resolutionNote);

  if (status && !STATUSES.includes(status as any)) {
    return NextResponse.json({ success: false, error: "Unknown status." }, { status: 400 });
  }
  if (priority && !PRIORITIES.includes(priority as any)) {
    return NextResponse.json({ success: false, error: "Unknown priority." }, { status: 400 });
  }

  // Closing a ticket without saying why leaves the reporter — who can read the
  // note on the public lookup page — with a dead end.
  if ((status === "RESOLVED" || status === "REJECTED") && !resolutionNote) {
    return NextResponse.json(
      { success: false, error: "A resolution note is required to resolve or reject a ticket." },
      { status: 400 }
    );
  }

  try {
    const raw = await getAllRows(TABLE);
    const row = raw.map((r) => unwrap(r, TABLE)).find((r) => String(r.Reference || "") === reference);
    if (!row || !row.ROWID) {
      return NextResponse.json({ success: false, error: "No such ticket." }, { status: 404 });
    }

    const now = catalystNow();
    const patch: Record<string, any> = { ROWID: String(row.ROWID), UpdatedAt: now };
    const changes: string[] = [];

    if (status && status !== String(row.Status || "")) {
      patch.Status = status;
      changes.push(`status → ${status}`);
    }
    if (body.priority !== undefined && priority !== String(row.TicketPriority || "")) {
      patch.TicketPriority = priority;
      changes.push(`priority → ${priority || "none"}`);
    }
    if (body.assignedTo !== undefined && assignedTo !== String(row.AssignedTo || "")) {
      patch.AssignedTo = assignedTo;
      changes.push(`assigned → ${assignedTo || "unassigned"}`);
    }
    if (body.resolutionNote !== undefined && resolutionNote !== String(row.ResolutionNote || "")) {
      patch.ResolutionNote = resolutionNote;
      changes.push("resolution note updated");
    }

    if (!changes.length) {
      return NextResponse.json({ success: true, reference, unchanged: true });
    }

    await updateRows(TABLE, [patch]);

    const eventId = await nextId(EVENT_TABLE, "EventID");
    await insertRows(EVENT_TABLE, [
      {
        EventID: eventId,
        TicketID: reference,
        Action: status || "UPDATED",
        Actor: `${officer.name} (${officer.email})`,
        Note: changes.join("; "),
        At: now,
      },
    ]);

    return NextResponse.json({ success: true, reference, changes, updatedAt: now });
  } catch (err: any) {
    console.error("[support/tickets] update failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not update the ticket." },
      { status: 500 }
    );
  }
}
