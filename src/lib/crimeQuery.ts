import { getAllRows } from "@/lib/catalyst";
import type { Scope } from "@/lib/jurisdiction";

/**
 * The crime database, made answerable in words.
 *
 * WHY THIS EXISTS
 *
 * The assistant on the dashboard looked finished and read nothing. Every
 * question went straight to a general-purpose language model with a Karnataka
 * State Police persona attached, and came back in the confident register of a
 * system that had consulted its records. It had not: /api/chat never touched
 * CaseMaster, Accused, Victim or anything else. An officer asking "what is the
 * status of crime number 42/2026" got prose invented from nothing.
 *
 * That is the worst failure mode available to a police console — not a blank
 * screen, but a plausible one.
 *
 * THE SHAPE OF THE FIX
 *
 * The model is not given database access. It is given a menu. It proposes ONE
 * query from a fixed catalogue; this module validates that proposal against a
 * whitelist, executes it deterministically against Catalyst, and hands back
 * rows. The model's remaining job is to put retrieved rows into a sentence.
 *
 * The consequence that matters: CITATIONS ARE PRODUCED HERE, from what was
 * actually read, and are never parsed out of the model's answer. If the model
 * invents an FIR number, the evidence trail beneath it still shows the truth,
 * and `unsupportedReferences` flags the invention rather than letting it pass
 * as a finding.
 *
 * SCOPE IS APPLIED BEFORE THE MODEL SEES ANYTHING
 *
 * Record-level tools filter through the jurisdiction layer first. A case
 * outside the officer's units never enters the prompt, so no amount of clever
 * phrasing can talk it out of the assistant.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ");
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Rows handed to the model. Beyond this an answer stops being an answer. */
export const MAX_ROWS_TO_MODEL = 20;

export type ToolName =
  | "case_lookup"
  | "case_search"
  | "person_search"
  | "criminal_history"
  | "crime_stats"
  | "property_search";

export interface QueryPlan {
  tool: ToolName;
  args: Record<string, any>;
}

export interface Citation {
  /** Catalyst table the fact came from. */
  table: string;
  /** Business identifier, as an officer would quote it. */
  recordId: string;
  label: string;
  detail?: string;
}

export interface RetrievalResult {
  tool: ToolName;
  toolLabel: string;
  args: Record<string, any>;
  /** Rows matching the query, BEFORE truncation for the prompt. */
  matched: number;
  returned: number;
  truncated: boolean;
  /** The block of text handed to the answering model. */
  facts: string;
  citations: Citation[];
  /** How the officer's reach was decided, in plain words. */
  scopeNote: string;
  /** Caveats the officer must see — never only the model. */
  notes: string[];
}

/* ── The catalogue the planner may choose from ───────────────────────────── */

export const TOOL_SPECS: {
  name: ToolName;
  label: string;
  purpose: string;
  args: string;
}[] = [
  {
    name: "case_lookup",
    label: "FIR / case lookup",
    purpose:
      "One specific case, when the officer names a crime number, FIR number or case number.",
    args: 'crimeNo (e.g. "0042/2026") OR caseNo OR caseMasterId',
  },
  {
    name: "case_search",
    label: "Case search",
    purpose:
      "Cases matching filters — district, police station, category, gravity, investigation status, crime head, or a registration date range.",
    args:
      "district, station, category, gravity, status, crimeHead (all matched by name), " +
      "fromDate and toDate (YYYY-MM-DD)",
  },
  {
    name: "person_search",
    label: "Person search",
    purpose:
      "Find a named person across accused, victim and complainant records, and the cases they appear on.",
    args: 'name (required), role ("accused" | "victim" | "complainant" | "any")',
  },
  {
    name: "criminal_history",
    label: "Criminal history",
    purpose:
      "Every case a named accused person appears on, plus the people named alongside them. Use for 'history', 'previous cases', 'repeat offender', 'associates'.",
    args: "name (required)",
  },
  {
    name: "crime_stats",
    label: "Crime statistics",
    purpose:
      "Counts and totals — how many cases, broken down by district, category, gravity, investigation status, police station or month.",
    args:
      'groupBy ("district" | "category" | "gravity" | "status" | "station" | "month"), ' +
      "plus optional district, fromDate, toDate",
  },
  {
    name: "property_search",
    label: "Lost & stolen property",
    purpose:
      "The lost and stolen property register — by reference number, item category, or an identifier such as an IMEI, chassis or serial number.",
    args: 'reference (e.g. "PROP-2026-00001"), category, identifier',
  },
];

/** Rendered into the planning prompt. */
export function toolCatalogue(): string {
  return TOOL_SPECS.map((t) => `- ${t.name}: ${t.purpose}\n  arguments: ${t.args}`).join("\n");
}

const TOOL_NAMES = new Set<string>(TOOL_SPECS.map((t) => t.name));
const labelOf = (n: ToolName) => TOOL_SPECS.find((t) => t.name === n)?.label || n;

/* ── Plan validation ─────────────────────────────────────────────────────── */

/** Arguments the planner may set, per tool. Anything else is dropped. */
const ALLOWED_ARGS: Record<ToolName, string[]> = {
  case_lookup: ["crimeNo", "caseNo", "caseMasterId"],
  case_search: ["district", "station", "category", "gravity", "status", "crimeHead", "fromDate", "toDate"],
  person_search: ["name", "role"],
  criminal_history: ["name"],
  crime_stats: ["groupBy", "district", "fromDate", "toDate"],
  property_search: ["reference", "category", "identifier"],
};

const GROUP_BY = new Set(["district", "category", "gravity", "status", "station", "month"]);
const ROLES = new Set(["accused", "victim", "complainant", "any"]);

/**
 * Accept a plan only if it is one of ours.
 *
 * A model-authored string never reaches a table name, a column or a filter
 * expression — it reaches this whitelist, and stops here if it is not on it.
 */
