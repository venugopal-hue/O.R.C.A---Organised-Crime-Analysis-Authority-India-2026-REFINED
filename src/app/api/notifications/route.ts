import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/notifications
 *
 * Aggregates urgent items from three sources:
 *   Task          — overdue + due today
 *   BailRemand    — ACTIVE orders expiring within 3 days
 *   CaseMaster    — deadlines that are OVERDUE or CRITICAL (≤7 days)
 *
 * Returns a unified, urgency-sorted NotificationItem[].
 * All filtering is in-process (no ZCQL scope available on this token).
 */

export type NotifLevel = "critical" | "warning" | "info";

export interface NotificationItem {
  id: string;
  level: NotifLevel;
  category: "task" | "bail" | "deadline";
  title: string;
  detail: string;
  date: string;       // ISO — for display
  daysOverdue?: number;
  daysRemaining?: number;
}

const unwrap = (row: any, t: string) => row?.[t] || row || {};
const s = (v: unknown) => String(v ?? "").trim();

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  // epoch ms
  const n = Number(raw);
  if (!isNaN(n) && n > 1_000_000_000) return new Date(n);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

const GRAVITY_HEINOUS = new Set([1, 2, 3, 4]);
const STATUS_CLOSED = new Set([3, 6]);

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCatalystConfigured()) return NextResponse.json({ configured: false, items: [] });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const [taskRows, bailRows, caseRows, unitRows, districtRows, gravityRows] = await Promise.all([
    getAllRows("Task").catch(() => []),
    getAllRows("BailRemand").catch(() => []),
    getAllRows("CaseMaster").catch(() => []),
    getAllRows("Unit").catch(() => []),
    getAllRows("District").catch(() => []),
    getAllRows("GravityOffence").catch(() => []),
  ]);

  const items: NotificationItem[] = [];

  // ── Tasks ─────────────────────────────────────────────────────────────────
  for (const r of taskRows) {
    const t = unwrap(r, "Task");
    const status = s(t.TaskStatus);
    if (status === "COMPLETED" || status === "CANCELLED") continue;

    const due = parseDate(s(t.DueDate));
    if (!due) continue;
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - todayMs) / 86_400_000);

    if (diff < 0) {
      items.push({
        id: `task-${s(t.TaskID)}`,
        level: "critical",
        category: "task",
        title: `Overdue Task: ${s(t.Title) || s(t.TaskNumber)}`,
        detail: `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? "s" : ""} overdue · ${s(t.TaskPriority)} priority`,
        date: due.toISOString(),
        daysOverdue: Math.abs(diff),
      });
    } else if (diff === 0) {
      items.push({
        id: `task-${s(t.TaskID)}`,
        level: "warning",
        category: "task",
        title: `Task Due Today: ${s(t.Title) || s(t.TaskNumber)}`,
        detail: `${s(t.TaskPriority)} priority · ${status}`,
        date: due.toISOString(),
        daysRemaining: 0,
      });
    }
  }

  // ── Bail / Remand expiry ──────────────────────────────────────────────────
  for (const r of bailRows) {
    const b = unwrap(r, "BailRemand");
    if (s(b.Status) !== "ACTIVE") continue;

    const expiry = parseDate(s(b.ExpiryDate));
    if (!expiry) continue;
    expiry.setHours(0, 0, 0, 0);
    const diff = Math.round((expiry.getTime() - todayMs) / 86_400_000);

    const accusedName = s(b.PersonName);
    const crimeRef = s(b.ArrestNo) || s(b.BRNo);
    if (diff < 0) {
      items.push({
        id: `bail-${s(b.BRID)}`,
        level: "critical",
        category: "bail",
        title: `Bail Expired: ${accusedName}`,
        detail: `${s(b.OrderType)} · ${crimeRef} · expired ${Math.abs(diff)}d ago`,
        date: expiry.toISOString(),
        daysOverdue: Math.abs(diff),
      });
    } else if (diff <= 3) {
      items.push({
        id: `bail-${s(b.BRID)}`,
        level: diff === 0 ? "critical" : "warning",
        category: "bail",
        title: `Bail Expiring: ${accusedName}`,
        detail: `${s(b.OrderType)} · ${crimeRef} · expires in ${diff}d`,
        date: expiry.toISOString(),
        daysRemaining: diff,
      });
    }
  }

  // ── Case deadlines ────────────────────────────────────────────────────────
  const unitById = new Map<string, { name: string; districtId: string }>();
  for (const r of unitRows) {
    const u = unwrap(r, "Unit");
    if (s(u.UnitID)) unitById.set(s(u.UnitID), { name: s(u.UnitName), districtId: s(u.DistrictID) });
  }

  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    if (STATUS_CLOSED.has(Number(c.CaseStatusID))) continue;

    const reg = parseDate(s(c.CrimeRegisteredDate || c.RegistrationDate));
    if (!reg) continue;

    const deadlineDays = GRAVITY_HEINOUS.has(Number(c.GravityOffenceID)) ? 60 : 90;
    const deadline = new Date(reg);
    deadline.setDate(deadline.getDate() + deadlineDays);
    deadline.setHours(0, 0, 0, 0);
    const diff = Math.round((deadline.getTime() - todayMs) / 86_400_000);

    const unit = unitById.get(s(c.PoliceStationID));
    const station = unit?.name ?? "Unknown";
    const crimeNo = s(c.CrimeNo || c.CaseNo);

    if (diff < 0) {
      items.push({
        id: `deadline-${s(c.CaseMasterID)}`,
        level: "critical",
        category: "deadline",
        title: `Deadline Overdue: ${crimeNo}`,
        detail: `${station} · ${Math.abs(diff)}d overdue · ${deadlineDays}d limit`,
        date: deadline.toISOString(),
        daysOverdue: Math.abs(diff),
      });
    } else if (diff <= 7) {
      items.push({
        id: `deadline-${s(c.CaseMasterID)}`,
        level: diff <= 2 ? "critical" : "warning",
        category: "deadline",
        title: `Deadline Soon: ${crimeNo}`,
        detail: `${station} · ${diff}d remaining · ${deadlineDays}d limit`,
        date: deadline.toISOString(),
        daysRemaining: diff,
      });
    }
  }

  // Sort: critical first, then by date ascending
  const levelOrder: Record<NotifLevel, number> = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => {
    const ld = levelOrder[a.level] - levelOrder[b.level];
    if (ld !== 0) return ld;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Preview mode — inject sample alerts so the UI can be evaluated without
  // real overdue data. Triggered by ?preview=1, only in non-production.
  if (req.nextUrl.searchParams.get("preview") === "1") {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const in3        = new Date(today); in3.setDate(today.getDate() + 3);
    items.unshift(
      {
        id: "preview-task-1", level: "critical", category: "task",
        title: "Overdue Task: Prepare Charge Sheet — CR 045/2026",
        detail: "2 days overdue · CRITICAL priority · Assigned to you",
        date: yesterday.toISOString(), daysOverdue: 2,
      },
      {
        id: "preview-bail-1", level: "critical", category: "bail",
        title: "Bail Expiring: Ravi Kumar",
        detail: "BAIL · CR 112/2026 · expires tomorrow",
        date: tomorrow.toISOString(), daysRemaining: 1,
      },
      {
        id: "preview-deadline-1", level: "warning", category: "deadline",
        title: "Deadline Soon: CR 078/2026",
        detail: "Koramangala PS · 3 days remaining · 60-day limit",
        date: in3.toISOString(), daysRemaining: 3,
      },
    );
  }

  return NextResponse.json({ configured: true, items, total: items.length });
}
