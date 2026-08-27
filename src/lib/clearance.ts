/**
 * O.R.C.A — ISD clearance, derived from the ER diagram's rank hierarchy.
 *
 * Why this file exists
 * --------------------
 * Clearance used to be a free-typed string on each profile, and it drifted:
 * across seven real officer records it was written as ISD-LEVEL-I, ISD-LEVEL-1,
 * ISD-LEVEL-3, ISD-LEVEL-IV, ISD-LEVEL-2 and ISD-LEVEL-4 — roman and arabic
 * mixed. Code then compared those strings literally, so a gate that meant
 * "Level II and above" had to list arabic spellings as well, and in doing so let
 * ISD-LEVEL-4 (the LOWEST clearance) through. See the dashboard telemetry gate.
 *
 * The ER diagram already carries an authoritative ordering:
 *
 *     Rank.Hierarchy  INT   "Rank hierarchy level number (lower = higher rank)"
 *
 * populated 1..11 for DGP..Constable. Clearance is therefore DERIVED from rank
 * rather than stored by hand — one source of truth, no drift possible, and it
 * matches the labels the admin console already shows.
 *
 * Comparisons must go through `meetsClearance`, never `===` or `.includes()` on
 * an array of spellings.
 */

export const CLEARANCE_LEVELS = [
  "ISD-LEVEL-I",
  "ISD-LEVEL-II",
  "ISD-LEVEL-III",
  "ISD-LEVEL-IV",
] as const;

/**
 * The ORCA track — engineering and IT staff.
 *
 * A SEPARATE scale, deliberately. ISD clearance is a statement about vetting
 * and authority over criminal intelligence; an engineer's access is authority
 * over the SYSTEM. Putting both on one scale meant the development team held
 * ISD-LEVEL-I — Director General clearance — and no audit could tell a DGP
 * from a developer.
 *
 * They are never ranked against each other. What ORCA levels DO get is an
 * explicit grant (see ISD_EQUIVALENT below) so that full-access staff can pass
 * ISD-gated screens — stated in one place as a deliberate decision, rather than
 * happening by accident of string comparison.
 */
export const ORCA_LEVELS = [
  "ORCA-LEVEL-I",
  "ORCA-LEVEL-II",
  "ORCA-LEVEL-III",
  "ORCA-LEVEL-IV",
] as const;

/**
 * The CRB track — the State Crime Records Bureau.
 *
 * A third scale, and a SINGLE level, because SCRB is a posting rather than a
 * hierarchy: an officer either works in the records bureau or does not, and
 * there is no chain of command inside it that this platform needs to express.
 *
 * It is separate from ISD for the same reason ORCA is. SCRB authority is over
 * the state's crime RECORDS — statewide analytics, audit trails, AI oversight —
 * which is not the same thing as command authority over an investigation. The
 * role used to be `admin_scrb` at ISD-LEVEL-II, which said "this person has a
 * Superintendent's clearance"; that was never what the posting meant.
 *
 * Unlike every other track, this one is reachable by SELF-REGISTRATION: an
 * applicant declares an SCRB posting on the sign-up form and an administrator
 * approves it. That is what makes the write limits below load-bearing rather
 * than cosmetic — see the note on EXECUTIVE_ROLES in the approval routes.
 */
export const CRB_LEVELS = ["CRB-LEVEL-I"] as const;

export const ALL_CLEARANCE_LEVELS = [
  ...CLEARANCE_LEVELS,
  ...ORCA_LEVELS,
  ...CRB_LEVELS,
] as const;

export type IsdClearanceLevel = (typeof CLEARANCE_LEVELS)[number];
export type OrcaClearanceLevel = (typeof ORCA_LEVELS)[number];
export type CrbClearanceLevel = (typeof CRB_LEVELS)[number];
export type ClearanceLevel = IsdClearanceLevel | OrcaClearanceLevel | CrbClearanceLevel;

export type ClearanceTrack = "ISD" | "ORCA" | "CRB";

/** Which scale a level belongs to. Null for anything unrecognised. */
export function trackOf(level: unknown): ClearanceTrack | null {
  const s = String(level ?? "").trim().toUpperCase();
  if ((CLEARANCE_LEVELS as readonly string[]).includes(s)) return "ISD";
  if ((ORCA_LEVELS as readonly string[]).includes(s)) return "ORCA";
  if ((CRB_LEVELS as readonly string[]).includes(s)) return "CRB";
  return null;
}

/**
 * The ISD level an ORCA level is allowed to satisfy.
 *
 * All four map to ISD-LEVEL-I because every ORCA role is granted sight of the
 * whole platform — that is what the roles are for. The difference between them
 * is what they may WRITE, which is a separate check (see writeAccessOf in
 * rbac.ts). Read access and write access are not the same permission and must
 * not be inferred from one another.
 */
const ISD_EQUIVALENT: Record<OrcaClearanceLevel, IsdClearanceLevel> = {
  "ORCA-LEVEL-I": "ISD-LEVEL-I",
  "ORCA-LEVEL-II": "ISD-LEVEL-I",
  "ORCA-LEVEL-III": "ISD-LEVEL-I",
  "ORCA-LEVEL-IV": "ISD-LEVEL-I",
};

/**
 * The ISD level a CRB level is allowed to satisfy.
 *
 * ISD-LEVEL-II, chosen so that the SCRB role keeps EXACTLY the reach it had as
 * `admin_scrb` — statewide analytics, audit and AI oversight were already
 * gated at Superintendent clearance, and nothing about moving SCRB onto its own
 * track was meant to widen or narrow which screens it reaches.
 *
 * The equivalence is one-directional and read-only in effect: it decides what
 * an SCRB officer may SEE. What they may CHANGE is `writeAccess: "operational"`
 * on the role, which is a separate check and deliberately stricter than the old
 * `admin_scrb` "full" — because this role can now be applied for.
 */