/**
 * Words that mean the officer asked about a period of time.
 *
 * Deliberately generous. A false positive keeps a date filter the officer
 * probably did ask for; a false negative drops one, which only ever WIDENS the
 * search. Widening cannot hide a record, so that is the safe direction to err.
 */
const TEMPORAL =
  /\b(19|20)\d{2}\b|\b\d{1,2}[\/-]\d{1,2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const TEMPORAL_WORDS =
  /\b(today|yesterday|tomorrow|week|month|year|quarter|recent|recently|last|past|since|until|between|before|after|during|latest|current|ytd|q[1-4])\b/i;

export function validatePlan(raw: any, question?: string): { plan: QueryPlan } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "No plan." };

  const tool = s(raw.tool);
  if (!tool || tool === "none") return { error: "No retrieval needed." };
  if (!TOOL_NAMES.has(tool)) return { error: `Unknown tool "${tool.slice(0, 40)}".` };

  const name = tool as ToolName;
  const incoming = raw.args && typeof raw.args === "object" ? raw.args : {};
  const args: Record<string, any> = {};

  for (const key of ALLOWED_ARGS[name]) {
    const v = s(incoming[key]);
    // The 8B planner likes to fill every field it is shown, often with the
    // placeholder wording from the catalogue. Those are not filters.
    if (!v || v.length > 120) continue;
    if (/^(string|any|null|none|n\/a|unknown|optional|required)$/i.test(v)) continue;
    args[key] = v;
  }

  if (name === "crime_stats") {
    const g = norm(args.groupBy);
    args.groupBy = GROUP_BY.has(g) ? g : "district";
  }
  if (name === "person_search") {
    const r = norm(args.role);
    args.role = ROLES.has(r) ? r : "any";
    if (!s(args.name)) return { error: "person_search needs a name." };
  }
  if (name === "criminal_history" && !s(args.name)) {
    return { error: "criminal_history needs a name." };
  }
  if (name === "case_lookup" && !s(args.crimeNo) && !s(args.caseNo) && !s(args.caseMasterId)) {
    return { error: "case_lookup needs a crime, case or record number." };
  }

  for (const key of ["fromDate", "toDate"]) {
    if (args[key] && !/^\d{4}-\d{2}-\d{2}$/.test(args[key])) delete args[key];
  }

  /*
   * A DATE RANGE NOBODY ASKED FOR IS A SILENT EXCLUSION.
   *
   * Observed in the live planner: "how many cases are registered in each
   * district?" came back as crime_stats with fromDate 2020-01-01 and toDate
   * today. Harmless against an empty table, and wrong the moment there is a
   * case from 2019 — the officer asked no date question and would be handed a
   * total that quietly omits records.
   *
   * Unlike a district filter, which fails loudly when it cannot be resolved, a
   * well-formed date filter applies in silence. So it is dropped unless the
   * question actually mentions a time.
   */
  if (question !== undefined && (args.fromDate || args.toDate)) {
    const q = s(question);
    if (!TEMPORAL.test(q) && !TEMPORAL_WORDS.test(q)) {
      delete args.fromDate;
      delete args.toDate;
    }
  }

  return { plan: { tool: name, args } };
}

/**
 * A crime number in the question is not a guess — it is an instruction.
 *
 * Routing it without consulting the planner makes the commonest question in
 * the building immune to whatever the 8B model does with its JSON that day.
 */
export function directPlan(question: string): QueryPlan | null {
  const q = s(question);

  const prop = q.match(/\bPROP-\d{4}-\d{5}\b/i);
  if (prop) return { tool: "property_search", args: { reference: prop[0].toUpperCase() } };

  // "42/2026", "0042 / 2026", "FIR No. 42/2026"
  const crime = q.match(/\b\d{1,6}\s*\/\s*(?:19|20)\d{2}\b/);
  if (crime) return { tool: "case_lookup", args: { crimeNo: crime[0].replace(/\s+/g, "") } };

  return null;
}

/* ── Reference data ──────────────────────────────────────────────────────── */

interface Refs {
  district: Map<number, string>;
  unit: Map<number, string>;
  unitDistrict: Map<number, number | null>;
  category: Map<number, string>;
  gravity: Map<number, string>;
  status: Map<number, string>;
  head: Map<number, string>;
}

const mapOf = (rows: any[], table: string, id: string, label: string) => {
  const m = new Map<number, string>();
  for (const r of rows) {
    const rec = unwrap(r, table);
    const key = num(rec[id]);
    if (key !== null) m.set(key, s(rec[label]));
  }
  return m;
};

async function loadRefs(): Promise<Refs> {
  const [districts, units, categories, gravities, statuses, heads] = await Promise.all([
    getAllRows("District"),
    getAllRows("Unit"),
    getAllRows("CaseCategory"),
    getAllRows("GravityOffence"),
    getAllRows("CaseStatusMaster"),
    getAllRows("CrimeHead"),
  ]);

  const unitDistrict = new Map<number, number | null>();
  for (const r of units) {
    const rec = unwrap(r, "Unit");
    const id = num(rec.UnitID);
    if (id !== null) unitDistrict.set(id, num(rec.DistrictID));
  }

  return {
    district: mapOf(districts, "District", "DistrictID", "DistrictName"),
    unit: mapOf(units, "Unit", "UnitID", "UnitName"),
    unitDistrict,
    category: mapOf(categories, "CaseCategory", "CaseCategoryID", "LookupValue"),
    gravity: mapOf(gravities, "GravityOffence", "GravityOffenceID", "LookupValue"),
    status: mapOf(statuses, "CaseStatusMaster", "CaseStatusID", "CaseStatusName"),
    head: mapOf(heads, "CrimeHead", "CrimeHeadID", "CrimeGroupName"),
  };
}

/**
 * Resolve a name the officer typed to a reference id.
 *
 * Exact match wins; otherwise a substring, but only when exactly one row
 * matches. Two candidates is not a near miss, it is a different question —
 * silently taking the first would answer about the wrong district.
 */
