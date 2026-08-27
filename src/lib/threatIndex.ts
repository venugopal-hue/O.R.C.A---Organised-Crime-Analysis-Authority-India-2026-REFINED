/**
 * O.R.C.A — district Threat Index.
 *
 * The screen used to print "9.4 Critical" next to Bengaluru. That number came
 * from nowhere: it was a literal in the component, with no definition, no
 * inputs and no way for an officer to check it. A score on a police console
 * that cannot be audited is worse than no score, because it looks like a
 * finding.
 *
 * This replaces it with something reproducible. Every input is a column that
 * exists in `CaseMaster`, the weights are stated here, and the API returns the
 * three components alongside the score so the UI can show exactly how it was
 * reached.
 *
 * ── The formula ──────────────────────────────────────────────────────────────
 *
 *   index = 10 x ( 0.50 x heinousShare
 *                + 0.30 x unresolvedShare
 *                + 0.20 x volumeRatio )
 *
 *   heinousShare      cases with GravityOffenceID 1 (Heinous) / all cases in
 *                     the district. Severity of what is being reported.
 *   unresolvedShare   cases NOT at CaseStatusID 3 (Closed) / all cases.
 *                     Investigative load still open.
 *   volumeRatio       this district's case count / the highest district's
 *                     count. Relative rather than absolute, so the scale does
 *                     not drift as the database grows.
 *
 * Weights favour severity over volume deliberately: a district with a handful
 * of heinous cases warrants more attention than one with many minor ones.
 *
 * ── What it is NOT ───────────────────────────────────────────────────────────
 *
 * It is a workload and severity indicator drawn from registered cases. It is
 * not a crime rate (no population data), not a prediction, and not a measure
 * of any officer's performance. It says nothing about districts where crime
 * goes unreported.
 *
 * ── Small samples ────────────────────────────────────────────────────────────
 *
 * With very few cases the shares swing wildly - the first heinous case ever
 * registered in a district would score it 100% heinous and light the row red.
 * Below MIN_CASES_FOR_CONFIDENCE the score is flagged `provisional` so the UI
 * can mark it rather than presenting a number that precise-looking and
 * meaningless.
 */

/** GravityOffence.GravityOffenceID for "Heinous". */
export const GRAVITY_HEINOUS = 1;

/** CaseStatusMaster.CaseStatusID values. */
export const STATUS_UNDER_INVESTIGATION = 1;
export const STATUS_CHARGE_SHEETED = 2;
export const STATUS_CLOSED = 3;

export const WEIGHTS = { heinous: 0.5, unresolved: 0.3, volume: 0.2 } as const;

/** Below this many cases, the shares are too volatile to present as settled. */
export const MIN_CASES_FOR_CONFIDENCE = 5;

export interface ThreatComponents {
  heinousShare: number;
  unresolvedShare: number;
  volumeRatio: number;
}

export interface ThreatScore {
  /** 0-10, one decimal place. Null when the district has no cases at all. */
  score: number | null;
  band: "None" | "Moderate" | "Elevated" | "Critical";
  /** True when too few cases back the score for it to be treated as settled. */
  provisional: boolean;
  components: ThreatComponents;
}

export function bandFor(score: number | null): ThreatScore["band"] {
  if (score === null) return "None";
  if (score >= 7) return "Critical";
  if (score >= 4.5) return "Elevated";
  return "Moderate";
}

/**
 * Score one district.
 *
 * `maxDistrictTotal` is the highest case count across all districts in the
 * same result set, which is what makes `volumeRatio` relative.
 */
export function threatIndex(
  counts: { total: number; heinous: number; closed: number },
  maxDistrictTotal: number
): ThreatScore {
  const empty: ThreatComponents = { heinousShare: 0, unresolvedShare: 0, volumeRatio: 0 };

  // No cases is not a score of zero - zero would read as "assessed, and calm".
  // It means nothing has been registered here, which the UI states plainly.
  if (!counts.total) {
    return { score: null, band: "None", provisional: false, components: empty };
  }

  const components: ThreatComponents = {
    heinousShare: counts.heinous / counts.total,
    unresolvedShare: (counts.total - counts.closed) / counts.total,
    volumeRatio: maxDistrictTotal > 0 ? counts.total / maxDistrictTotal : 0,
  };

  const raw =
    10 *
    (WEIGHTS.heinous * components.heinousShare +
      WEIGHTS.unresolved * components.unresolvedShare +
      WEIGHTS.volume * components.volumeRatio);

  const score = Math.round(raw * 10) / 10;

  return {
    score,
    band: bandFor(score),
    provisional: counts.total < MIN_CASES_FOR_CONFIDENCE,
    components,
  };
}

/** One-line explanation of a score, for a tooltip. */
export function explainThreat(t: ThreatScore, counts: { total: number }): string {
  if (t.score === null) return "No cases registered in this district.";
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    `${t.score}/10 from ${counts.total} case${counts.total === 1 ? "" : "s"}: ` +
    `${pct(t.components.heinousShare)} heinous (weight ${WEIGHTS.heinous}), ` +
    `${pct(t.components.unresolvedShare)} not closed (weight ${WEIGHTS.unresolved}), ` +
    `${pct(t.components.volumeRatio)} of the busiest district's volume (weight ${WEIGHTS.volume})` +
    (t.provisional
      ? ` — provisional: fewer than ${MIN_CASES_FOR_CONFIDENCE} cases, so the shares are volatile.`
      : ".")
  );
}
