/**
 * FIR Live Analytics — the arithmetic, separated from the fetching.
 *
 * Crime Analytics had no sense of time at all: every figure on it was
 * all-time, so "is this district getting worse" was a question the console
 * could not answer. Everything here exists to make a date range mean
 * something, and then to say useful things inside it.
 *
 * Nothing in this file touches Catalyst or React. It is pure functions over
 * plain values, which is what lets the statutory deadlines and the period
 * comparisons be tested properly rather than eyeballed on a chart.
 *
 * ── ONE RULE RUNS THROUGH ALL OF IT ─────────────────────────────────────────
 *
 * `CaseMaster.CrimeRegisteredDate` is a Catalyst `date`, NOT a datetime. There
 * is no clock reading attached to a registration anywhere in this schema. So
 * every comparison here is a calendar-day comparison on a `YYYY-MM-DD` string,
 * and anything that would need the hour — a diurnal curve, a six-hour surge
 * window — is deliberately absent rather than faked from midnight.
 */

/** Karnataka runs on IST, and so must every "today" on this panel. */
const IST_OFFSET_MINUTES = 330;

const s = (v: unknown) => String(v ?? "").trim();

/** `YYYY-MM-DD` for an instant, as seen in India, whatever the server's clock. */
export function istDate(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** A stored date, normalised. Returns "" when there is nothing usable. */
export function dayOf(value: unknown): string {
  const raw = s(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

const addDays = (day: string, delta: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

/** Whole calendar days between two `YYYY-MM-DD` values. Negative if b < a. */
export function daysBetween(from: string, to: string): number {
  if (!dayOf(from) || !dayOf(to)) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/* ── Ranges ──────────────────────────────────────────────────────────────── */

export type RangeKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "mtd"
  | "prev_month"
  | "ytd"
  | "prev_year"
  | "all"
  | "custom";

export interface DateRange {
  key: RangeKey;
  /** Inclusive `YYYY-MM-DD`, or null for "no lower bound". */
  from: string | null;
  /** Inclusive `YYYY-MM-DD`, or null for "no upper bound". */
  to: string | null;
  label: string;
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "prev_month", label: "Previous month" },
  { key: "ytd", label: "This year" },
  { key: "prev_year", label: "Previous year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const monthEnd = (day: string) => {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * Turn a preset (or a custom pair) into concrete inclusive bounds.
 *
 * A custom range with its ends the wrong way round is SWAPPED rather than
 * rejected — an officer dragging dates backwards means the span between them,
 * and an empty result would read as "no crime here".
 */
export function resolveRange(
  key: string | null | undefined,
  customFrom?: string | null,
  customTo?: string | null,
  now: Date = new Date()
): DateRange {
  const today = istDate(now);
  const labelOf = (k: RangeKey) => RANGE_OPTIONS.find((o) => o.key === k)?.label || "All time";

  switch (key) {
    case "today":
      return { key: "today", from: today, to: today, label: labelOf("today") };
    case "yesterday": {
      const y = addDays(today, -1);
      return { key: "yesterday", from: y, to: y, label: labelOf("yesterday") };
    }
    case "last7":
      // Inclusive of today, so "last 7 days" is 7 days of data, not 8.
      return { key: "last7", from: addDays(today, -6), to: today, label: labelOf("last7") };
    case "last30":
      return { key: "last30", from: addDays(today, -29), to: today, label: labelOf("last30") };
    case "mtd":
      return { key: "mtd", from: monthStart(today), to: today, label: labelOf("mtd") };
    case "prev_month": {
      const endPrev = addDays(monthStart(today), -1);
      return { key: "prev_month", from: monthStart(endPrev), to: endPrev, label: labelOf("prev_month") };
    }
    case "ytd":
      return { key: "ytd", from: `${today.slice(0, 4)}-01-01`, to: today, label: labelOf("ytd") };
    case "prev_year": {
      const y = Number(today.slice(0, 4)) - 1;
      return { key: "prev_year", from: `${y}-01-01`, to: `${y}-12-31`, label: labelOf("prev_year") };
    }
    case "custom": {
      let from = dayOf(customFrom) || null;
      let to = dayOf(customTo) || null;
      if (from && to && from > to) [from, to] = [to, from];
      return {
        key: "custom",
        from,
        to,
        label: from || to ? `${from || "any"} to ${to || "any"}` : labelOf("all"),
      };
    }
    default:
      return { key: "all", from: null, to: null, label: labelOf("all") };
  }
}

/**
 * The comparable span immediately before this one, for period-on-period.
 *
 * Calendar months and years step back by calendar, not by day count — comparing
 * February against "the 28 days before it" would answer a different question
 * from the one on screen. Everything else steps back by its own length.
 */
export function previousRange(range: DateRange): DateRange | null {
  if (!range.from || !range.to) return null;

  if (range.key === "mtd" || range.key === "prev_month") {
    const prevEnd = addDays(monthStart(range.from), -1);
    const prevStart = monthStart(prevEnd);
    // MTD compares like for like: the same number of days into the prior month.
    const daysIn = daysBetween(range.from, range.to);
    const to = range.key === "mtd" ? addDays(prevStart, daysIn) : prevEnd;
    return { key: "custom", from: prevStart, to: to > prevEnd ? prevEnd : to, label: "Previous period" };
  }

  if (range.key === "ytd" || range.key === "prev_year") {
    const y = Number(range.from.slice(0, 4)) - 1;
    const daysIn = daysBetween(range.from, range.to);
    const start = `${y}-01-01`;
    return {
      key: "custom",
      from: start,
      to: range.key === "ytd" ? addDays(start, daysIn) : `${y}-12-31`,
      label: "Previous period",
    };
  }

  const span = daysBetween(range.from, range.to);
  const to = addDays(range.from, -1);
  return { key: "custom", from: addDays(to, -span), to, label: "Previous period" };
}

/**
 * Is this case's day inside the window?
 *
 * A case with no usable date cannot be placed in a bounded window, so it is
 * excluded from one — putting it in "last 7 days" would be a guess.
 *
 * But it is INCLUDED when there are no bounds at all. Excluding it there would
 * drop a real registered case out of the all-time total, which is the quiet
 * kind of wrong: the register would hold a case the analytics never counted,
 * and nothing on screen would say so.
 */
export const inRange = (day: string, range: DateRange): boolean => {
  if (!range.from && !range.to) return true;
  if (!day) return false;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
};

/* ── Investigation ageing ────────────────────────────────────────────────── */

export interface AgeBucket {
  id: string;
  label: string;
  min: number;
  /** Inclusive upper bound; null means open-ended. */
  max: number | null;
  note: string;
}

/**
 * Buckets chosen around the statutory clock, not round numbers.
 *
 * 60 and 90 days are the BNSS s.187(3) default-bail thresholds, so those are
 * the edges that actually change what a supervisor has to do.
 */
export const AGE_BUCKETS: AgeBucket[] = [
  { id: "0-15", label: "0–15 days", min: 0, max: 15, note: "Initial stage — scene, seizure, forensic dispatch." },
  { id: "16-60", label: "16–60 days", min: 16, max: 60, note: "Within the ordinary statutory window." },
  { id: "61-90", label: "61–90 days", min: 61, max: 90, note: "Approaching the 90-day default-bail threshold." },
  { id: "91-180", label: "91–180 days", min: 91, max: 180, note: "Past the statutory window — supervisory attention." },
  { id: "180+", label: "Over 180 days", min: 181, max: null, note: "Chronic pendency." },
];

export function ageBucketOf(days: number): AgeBucket {
  const d = Math.max(0, days);
  return AGE_BUCKETS.find((b) => d >= b.min && (b.max === null || d <= b.max)) || AGE_BUCKETS[AGE_BUCKETS.length - 1];
}

/** BNSS s.187(3): 90 days for the gravest offences, 60 for the rest. */
export const OVERDUE_DAYS_HEINOUS = 90;
export const OVERDUE_DAYS_GENERAL = 60;

/**
 * Is this open case past its investigation window?
 *
 * `heinous` stands in for the statutory test, which is really the punishment
 * the offence carries — this schema records gravity, not sentence exposure. It
 * is the closest available proxy and the UI says so; it is NOT a legal finding
 * that default bail is due.
 */
export function isOverdue(daysOpen: number, heinous: boolean): boolean {
  return daysOpen > (heinous ? OVERDUE_DAYS_HEINOUS : OVERDUE_DAYS_GENERAL);
}

/* ── Comparison ──────────────────────────────────────────────────────────── */

export interface Delta {
  /** Percentage change, or null when it cannot be expressed as one. */
  value: number | null;
  label: string;
  direction: "up" | "down" | "flat";
}

/**
 * Period-on-period change.
 *
 * Growth from zero is not a percentage — it is new activity, and printing
 * "+100%" or "+∞%" next to it invites a reader to treat one case as a trend.
 * It is labelled in words instead.
 */
export function deltaPct(current: number, previous: number): Delta {
  if (previous === 0 && current === 0) return { value: 0, label: "No change", direction: "flat" };
  if (previous === 0) return { value: null, label: "New activity", direction: "up" };
  if (current === 0) return { value: -100, label: "-100%", direction: "down" };

  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return {
    value: rounded,
    label: `${rounded > 0 ? "+" : ""}${rounded}%`,
    direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
  };
}

/* ── Trend bucketing ─────────────────────────────────────────────────────── */

export type Granularity = "day" | "week" | "month";

/**
 * A day-by-day line over three years is noise with a shape. The bucket widens
 * with the span so the chart keeps roughly 10–90 points whatever is selected.
 */
export function granularityFor(range: DateRange, fallbackSpanDays = 90): Granularity {
  const span = range.from && range.to ? daysBetween(range.from, range.to) : fallbackSpanDays;
  if (span <= 62) return "day";
  if (span <= 730) return "week";
  return "month";
}

/** ISO week start (Monday), so weekly buckets line up with the working week. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

export function bucketOf(day: string, granularity: Granularity): string {
  if (!dayOf(day)) return "";
  if (granularity === "day") return day;
  if (granularity === "week") return weekStart(day);
  return `${day.slice(0, 7)}-01`;
}

/**
 * Every bucket across the range, including the empty ones.
 *
 * A trend line drawn only through days that had cases silently closes the gaps
 * and turns a quiet fortnight into a straight line between two peaks. Zeroes
 * have to be present for the shape to be true.
 */
export function bucketSeries(range: DateRange, granularity: Granularity): string[] {
  if (!range.from || !range.to) return [];
  const out: string[] = [];
  let cursor = bucketOf(range.from, granularity);
  const last = bucketOf(range.to, granularity);
  let guard = 0;

  while (cursor <= last && guard++ < 2000) {
    out.push(cursor);
    if (granularity === "day") cursor = addDays(cursor, 1);
    else if (granularity === "week") cursor = addDays(cursor, 7);
    else {
      const [y, m] = cursor.split("-").map(Number);
      cursor = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString().slice(0, 10);
    }
  }
  return out;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 0 = Monday. */
export function dayOfWeekIndex(day: string): number {
  if (!dayOf(day)) return 0;
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/* ── Shared shaping ──────────────────────────────────────────────────────── */

export interface Slice {
  label: string;
  count: number;
  /** Share of the total, 0–100, one decimal. */
  share: number;
}

/**
 * Count by key, largest first, with percentage shares.
 *
 * `total` is passed in rather than summed from the slices: a case with no
 * crime head still belongs in the denominator, or every share on screen is
 * quietly inflated.
 */
export function toSlices(counts: Map<string, number>, total: number): Slice[] {
  const denom = total > 0 ? total : 1;
  return [...counts]
    .map(([label, count]) => ({
      label,
      count,
      share: Math.round((count / denom) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Mean, rounded to one decimal. Null for an empty set — never 0. */
export function mean(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/** Percentage, rounded to one decimal. Null when the denominator is zero. */
export function ratePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}