function resolveRef(
  m: Map<number, string>,
  query: string
): { id: number | null; matched: string | null; candidates: string[] } {
  const q = norm(query);
  if (!q) return { id: null, matched: null, candidates: [] };

  for (const [id, name] of m) {
    if (norm(name) === q) return { id, matched: name, candidates: [] };
  }
  const hits = [...m].filter(([, name]) => {
    const n = norm(name);
    return !!n && (n.includes(q) || q.includes(n));
  });
  if (hits.length === 1) return { id: hits[0][0], matched: hits[0][1], candidates: [] };
  return { id: null, matched: null, candidates: hits.slice(0, 6).map(([, n]) => n) };
}

/* ── Cases ───────────────────────────────────────────────────────────────── */

export interface CaseRecord {
  caseMasterId: string;
  crimeNo: string;
  caseNo: string;
  registeredDate: string;
  stationId: number | null;
  stationName: string;
  districtId: number | null;
  districtName: string;
  categoryName: string;
  gravityName: string;
  statusName: string;
  headName: string;
  incidentFrom: string;
  incidentTo: string;
  briefFacts: string;
}

const dateOnly = (v: unknown) => s(v).slice(0, 10);

/**
 * A READ FAILURE IS NOT AN EMPTY RESULT.
 *
 * Every load in this module deliberately lets its error escape. Catching it
 * and substituting [] would turn a Catalyst outage into "no cases match" — an
 * officer would be told their district is quiet because a token refresh was
 * rate-limited. The route catches this instead and says the records could not
 * be read, which is the only true thing available to say.
 */
async function loadCases(refs: Refs): Promise<CaseRecord[]> {
  const rows = await getAllRows("CaseMaster");
  return rows.map((r) => {
    const c = unwrap(r, "CaseMaster");
    const stationId = num(c.PoliceStationID);
    const districtId = stationId !== null ? refs.unitDistrict.get(stationId) ?? null : null;
    return {
      caseMasterId: s(c.CaseMasterID),
      crimeNo: s(c.CrimeNo),
      caseNo: s(c.CaseNo),
      registeredDate: dateOnly(c.CrimeRegisteredDate),
      stationId,
      stationName: stationId !== null ? refs.unit.get(stationId) || `Unit ${stationId}` : "",
      districtId,
      districtName: districtId !== null ? refs.district.get(districtId) || "" : "",
      categoryName: refs.category.get(num(c.CaseCategoryID) ?? -1) || "",
      gravityName: refs.gravity.get(num(c.GravityOffenceID) ?? -1) || "",
      statusName: refs.status.get(num(c.CaseStatusID) ?? -1) || "",
      headName: refs.head.get(num(c.CrimeMajorHeadID) ?? -1) || "",
      incidentFrom: dateOnly(c.IncidentFromDate),
      incidentTo: dateOnly(c.IncidentToDate),
      briefFacts: s(c.BriefFacts),
    };
  });
}

/**
 * Apply the officer's jurisdiction.
 *
 * A case with no station cannot be placed in anyone's jurisdiction, so it is
 * withheld from everyone except statewide roles rather than shown to all —
 * fail closed, the rule the rest of the platform already follows.
 */
function scopeCases(cases: CaseRecord[], scope: Scope): CaseRecord[] {
  if (scope.statewide) return cases;
  const allowed = new Set(scope.unitIds);
  return cases.filter((c) => c.stationId !== null && allowed.has(c.stationId));
}

const inRange = (date: string, from?: string, to?: string) =>
  (!from || (!!date && date >= from)) && (!to || (!!date && date <= to));

const caseCitation = (c: CaseRecord): Citation => ({
  table: "CaseMaster",
  recordId: c.crimeNo || c.caseNo || c.caseMasterId,
  label: `FIR ${c.crimeNo || c.caseNo || c.caseMasterId}${c.stationName ? ` — ${c.stationName}` : ""}`,
  detail: [c.districtName, c.registeredDate, c.statusName].filter(Boolean).join(" · "),
});

const caseLine = (c: CaseRecord, i: number) =>
  `[${i + 1}] FIR ${c.crimeNo || "(no crime number)"}` +
  (c.caseNo ? ` | Case ${c.caseNo}` : "") +
  ` | Station: ${c.stationName || "not recorded"}` +
  ` | District: ${c.districtName || "not recorded"}` +
  ` | Registered: ${c.registeredDate || "not recorded"}` +
  ` | Category: ${c.categoryName || "not recorded"}` +
  ` | Gravity: ${c.gravityName || "not recorded"}` +
  ` | Status: ${c.statusName || "not recorded"}` +
  (c.headName ? ` | Crime head: ${c.headName}` : "");

/* ── Parties ─────────────────────────────────────────────────────────────── */

interface PartyRow {
  role: "accused" | "victim" | "complainant";
  name: string;
  age: number | null;
  gender: string;
  caseMasterId: string;
}

async function loadParties(): Promise<PartyRow[]> {
  const [accused, victims, complainants] = await Promise.all([
    getAllRows("Accused"),
    getAllRows("Victim"),
    getAllRows("ComplainantDetails"),
  ]);

  const out: PartyRow[] = [];
  for (const r of accused) {
    const a = unwrap(r, "Accused");
    out.push({
      role: "accused",
      name: s(a.AccusedName),
      age: num(a.AgeYear),
      gender: s(a.GenderID),
      caseMasterId: s(a.CaseMasterID),
    });
  }
  for (const r of victims) {
    const v = unwrap(r, "Victim");
    out.push({
      role: "victim",
      name: s(v.VictimName),
      age: num(v.AgeYear),
      gender: s(v.GenderID),
      caseMasterId: s(v.CaseMasterID),
    });
  }
  for (const r of complainants) {
    const c = unwrap(r, "ComplainantDetails");
    out.push({
      role: "complainant",
      name: s(c.ComplainantName),
      age: num(c.AgeYear),
      gender: s(c.GenderID),
      caseMasterId: s(c.CaseMasterID),
    });
  }
  return out.filter((p) => p.name);
}

