import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/case/timeline?caseId=<CaseMasterID>
 *
 * Returns a chronologically sorted event array for one case.
 * Sources: CaseMaster, Task, TaskAuditLog, VerifiedDocument, ActSectionAssociation.
 *
 * Event shape:
 *   { id, date, kind, title, detail, meta }
 *
 * kinds: registration | incident_window | section_added | task_created |
 *        task_status | task_completed | document_verified
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const str = (v: any): string => (v != null ? String(v).trim() : "");

function parseDate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "null") return null;
  // Catalyst may return "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", epoch ms string, or ISO
  const d = new Date(isNaN(Number(s)) ? s : Number(s));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const auth = await verifyOfficerRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) {
    return NextResponse.json({ error: "Catalyst not configured", events: [] }, { status: 200 });
  }

  const caseIdParam = req.nextUrl.searchParams.get("caseId");
  if (!caseIdParam) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  // ── Fetch all tables in parallel ─────────────────────────────────────────
  const [caseRows, taskRows, auditRows, docRows, sectionRows, unitRows, districtRows] = await Promise.all([
    getAllRows("CaseMaster"),
    getAllRows("Task"),
    getAllRows("TaskAuditLog"),
    getAllRows("VerifiedDocument"),
    getAllRows("ActSectionAssociation"),
    getAllRows("Unit").catch(() => []),
    getAllRows("District").catch(() => []),
  ]);

  const unitById = new Map<string, { name: string; districtId: string }>();
  for (const r of unitRows) {
    const u = unwrap(r, "Unit");
    if (str(u.UnitID)) unitById.set(str(u.UnitID), { name: str(u.UnitName), districtId: str(u.DistrictID) });
  }
  const districtById = new Map<string, string>();
  for (const r of districtRows) {
    const d = unwrap(r, "District");
    if (str(d.DistrictID)) districtById.set(str(d.DistrictID), str(d.DistrictName));
  }

  // ── Resolve caseId: accept either a numeric CaseMasterID or a crime number string ──
  const allCases = caseRows.map((r) => unwrap(r, "CaseMaster"));
  const q = caseIdParam.trim();
  const numericId = Number(q);
  const caseRow = Number.isFinite(numericId) && numericId > 0
    ? (allCases.find((c) => Number(c.CaseMasterID) === numericId) ??
       allCases.find((c) => str(c.CrimeNo).toLowerCase() === q.toLowerCase()))
    : allCases.find((c) => str(c.CrimeNo).toLowerCase() === q.toLowerCase());

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found", events: [] }, { status: 200 });
  }
  const caseId = Number(caseRow.CaseMasterID);

  // ── Build events ──────────────────────────────────────────────────────────
  type EventKind =
    | "registration"
    | "incident_window"
    | "section_added"
    | "task_created"
    | "task_status"
    | "task_completed"
    | "document_verified";

  interface TimelineEvent {
    id: string;
    date: string;
    kind: EventKind;
    title: string;
    detail: string;
    meta?: Record<string, string | number | null>;
  }

  const events: TimelineEvent[] = [];
  let seq = 0;
  const nextId = () => `evt-${++seq}`;

  // 1. Registration event
  const regDate = parseDate(caseRow.CrimeRegisteredDate) ?? parseDate(caseRow.CREATEDTIME);
  if (regDate) {
    events.push({
      id: nextId(),
      date: fmtDate(regDate),
      kind: "registration",
      title: "Case Registered",
      detail: (() => {
        const unit = unitById.get(str(caseRow.PoliceStationID));
        const distId = unit?.districtId ?? "";
        const districtName = districtById.get(distId) ?? "";
        return [
          caseRow.CrimeNo ? `FIR / Crime No: ${caseRow.CrimeNo}` : "",
          districtName ? `District: ${districtName}` : "",
          unit?.name ? `Unit: ${unit.name}` : "",
        ];
      })()
        .filter(Boolean)
        .join(" · "),
      meta: {
        crimeNo: str(caseRow.CrimeNo) || null,
        districtId: caseRow.DistrictID ?? null,
        caseStatusId: caseRow.CaseStatusID ?? null,
      },
    });
  }

  // 2. Incident window — only push if we have at least a start date
  const incidentFrom = parseDate(caseRow.IncidentFromDate);
  const incidentTo = parseDate(caseRow.IncidentToDate);
  if (incidentFrom) {
    const toLabel = incidentTo
      ? ` → ${incidentTo.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      : " (ongoing / end date not recorded)";
    events.push({
      id: nextId(),
      date: fmtDate(incidentFrom),
      kind: "incident_window",
      title: "Offence Period",
      detail: `Incident from ${incidentFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}${toLabel}`,
      meta: { incidentFrom: incidentFrom.toISOString(), incidentTo: incidentTo?.toISOString() ?? null },
    });
  }

  // 3. IPC / Act sections — pinned to registration date (no timestamp on join table)
  const sections = sectionRows
    .map((r) => unwrap(r, "ActSectionAssociation"))
    .filter((s) => Number(s.CaseMasterID) === caseId);

  for (const s of sections) {
    const pinDate = regDate ?? new Date();
    events.push({
      id: nextId(),
      date: fmtDate(pinDate),
      kind: "section_added",
      title: "IPC / Act Section Applied",
      detail: [
        s.SectionID ? `Section: ${s.SectionID}` : "",
        s.ActName ? `Act: ${s.ActName}` : "",
        s.SectionDescription ? s.SectionDescription : "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: { sectionId: str(s.SectionID) || null },
    });
  }

  // 4 & 6. Tasks
  const caseTasks = taskRows
    .map((r) => unwrap(r, "Task"))
    .filter((t) => Number(t.CaseMasterID) === caseId);

  const taskNumberSet = new Set(caseTasks.map((t) => str(t.TaskNumber)));

  for (const t of caseTasks) {
    const created = parseDate(t.CreatedAt) ?? parseDate(t.CREATEDTIME);
    if (created) {
      events.push({
        id: nextId(),
        date: fmtDate(created),
        kind: "task_created",
        title: `Task Created: ${str(t.Title) || str(t.TaskNumber) || "Unnamed task"}`,
        detail: [
          t.DueDate ? `Due: ${new Date(t.DueDate).toLocaleDateString("en-IN")}` : "",
          t.TaskStatus ? `Status: ${t.TaskStatus}` : "",
          t.TaskType ? `Type: ${t.TaskType}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        meta: { taskNumber: str(t.TaskNumber) || null, priority: str(t.TaskPriority) || null },
      });
    }

    const completed = parseDate(t.CompletedAt);
    if (completed) {
      events.push({
        id: nextId(),
        date: fmtDate(completed),
        kind: "task_completed",
        title: `Task Completed: ${str(t.Title) || str(t.TaskNumber) || "Unnamed task"}`,
        detail: str(t.CompletionNotes) || "Marked complete",
        meta: { taskNumber: str(t.TaskNumber) || null },
      });
    }
  }

  // 5. Task audit log (status changes)
  const caseAudits = auditRows
    .map((r) => unwrap(r, "TaskAuditLog"))
    .filter((a) => taskNumberSet.has(str(a.TaskNumber)));

  for (const a of caseAudits) {
    const occurred = parseDate(a.OccurredAt) ?? parseDate(a.CREATEDTIME);
    if (!occurred) continue;
    const action = str(a.AuditAction);
    const prevState = str(a.PreviousState);
    const newState = str(a.NewState);
    if (!action && !prevState && !newState) continue;
    events.push({
      id: nextId(),
      date: fmtDate(occurred),
      kind: "task_status",
      title: `Task Update: ${action || "Status Changed"}`,
      detail: [
        str(a.TaskNumber) ? `Task: ${a.TaskNumber}` : "",
        prevState && newState ? `${prevState} → ${newState}` : newState || prevState,
        str(a.ActorName) ? `by ${a.ActorName}` : "",
        str(a.Remarks) || "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: { taskNumber: str(a.TaskNumber) || null, from: prevState || null, to: newState || null },
    });
  }

  // 7. Verified documents
  const caseDocs = docRows
    .map((r) => unwrap(r, "VerifiedDocument"))
    .filter((d) => Number(d.CaseMasterID) === caseId);

  for (const d of caseDocs) {
    const issued = parseDate(d.IssuedAt) ?? parseDate(d.CREATEDTIME);
    if (!issued) continue;
    events.push({
      id: nextId(),
      date: fmtDate(issued),
      kind: "document_verified",
      title: `Document Verified`,
      detail: [
        str(d.DocumentType) || "Document",
        str(d.VerifiedByName) ? `by ${d.VerifiedByName}` : "",
        str(d.ReferenceNo) ? `Ref: ${d.ReferenceNo}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      meta: { docType: str(d.DocumentType) || null, refNo: str(d.ReferenceNo) || null },
    });
  }

  // ── Sort chronologically ──────────────────────────────────────────────────
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const resolvedUnit = unitById.get(str(caseRow.PoliceStationID));
  const resolvedDistrictName = districtById.get(resolvedUnit?.districtId ?? "") ?? null;

  return NextResponse.json({
    caseId,
    crimeNo: str(caseRow.CrimeNo) || null,
    caseTitle: str(caseRow.CrimeType) || str(caseRow.OffenceType) || resolvedUnit?.name || null,
    districtName: resolvedDistrictName,
    events,
  });
}