const CRB_EQUIVALENT: Record<CrbClearanceLevel, IsdClearanceLevel> = {
  "CRB-LEVEL-I": "ISD-LEVEL-II",
};

/** Lower number = higher authority, matching the ER's Hierarchy convention. */
const ORDER: Record<ClearanceLevel, number> = {
  "ISD-LEVEL-I": 1,
  "ISD-LEVEL-II": 2,
  "ISD-LEVEL-III": 3,
  "ISD-LEVEL-IV": 4,
  // Ordered within their own track only; never compared across tracks.
  "ORCA-LEVEL-I": 1,
  "ORCA-LEVEL-II": 2,
  "ORCA-LEVEL-III": 3,
  "ORCA-LEVEL-IV": 4,
  // One level, so the number is never used for a within-track comparison —
  // it exists so the record stays total and a lookup cannot return undefined.
  "CRB-LEVEL-I": 1,
};

const ARABIC_TO_ROMAN: Record<string, string> = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V" };

/**
 * Canonical form of whatever was stored. Accepts the arabic spellings found in
 * live data ("ISD-LEVEL-3") and returns the roman form the app compares on.
 * Returns "" for anything unrecognised — deliberately NOT a default clearance,
 * because silently handing out ISD-LEVEL-IV to an unparseable value is how the
 * telemetry gate broke in the first place.
 */
export function normaliseClearance(raw: unknown): ClearanceLevel | "" {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  // Both tracks. The arabic tolerance exists because live ISD data carried
  // "ISD-LEVEL-3"; ORCA levels have never been written any other way, but the
  // same parser handles them so a future typo behaves identically.
  const m = s.match(/^(ISD|ORCA|CRB)[-\s]?LEVEL[-\s]?([IVX]+|\d)$/);
  if (!m) return "";
  const [, track, part] = m;
  const roman = /^\d$/.test(part) ? ARABIC_TO_ROMAN[part] : part;
  const candidate = `${track}-LEVEL-${roman}`;
  return (ALL_CLEARANCE_LEVELS as readonly string[]).includes(candidate)
    ? (candidate as ClearanceLevel)
    : "";
}

/**
 * Clearance for a rank's ER hierarchy value.
 *
 *   1-2   DGP, ADGP                 -> ISD-LEVEL-I    (Director General / Command)
 *   3-5   IGP, DIGP, SP             -> ISD-LEVEL-II   (Superintendent)
 *   6-8   ASP, DSP, Inspector       -> ISD-LEVEL-III  (Senior Inspector)
 *   9-11  SI, ASI, Constable        -> ISD-LEVEL-IV   (Field Officer)
 *
 * The bands are chosen to match the labels the admin console already displays
 * against each level, so nothing in the UI has to change meaning.
 */
export function clearanceForHierarchy(hierarchy: unknown): ClearanceLevel | "" {
  const h = Number(hierarchy);
  if (!Number.isFinite(h) || h < 1) return "";
  if (h <= 2) return "ISD-LEVEL-I";
  if (h <= 5) return "ISD-LEVEL-II";
  if (h <= 8) return "ISD-LEVEL-III";
  return "ISD-LEVEL-IV";
}

/** Human label, matching the wording already used in the admin console. */
export const CLEARANCE_LABEL: Record<ClearanceLevel, string> = {
  "ISD-LEVEL-I": "Director General / Command Clearance",
  "ISD-LEVEL-II": "Superintendent Clearance",
  "ISD-LEVEL-III": "Senior Inspector Clearance",
  "ISD-LEVEL-IV": "Field Officer Clearance",
  "ORCA-LEVEL-I": "O.R.C.A Owner",
  "ORCA-LEVEL-II": "O.R.C.A Engineer",
  "ORCA-LEVEL-III": "O.R.C.A Support",
  "ORCA-LEVEL-IV": "O.R.C.A Demonstration",
  "CRB-LEVEL-I": "State Crime Records Bureau Clearance",
};

/**
 * Does `actual` meet or exceed `minimum`?
 *
 * Unrecognised or absent clearance FAILS the check. Access control must not
 * fall open.
 */
export function meetsClearance(actual: unknown, minimum: ClearanceLevel): boolean {
  const a = normaliseClearance(actual);
  if (!a) return false;

  const held = trackOf(a);
  const wanted = trackOf(minimum);
  if (!held || !wanted) return false;

  // Same track: ordinary comparison.
  if (held === wanted) return ORDER[a] <= ORDER[minimum];

  /**
   * Cross-track. An ORCA level satisfies an ISD gate through the explicit
   * ISD_EQUIVALENT grant above — engineering staff are meant to see the whole
   * platform. The reverse is NEVER true: an ISD clearance, however senior,
   * says nothing about authority over the system, so a DGP does not become an
   * O.R.C.A Owner by being a DGP.
   */
  if (held === "ORCA" && wanted === "ISD") {
    const equivalent = ISD_EQUIVALENT[a as OrcaClearanceLevel];
    return ORDER[equivalent] <= ORDER[minimum];
  }

  /**
   * CRB satisfies an ISD gate through CRB_EQUIVALENT, on the same terms: it
   * says what an SCRB officer may see, not that they hold police command
   * clearance. The reverse is again never true — a Superintendent is not
   * thereby a records-bureau officer.
   *
   * CRB and ORCA are never comparable in either direction. Neither is a
   * statement about the other, and there is no gate that would need it.
   */
  if (held === "CRB" && wanted === "ISD") {
    const equivalent = CRB_EQUIVALENT[a as CrbClearanceLevel];
    return ORDER[equivalent] <= ORDER[minimum];
  }
  return false;
}