/**
 * People are matched by NAME, and that is a real limitation, not a detail.
 *
 * Accused rows carry no person-level key — PersonID is positional within a
 * case ("A1", "A2"). So this over-links common names and under-links spelling
 * variants, and every result depending on it says so in `notes`.
 */
const nameMatches = (candidate: string, query: string) => {
  const c = norm(candidate);
  const q = norm(query);
  return !!q && !!c && (c === q || c.includes(q) || q.includes(c));
};

/* ── Execution ───────────────────────────────────────────────────────────── */

const IDENTITY_NOTE =
  "People are matched by name. Accused, victim and complainant records carry no " +
  "person-level identifier, so common names may over-match and spelling variants may be missed.";

export async function executePlan(plan: QueryPlan, scope: Scope): Promise<RetrievalResult> {
  const base = {
    tool: plan.tool,
    toolLabel: labelOf(plan.tool),
    args: plan.args,
    scopeNote: scope.basis,
    notes: [] as string[],
  };

  const empty = (facts: string, notes: string[] = []): RetrievalResult => ({
    ...base,
    matched: 0,
    returned: 0,
    truncated: false,
    facts,
    citations: [],
    notes,
  });

  if (plan.tool === "property_search") {
    return propertySearch(plan, scope, base, empty);
  }

  const refs = await loadRefs();
  const all = await loadCases(refs);
  const visible = scopeCases(all, scope);
  const withheld = all.length - visible.length;

  base.scopeNote =
    scope.statewide || withheld === 0
      ? scope.basis
      : `${scope.basis} ${withheld} case record(s) outside this jurisdiction were not searched.`;

  if (all.length === 0) {
    return empty("RETRIEVED 0 RECORDS. The CaseMaster table contains no registered cases at all.");
  }

  const byId = new Map(visible.map((c) => [c.caseMasterId, c]));

  /* ── case_lookup ─────────────────────────────────────────────────────── */
  if (plan.tool === "case_lookup") {
    // "42/2026" and "0042/2026" are the same FIR to an officer.
    const slim = (v: string) => norm(v).replace(/\s+/g, "").replace(/^0+/, "");
    const wantCrime = slim(s(plan.args.crimeNo));
    const wantCase = slim(s(plan.args.caseNo));
    const wantId = norm(plan.args.caseMasterId);

    const matches = (c: CaseRecord) =>
      (!!wantCrime && slim(c.crimeNo) === wantCrime) ||
      (!!wantCase && slim(c.caseNo) === wantCase) ||
      (!!wantId && norm(c.caseMasterId) === wantId);

    const hit = visible.find(matches);
    const asked = s(plan.args.crimeNo) || s(plan.args.caseNo) || s(plan.args.caseMasterId);

    if (!hit) {
      /*
       * "No such case" and "not yours" are different facts, and the officer is
       * told which one applies. Collapsing them would leave an officer chasing
       * a record that exists three districts away.
       */
      const outsideScope = !scope.statewide && all.some(matches);
      return empty(
        outsideScope
          ? `RETRIEVED 0 RECORDS. A case matching "${asked}" exists but is outside this officer's jurisdiction, so its contents were not read.`
          : `RETRIEVED 0 RECORDS. No registered case matches "${asked}".`
      );
    }

    const parties = (await loadParties()).filter((p) => p.caseMasterId === hit.caseMasterId);
    const group = (role: PartyRow["role"]) =>
      parties
        .filter((p) => p.role === role)
        .map((p) => `${p.name}${p.age !== null ? ` (age ${p.age})` : ""}${p.gender ? `, ${p.gender}` : ""}`);

    const facts = [
      "RETRIEVED 1 RECORD from CaseMaster.",
      caseLine(hit, 0),
      hit.incidentFrom
        ? `    Incident: ${hit.incidentFrom}${hit.incidentTo ? ` to ${hit.incidentTo}` : ""}`
        : "",
      `    Accused: ${group("accused").join("; ") || "none recorded"}`,
      `    Victims: ${group("victim").join("; ") || "none recorded"}`,
      `    Complainants: ${group("complainant").join("; ") || "none recorded"}`,
      hit.briefFacts
        ? `    Brief facts as recorded: ${hit.briefFacts.slice(0, 1500)}`
        : "    Brief facts: not recorded",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ...base,
      matched: 1,
      returned: 1,
      truncated: false,
      facts,
      citations: [caseCitation(hit)],
      notes: parties.length ? [IDENTITY_NOTE] : [],
    };
  }

  /* ── case_search ─────────────────────────────────────────────────────── */
  if (plan.tool === "case_search") {
    let rows = visible;
    const applied: string[] = [];
    const notes: string[] = [];

    const filterByRef = (
      argKey: string,
      m: Map<number, string>,
      field: (c: CaseRecord) => string,
      what: string
    ) => {
      const q = s(plan.args[argKey]);
      if (!q) return;
      const r = resolveRef(m, q);
      if (r.id === null) {
        // An unmatched filter is reported, never dropped in silence: the
        // officer would otherwise read a statewide count as a district one.
        notes.push(
          r.candidates.length
            ? `"${q}" matched ${r.candidates.length} ${what}s (${r.candidates.join(", ")}) — that filter was not applied.`
            : `No ${what} named "${q}" exists in the reference data — that filter was not applied.`
        );
        return;
      }
      rows = rows.filter((c) => norm(field(c)) === norm(r.matched));
      applied.push(`${what}: ${r.matched}`);
    };

    filterByRef("district", refs.district, (c) => c.districtName, "district");
    filterByRef("station", refs.unit, (c) => c.stationName, "police station");
    filterByRef("category", refs.category, (c) => c.categoryName, "category");
    filterByRef("gravity", refs.gravity, (c) => c.gravityName, "gravity");
    filterByRef("status", refs.status, (c) => c.statusName, "investigation status");
    filterByRef("crimeHead", refs.head, (c) => c.headName, "crime head");

    const fromDate = s(plan.args.fromDate) || undefined;
    const toDate = s(plan.args.toDate) || undefined;
    if (fromDate || toDate) {
      rows = rows.filter((c) => inRange(c.registeredDate, fromDate, toDate));
      applied.push(`registered ${fromDate || "any"} to ${toDate || "any"}`);
    }

    rows = [...rows].sort((a, b) => b.registeredDate.localeCompare(a.registeredDate));
    const shown = rows.slice(0, MAX_ROWS_TO_MODEL);
    const filterText = applied.length ? applied.join(" | ") : "no filters — all cases in jurisdiction";

    if (!rows.length) {
      return empty(
        `RETRIEVED 0 RECORDS from CaseMaster. Filters: ${filterText}. ` +
          `${visible.length} case record(s) were searched and none matched.`,
        notes
      );
    }

    return {
      ...base,
      matched: rows.length,
      returned: shown.length,
      truncated: rows.length > shown.length,
      facts:
        `RETRIEVED ${rows.length} RECORD(S) from CaseMaster. Filters: ${filterText}.` +
        (rows.length > shown.length ? ` Showing the ${shown.length} most recent.` : "") +
        "\n" +
        shown.map(caseLine).join("\n"),
      citations: shown.map(caseCitation),
      notes,
    };
  }

  /* ── person_search ───────────────────────────────────────────────────── */
  if (plan.tool === "person_search") {
    const wanted = s(plan.args.name);
    const role = s(plan.args.role) || "any";
    const parties = (await loadParties()).filter(
      (p) =>
        (role === "any" || p.role === role) &&
        nameMatches(p.name, wanted) &&
        byId.has(p.caseMasterId)
    );

    if (!parties.length) {
      return empty(
        `RETRIEVED 0 RECORDS. No ${role === "any" ? "accused, victim or complainant" : role} ` +
          `record matches the name "${wanted}" within this officer's jurisdiction.`,
        [IDENTITY_NOTE]
      );
    }

    const shown = parties.slice(0, MAX_ROWS_TO_MODEL);
    const lines = shown.map((p, i) => {
      const c = byId.get(p.caseMasterId)!;
      return (
        `[${i + 1}] ${p.name}${p.age !== null ? ` (age ${p.age})` : ""}${p.gender ? `, ${p.gender}` : ""}` +
        ` — recorded as ${p.role.toUpperCase()} on FIR ${c.crimeNo || c.caseMasterId}` +
        ` | Station: ${c.stationName || "not recorded"} | Status: ${c.statusName || "not recorded"}`
      );
    });

    return {
      ...base,
      matched: parties.length,
      returned: shown.length,
      truncated: parties.length > shown.length,
      facts: `RETRIEVED ${parties.length} RECORD(S) matching the name "${wanted}".\n` + lines.join("\n"),
      citations: shown.map((p) => {
        const c = byId.get(p.caseMasterId)!;
        return {
          table:
            p.role === "accused" ? "Accused" : p.role === "victim" ? "Victim" : "ComplainantDetails",
          recordId: c.crimeNo || c.caseMasterId,
          label: `${p.name} — ${p.role} on FIR ${c.crimeNo || c.caseMasterId}`,
          detail: [c.stationName, c.statusName].filter(Boolean).join(" · "),
        };
      }),
      notes: [IDENTITY_NOTE],
    };
  }

  /* ── criminal_history ────────────────────────────────────────────────── */
  if (plan.tool === "criminal_history") {
    const wanted = s(plan.args.name);
    const parties = await loadParties();
    const theirs = parties.filter(
      (p) => p.role === "accused" && nameMatches(p.name, wanted) && byId.has(p.caseMasterId)
    );

    if (!theirs.length) {
      return empty(
        `RETRIEVED 0 RECORDS. No accused record matches "${wanted}" within this officer's jurisdiction. ` +
          `This means no such record was found — it is NOT a statement that the person has no history.`,
        [IDENTITY_NOTE]
      );
    }

    const caseIds = [...new Set(theirs.map((p) => p.caseMasterId))];
    const cases = caseIds
      .map((id) => byId.get(id)!)
      .sort((a, b) => b.registeredDate.localeCompare(a.registeredDate));

    // Co-accused: named on the same case. That is co-occurrence in the
    // register, and deliberately not called an association.
    const coAccused = [
      ...new Set(
        parties
          .filter(
            (p) =>
              p.role === "accused" &&
              caseIds.includes(p.caseMasterId) &&
              !nameMatches(p.name, wanted)
          )
          .map((p) => p.name)
      ),
    ];

    const shown = cases.slice(0, MAX_ROWS_TO_MODEL);
    const facts = [
      `RETRIEVED ${cases.length} CASE RECORD(S) naming "${wanted}" as an accused person.`,
      ...shown.map(caseLine),
      coAccused.length
        ? `Named alongside them on those cases: ${coAccused.slice(0, 25).join(", ")}. ` +
          `This is co-occurrence on the same FIR and nothing more — no relationship data is recorded.`
        : "No other accused person is named on those cases.",
    ].join("\n");

    return {
      ...base,
      matched: cases.length,
      returned: shown.length,
      truncated: cases.length > shown.length,
      facts,
      citations: shown.map(caseCitation),
      notes: [
        IDENTITY_NOTE,
        "A count of registered cases is not a conviction record and not a risk assessment.",
      ],
    };
  }

  /* ── crime_stats ─────────────────────────────────────────────────────── */
  if (plan.tool === "crime_stats") {
    /*
     * Aggregates are NOT jurisdiction-filtered, matching /api/analytics/crime,
     * which every officer holding the Crime Analytics tab already sees. The
     * line being drawn is between a district total and the names on a
     * particular FIR; only the second is a jurisdiction question.
     */
    let rows = all;
    const applied: string[] = [];
    const notes = [
      "District and station totals are statewide, the same figures shown on the Crime Analytics screen. Record-level detail stays restricted to this officer's jurisdiction.",
    ];

    const askedDistrict = s(plan.args.district);
    if (askedDistrict) {
      const r = resolveRef(refs.district, askedDistrict);
      if (r.id === null) {
        notes.push(`No district named "${askedDistrict}" exists — that filter was not applied.`);
      } else {
        rows = rows.filter((c) => c.districtId === r.id);
        applied.push(`district: ${r.matched}`);
      }
    }

    const fromDate = s(plan.args.fromDate) || undefined;
    const toDate = s(plan.args.toDate) || undefined;
    if (fromDate || toDate) {
      rows = rows.filter((c) => inRange(c.registeredDate, fromDate, toDate));
      applied.push(`registered ${fromDate || "any"} to ${toDate || "any"}`);
    }

    const groupBy = s(plan.args.groupBy) || "district";
    const keyOf = (c: CaseRecord) =>
      groupBy === "category"
        ? c.categoryName
        : groupBy === "gravity"
        ? c.gravityName
        : groupBy === "status"
        ? c.statusName
        : groupBy === "station"
        ? c.stationName
        : groupBy === "month"
        ? c.registeredDate.slice(0, 7)
        : c.districtName;

    const counts = new Map<string, number>();
    for (const c of rows) {
      const k = keyOf(c) || "(not recorded)";
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const ordered = [...counts].sort((a, b) =>
      groupBy === "month" ? a[0].localeCompare(b[0]) : b[1] - a[1]
    );

    const filterText = applied.length ? applied.join(" | ") : "no filters";
    if (!rows.length) {
      return empty(
        `RETRIEVED 0 RECORDS. Counted over ${all.length} case record(s) with filters: ${filterText}. ` +
          `Nothing matched, so every total is zero.`,
        notes
      );
    }

    return {
      ...base,
      matched: rows.length,
      returned: ordered.length,
      truncated: false,
      facts:
        `COUNTED ${rows.length} CASE RECORD(S) from CaseMaster, grouped by ${groupBy}. Filters: ${filterText}.\n` +
        ordered.map(([k, n]) => `  ${k}: ${n}`).join("\n") +
        `\nTotal: ${rows.length}`,
      // An aggregate has no single record to point at; the working is the
      // filter and the row count, both stated above.
      citations: [],
      notes,
    };
  }

  return empty("RETRIEVED 0 RECORDS. The requested query is not supported.");
}

/* ── Property register ───────────────────────────────────────────────────── */

async function propertySearch(
  plan: QueryPlan,
  scope: Scope,
  base: Omit<RetrievalResult, "matched" | "returned" | "truncated" | "facts" | "citations">,
  empty: (facts: string, notes?: string[]) => RetrievalResult
): Promise<RetrievalResult> {
  const [reportRows, itemRows] = await Promise.all([
    getAllRows("PropertyReport"),
    getAllRows("PropertyItem"),
  ]);

  if (!reportRows.length) {
    return empty("RETRIEVED 0 RECORDS. The property register contains no reports at all.");
  }

  const reports = reportRows.map((r) => {
    const p = unwrap(r, "PropertyReport");
    return {
      reference: s(p.Reference),
      reportType: s(p.ReportType) || "LOST",
      status: s(p.ReportStatus) || "OPEN",
      place: s(p.PlaceOfIncident),
      unitId: num(p.UnitID),
      ownerName: s(p.OwnerName),
      incidentFrom: dateOnly(p.IncidentFrom),
      firReference: s(p.FIRReference),
    };
  });

  const allowedUnits = new Set(scope.unitIds);
  const visible = scope.statewide
    ? reports
    : reports.filter((r) => r.unitId !== null && allowedUnits.has(r.unitId));

  const items = itemRows.map((r) => {
    const it = unwrap(r, "PropertyItem");
    return {
      reference: s(it.ReportReference),
      category: s(it.Category),
      description: s(it.ItemDescription),
      identifierType: s(it.IdentifierType),
      identifierValue: s(it.IdentifierValue),
      itemStatus: s(it.ItemStatus) || "MISSING",
    };
  });

  const wantRef = norm(plan.args.reference);
  const wantCategory = norm(plan.args.category);
  const wantIdentifier = norm(plan.args.identifier).replace(/[\s-]/g, "");

  let hits = visible;
  const applied: string[] = [];

  if (wantRef) {
    hits = hits.filter((r) => norm(r.reference) === wantRef);
    applied.push(`reference: ${s(plan.args.reference)}`);
  }
  if (wantCategory) {
    const refs = new Set(
      items.filter((i) => norm(i.category).includes(wantCategory)).map((i) => i.reference)
    );
    hits = hits.filter((r) => refs.has(r.reference));
    applied.push(`category: ${s(plan.args.category)}`);
  }
  if (wantIdentifier) {
    const refs = new Set(
      items
        .filter((i) => {
          const v = norm(i.identifierValue).replace(/[\s-]/g, "");
          return !!v && (v === wantIdentifier || v.includes(wantIdentifier));
        })
        .map((i) => i.reference)
    );
    hits = hits.filter((r) => refs.has(r.reference));
    applied.push(`identifier: ${s(plan.args.identifier)}`);
  }

  const filterText = applied.length ? applied.join(" | ") : "no filters";
  if (!hits.length) {
    return empty(
      `RETRIEVED 0 RECORDS from the property register. Filters: ${filterText}. ` +
        `${visible.length} report(s) within this officer's jurisdiction were searched.`
    );
  }

  const shown = hits.slice(0, MAX_ROWS_TO_MODEL);
  const lines = shown.map((r, i) => {
    const own = items.filter((it) => it.reference === r.reference);
    return (
      `[${i + 1}] ${r.reference} | ${r.reportType} | Status: ${r.status}` +
      ` | Reported by: ${r.ownerName || "not recorded"}` +
      ` | Place: ${r.place || "not recorded"}` +
      ` | Incident: ${r.incidentFrom || "not recorded"}` +
      (r.firReference ? ` | FIR: ${r.firReference}` : " | No FIR linked") +
      "\n" +
      (own.length
        ? own
            .map(
              (it) =>
                `      - ${it.category}: ${it.description}` +
                (it.identifierValue
                  ? ` (${it.identifierType || "identifier"} ${it.identifierValue})`
                  : "") +
                ` — ${it.itemStatus}`
            )
            .join("\n")
        : "      - no items recorded")
    );
  });

  return {
    ...base,
    matched: hits.length,
    returned: shown.length,
    truncated: hits.length > shown.length,
    facts: `RETRIEVED ${hits.length} PROPERTY REPORT(S). Filters: ${filterText}.\n` + lines.join("\n"),
    citations: shown.map((r) => ({
      table: "PropertyReport",
      recordId: r.reference,
      label: `${r.reference} — ${r.reportType}`,
      detail: [r.status, r.place].filter(Boolean).join(" · "),
    })),
    notes: [
      "Every value in the property register is DECLARED by the person reporting it, not assessed or verified.",
    ],
  };
}

/* ── OSINT → Catalyst cross-link ────────────────────────────────────────── */

/**
 * Given an OSINT target (IP, domain, email, or phone) check whether it
 * appears anywhere in the crime register within the officer's jurisdiction.
 *
 * Phone numbers are matched against MobileNo / PhoneNo / ContactNo columns
 * on Accused, Victim and ComplainantDetails after normalising both sides
 * (strip country code, spaces, dashes).
 *
 * IPs, domains and emails are matched as substrings of BriefFacts — the only
 * free-text field in CaseMaster that would realistically carry them.
 *
 * Nothing here reaches the AI model directly; the caller decides what to
 * prepend to the OSINT block. A Catalyst failure is returned as a message
 * rather than thrown, so one unavailable table does not crash the OSINT reply.
 */
export async function osintCatalystLink(
  target: { kind: string; value: string },
  scope: Scope
): Promise<string> {
  const val = s(target.value);
  if (!val) return "";

  const lines: string[] = [
    `Catalyst internal link check for ${target.kind} "${val}":`,
  ];

  try {
    if (target.kind === "phone") {
      const normalizePhone = (v: string) =>
        s(v).replace(/[\s\-().+]/g, "").replace(/^91/, "").replace(/^0/, "");
      const normTarget = normalizePhone(val);
      if (!normTarget || normTarget.length < 7) {
        lines.push("  phone too short to search.");
        return lines.join("\n");
      }

      const phoneMatch = (raw: string) => {
        const n = normalizePhone(raw);
        return !!n && (n === normTarget || n.includes(normTarget) || normTarget.includes(n));
      };

      const [accused, victims, complainants] = await Promise.all([
        getAllRows("Accused"),
        getAllRows("Victim"),
        getAllRows("ComplainantDetails"),
      ]);

      const hits: string[] = [];
      for (const r of accused) {
        const a = unwrap(r, "Accused");
        const phones = [a.MobileNo, a.PhoneNo, a.ContactNo, a.Mobile].map(s).filter(Boolean);
        if (phones.some(phoneMatch)) {
          hits.push(`  Accused: ${s(a.AccusedName) || "unnamed"} on case ${s(a.CaseMasterID)} (${phones.find(phoneMatch)})`);
        }
      }
      for (const r of victims) {
        const v = unwrap(r, "Victim");
        const phones = [v.MobileNo, v.PhoneNo, v.ContactNo, v.Mobile].map(s).filter(Boolean);
        if (phones.some(phoneMatch)) {
          hits.push(`  Victim: ${s(v.VictimName) || "unnamed"} on case ${s(v.CaseMasterID)} (${phones.find(phoneMatch)})`);
        }
      }
      for (const r of complainants) {
        const c = unwrap(r, "ComplainantDetails");
        const phones = [c.MobileNo, c.PhoneNo, c.ContactNo, c.Mobile].map(s).filter(Boolean);
        if (phones.some(phoneMatch)) {
          hits.push(`  Complainant: ${s(c.ComplainantName) || "unnamed"} on case ${s(c.CaseMasterID)} (${phones.find(phoneMatch)})`);
        }
      }

      if (!hits.length) {
        lines.push("  No accused, victim or complainant record holds this phone number.");
      } else {
        lines.push(`  ${hits.length} record(s) found with this phone number:`);
        lines.push(...hits.slice(0, 10));
        if (hits.length > 10) lines.push(`  … and ${hits.length - 10} more.`);
      }
    } else {
      // IP, domain, email — search BriefFacts as free text
      const refs = await loadRefs();
      const all = await loadCases(refs);
      const allowedUnits = scope.statewide ? null : new Set(scope.unitIds);
      const visible = allowedUnits
        ? all.filter((c) => c.stationId !== null && allowedUnits.has(c.stationId))
        : all;

      const searchVal = val.toLowerCase();
      const matched = visible.filter((c) => c.briefFacts.toLowerCase().includes(searchVal));

      if (!matched.length) {
        lines.push(`  Not found in brief facts of any case within this officer's jurisdiction.`);
      } else {
        lines.push(`  Appears in brief facts of ${matched.length} case(s):`);
        for (const c of matched.slice(0, 8)) {
          lines.push(
            `  - FIR ${c.crimeNo || c.caseMasterId} | ${c.stationName || "station not recorded"} | ${c.registeredDate} | ${c.statusName}`
          );
        }
        if (matched.length > 8) lines.push(`  … and ${matched.length - 8} more.`);
      }
    }
  } catch (e: any) {
    lines.push(`  Catalyst search failed: ${e?.message || "database unavailable"}.`);
  }

  return lines.join("\n");
}

/* ── Guarding the answer ─────────────────────────────────────────────────── */

/**
 * Strip a reasoning model's private thinking out of the answer.
 *
 * Observed the moment the model became configurable: Qwen emits its whole
 * deliberation inside `<think>…</think>` in the CONTENT field, so an officer
 * asking "are you working?" was shown a numbered internal monologue about
 * which rules applied to them, followed by the actual reply. Some providers
 * put this in a separate `reasoning` field and some do not, and which model is
 * selected is now an administrator's choice — so it is stripped here rather
 * than assumed away.
 *
 * An unclosed tag is treated as thinking all the way to the end: a truncated
 * answer that is ALL reasoning must read as empty, so the caller fails over
 * instead of publishing it.
 */
export function visibleAnswer(raw: unknown): string {
  return s(raw)
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*$/i, "")
    .replace(/^\s*<\/(think|thinking|reasoning)>/i, "")
    .trim();
}


const CRIME_NO = /\b\d{1,6}\s*\/\s*(?:19|20)\d{2}\b/g;
const PROP_REF = /\bPROP-\d{4}-\d{5}\b/gi;

/**
 * Record identifiers the answer is entitled to mention.
 *
 * Anything else that looks like a crime or property reference was not read
 * from the database, whatever the sentence around it claims.
 */
export function supportedTokens(
  result: RetrievalResult | null,
  question?: string
): Set<string> {
  const out = new Set<string>();

  const add = (v: string) => {
    const t = s(v).toUpperCase().replace(/\s+/g, "").replace(/^0+/, "");
    if (t) out.add(t);
  };

  /*
   * Anything the OFFICER typed is supported by definition — see below. Seeded
   * first so it holds even when there is no retrieval at all, which is the
   * case during a records outage.
   */
  const asked = s(question);
  for (const m of asked.matchAll(CRIME_NO)) add(m[0]);
  for (const m of asked.matchAll(PROP_REF)) add(m[0]);

  if (!result) return out;

  for (const c of result.citations) {
    add(c.recordId);
    for (const m of c.label.matchAll(CRIME_NO)) add(m[0]);
    for (const m of c.label.matchAll(PROP_REF)) add(m[0]);
  }

  /*
   * THE OFFICER'S OWN SEARCH TERMS COUNT AS SUPPORTED.
   *
   * Observed live: asked about 1234/2026, which does not exist, the assistant
   * correctly replied "no matching record was found for crime number
   * 1234/2026" — and the number was flagged as an unverified reference,
   * because nothing had been retrieved to support it.
   *
   * Repeating the identifier the officer just typed is not an invention, and
   * crying wolf on it would teach officers to ignore the strip that catches
   * the real thing.
   */
  for (const v of Object.values(result.args || {})) {
    const text = s(v);
    for (const m of text.matchAll(CRIME_NO)) add(m[0]);
    for (const m of text.matchAll(PROP_REF)) add(m[0]);
  }
  return out;
}

/**
 * Phrases that deny having found anything.
 *
 * Observed live: a criminal_history query matched two FIRs, the evidence trail
 * listed both, and the 8B model still answered "No matching record was found."
 * The conversation above it contained several genuine no-match replies and it
 * pattern-matched on those.
 *
 * That is the most dangerous single failure this feature can produce — an
 * officer told a person has no history while the register shows two cases —
 * and it cannot be left to prompt wording alone.
 */
const DENIAL_NOUN =
  "(record|records|case|cases|fir|firs|history|result|results|entry|entries|match|matches)";

/*
 * "no" governing one of those nouns within two words. The distance limit is
 * what keeps honest notes out of it: "Brief facts are not recorded" uses "not",
 * not "no", and "there is no further information in the record" puts four words
 * between the two — neither is a denial that the record exists.
 */
const DENIAL = new RegExp(
  `\\bno\\s+(\\w+\\s+){0,2}${DENIAL_NOUN}\\b` +
    `|\\bcould not (find|locate|retrieve)\\b` +
    `|\\bnothing (was )?(found|on record|recorded)\\b` +
    `|\\bnot? (\\w+\\s+){0,2}(history|record) (is|was) recorded\\b`,
  "i"
);

/**
 * Did the answer deny records that were actually retrieved?
 *
 * Only ever consulted when `matched > 0`, so a truthful "no record was found"
 * on an empty result is never flagged.
 */
export function contradictsRetrieval(
  answer: string,
  result: RetrievalResult | null
): boolean {
  if (!result || result.matched === 0) return false;
  return DENIAL.test(s(answer));
}

/** Does this answer assert that nothing exists? */
export function deniesRecords(answer: string): boolean {
  return DENIAL.test(s(answer));
}

/**
 * Is the officer asking about records at all?
 *
 * Used for one narrow purpose: deciding whether an answer that asserts absence
 * needed a lookup behind it. Kept broad, because the cost of a false positive
 * is a caution the officer did not need, and the cost of a false negative is an
 * unchecked "there is no such case" going out unlabelled.
 */
const RECORDS_VOCAB =
  /\b(fir|firs|crime\s*no|crime\s*number|case|cases|accused|victim|complainant|offender|criminal history|antecedent|antecedents|registered|charge\s*sheet|chargesheet|investigation|station|district|stolen|lost property|imei|chassis|how many|statistics|hotspot|convict)/i;

export function looksLikeRecordsQuestion(question: string): boolean {
  return RECORDS_VOCAB.test(s(question));
}

/**
 * References in the answer that no retrieved record supports.
 *
 * This is the check that turns "the model usually behaves" into something an
 * officer can rely on. An invented FIR number is not a stylistic problem — it
 * is a fabricated police record, and it gets labelled as one on screen.
 */
export function unsupportedReferences(answer: string, supported: Set<string>): string[] {
  const found = new Set<string>();
  const text = s(answer);

  for (const m of text.matchAll(CRIME_NO)) {
    const shown = m[0].replace(/\s+/g, "");
    if (!supported.has(shown.toUpperCase().replace(/^0+/, ""))) found.add(shown);
  }
  for (const m of text.matchAll(PROP_REF)) {
    const shown = m[0].toUpperCase();
    if (!supported.has(shown)) found.add(shown);
  }
  return [...found].slice(0, 10);
}
