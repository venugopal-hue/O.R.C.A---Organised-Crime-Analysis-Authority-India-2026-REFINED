import { getAllRows } from "@/lib/catalyst";
import { aiChat } from "@/lib/aiProviders";

/**
 * Building the relation graph from REAL records.
 *
 * The graph is not an investigative finding and does not invent anything. Every
 * node is a row that exists in Catalyst, and every edge is a co-occurrence the
 * schema actually records:
 *
 *   accused / victim / complainant  →  the case they are named on
 *   case                            →  its station and its investigating officer
 *   an accused person               →  ANOTHER case the same name appears on
 *
 * That last edge is the "relation": a person named on this case who is also
 * named on a different registered case. One hop only — this case, the people on
 * it, and the other cases those people touch. It stops there; following those
 * cases onward would grow without bound and turn the graph into a hairball.
 *
 * IDENTITY IS BY NAME, WHICH IS A KNOWN LIMITATION
 *
 * `Accused` carries no person-level key (`PersonID` is positional — "A1", "A2"),
 * so two rows are the same individual when their names match after normalising
 * case and spacing. This over-links common names and under-links spelling
 * variants. `meta.identityBasis` states it so the UI never implies certainty.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const normName = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ");

export type NodeKind = "case" | "accused" | "victim" | "complainant" | "officer" | "station";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** True when the node is a real Catalyst row. Notes-mode adds unverified nodes. */
  verified: boolean;
  /** Real fields to show when the node is selected. No invented values. */
  detail: { label: string; value: string }[];
  crimeNo?: string;
  caseMasterId?: string;
  /**
   * How many hops from the root case this node sits.
   * 0 = root case, 1 = direct people/cases, 2 = extended (two hops out).
   * Undefined in notes-mode.
   */
  hop?: 0 | 1 | 2;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    rootCrimeNo: string;
    rootCaseMasterId: string;
    counts: Record<string, number>;
    otherCaseCount: number;
    /** Cases reachable at exactly 2 hops (accused on 1-hop case → their other cases). */
    twoHopCaseCount: number;
    hops: 1 | 2;
    identityBasis: string;
    note: string;
  };
}

const genderLabel = (g: string) =>
  ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" } as Record<string, string>)[g] || g || "";

/** Resolve a case by CrimeNo, CaseNo, or CaseMasterID — whatever the officer typed. */
function findCase(caseRows: any[], query: string): any | null {
  const q = s(query).replace(/\s+/g, "");
  if (!q) return null;
  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    if (
      s(c.CrimeNo).replace(/\s+/g, "") === q ||
      s(c.CaseNo).replace(/\s+/g, "") === q ||
      s(c.CaseMasterID) === q
    ) {
      return c;
    }
  }
  return null;
}

/**
 * Build the one-hop graph centred on a single case.
 *
 * Returns null when the identifier matches no registered case, so the caller
 * can say "not found" rather than draw an empty canvas.
 */
/**
 * Maximum 2-hop cases added to avoid exploding the graph.
 * Prioritises cases that share more accused with the network.
 */
const MAX_TWO_HOP_CASES = 15;

export async function buildCaseGraph(query: string, hops: 1 | 2 = 1): Promise<Graph | null> {
  const [caseRows, accusedRows, victimRows, complainantRows, units, employees, statuses, gravities] =
    await Promise.all([
      getAllRows("CaseMaster"),
      getAllRows("Accused"),
      getAllRows("Victim"),
      getAllRows("ComplainantDetails"),
      getAllRows("Unit"),
      getAllRows("Employee"),
      getAllRows("CaseStatusMaster"),
      getAllRows("GravityOffence"),
    ]);

  const root = findCase(caseRows, query);
  if (!root) return null;

  const rootId = s(root.CaseMasterID);

  const unitName = new Map<string, string>();
  for (const r of units) {
    const u = unwrap(r, "Unit");
    if (s(u.UnitID)) unitName.set(s(u.UnitID), s(u.UnitName));
  }
  const empName = new Map<string, string>();
  for (const r of employees) {
    const e = unwrap(r, "Employee");
    if (s(e.EmployeeID)) empName.set(s(e.EmployeeID), s(e.FirstName));
  }
  const statusName = new Map<string, string>();
  for (const r of statuses) {
    const st = unwrap(r, "CaseStatusMaster");
    if (s(st.CaseStatusID)) statusName.set(s(st.CaseStatusID), s(st.CaseStatusName));
  }
  const gravityName = new Map<string, string>();
  for (const r of gravities) {
    const g = unwrap(r, "GravityOffence");
    if (s(g.GravityOffenceID)) gravityName.set(s(g.GravityOffenceID), s(g.LookupValue));
  }
  const crimeNoOf = new Map<string, string>();
  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    crimeNoOf.set(s(c.CaseMasterID), s(c.CrimeNo) || s(c.CaseNo) || s(c.CaseMasterID));
  }

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const add = (n: GraphNode) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); } };
  const link = (source: string, target: string, label: string) => links.push({ source, target, label });

  const caseNodeId = (cid: string) => `case:${cid}`;

  // ── Root case ────────────────────────────────────────────────────────────
  const rootStation = unitName.get(s(root.PoliceStationID)) || "";
  add({
    id: caseNodeId(rootId),
    label: crimeNoOf.get(rootId) || rootId,
    kind: "case",
    verified: true,
    crimeNo: crimeNoOf.get(rootId),
    caseMasterId: rootId,
    hop: 0,
    detail: [
      { label: "Crime No.", value: s(root.CrimeNo) || "—" },
      { label: "Registered", value: s(root.CrimeRegisteredDate) || "—" },
      { label: "Station", value: rootStation || "Not recorded" },
      { label: "Status", value: statusName.get(s(root.CaseStatusID)) || "Not recorded" },
      { label: "Gravity", value: gravityName.get(s(root.GravityOffenceID)) || "Not recorded" },
    ],
  });

  // ── Station and investigating officer of the root case ────────────────────
  if (s(root.PoliceStationID) && rootStation) {
    const stId = `station:${s(root.PoliceStationID)}`;
    add({ id: stId, label: rootStation, kind: "station", verified: true, hop: 1, detail: [{ label: "Unit", value: rootStation }] });
    link(caseNodeId(rootId), stId, "registered at");
  }
  if (s(root.PolicePersonID) && empName.get(s(root.PolicePersonID))) {
    const ioId = `officer:${s(root.PolicePersonID)}`;
    add({ id: ioId, label: empName.get(s(root.PolicePersonID))!, kind: "officer", verified: true, hop: 1, detail: [{ label: "Investigating Officer", value: empName.get(s(root.PolicePersonID))! }] });
    link(caseNodeId(rootId), ioId, "investigated by");
  }

  const counts: Record<string, number> = { accused: 0, victim: 0, complainant: 0, otherCase: 0 };

  // ── People on the root case ───────────────────────────────────────────────
  const mine = (rows: any[], table: string) =>
    rows.filter((r) => s(unwrap(r, table).CaseMasterID) === rootId);

  const accusedHere = mine(accusedRows, "Accused");
  for (const r of accusedHere) {
    const a = unwrap(r, "Accused");
    const id = `accused:${s(r.ROWID ?? a.ROWID)}`;
    add({
      id,
      label: s(a.AccusedName) || "(unnamed)",
      kind: "accused",
      verified: true,
      caseMasterId: rootId,
      hop: 1,
      detail: [
        { label: "Role", value: "Accused" },
        { label: "Age", value: a.AgeYear ? s(a.AgeYear) : "Not recorded" },
        { label: "Gender", value: genderLabel(s(a.GenderID)) || "Not recorded" },
      ],
    });
    link(id, caseNodeId(rootId), "accused in");
    counts.accused++;
  }

  for (const r of mine(victimRows, "Victim")) {
    const v = unwrap(r, "Victim");
    const id = `victim:${s(r.ROWID ?? v.ROWID)}`;
    add({
      id,
      label: s(v.VictimName) || "(unnamed)",
      kind: "victim",
      verified: true,
      caseMasterId: rootId,
      hop: 1,
      detail: [
        { label: "Role", value: "Victim" },
        { label: "Age", value: v.AgeYear ? s(v.AgeYear) : "Not recorded" },
        { label: "Gender", value: genderLabel(s(v.GenderID)) || "Not recorded" },
      ],
    });
    link(id, caseNodeId(rootId), "victim in");
    counts.victim++;
  }

  for (const r of mine(complainantRows, "ComplainantDetails")) {
    const c = unwrap(r, "ComplainantDetails");
    const id = `complainant:${s(r.ROWID ?? c.ROWID)}`;
    add({
      id,
      label: s(c.ComplainantName) || "(unnamed)",
      kind: "complainant",
      verified: true,
      caseMasterId: rootId,
      hop: 1,
      detail: [{ label: "Role", value: "Complainant" }],
    });
    link(id, caseNodeId(rootId), "complainant in");
    counts.complainant++;
  }

  // ── ONE HOP: an accused named here who also appears on another case ────────
  // Build a name → set-of-other-cases index across the whole Accused table.
  const casesByName = new Map<string, Set<string>>();
  for (const r of accusedRows) {
    const a = unwrap(r, "Accused");
    const key = normName(a.AccusedName);
    if (!key) continue;
    if (!casesByName.has(key)) casesByName.set(key, new Set());
    casesByName.get(key)!.add(s(a.CaseMasterID));
  }

  for (const r of accusedHere) {
    const a = unwrap(r, "Accused");
    const key = normName(a.AccusedName);
    const accusedNodeId = `accused:${s(r.ROWID ?? a.ROWID)}`;
    const others = [...(casesByName.get(key) || [])].filter((cid) => cid && cid !== rootId);
    for (const cid of others) {
      const otherNodeId = caseNodeId(cid);
      if (!seen.has(otherNodeId)) {
        const oc = unwrap(caseRows.find((x) => s(unwrap(x, "CaseMaster").CaseMasterID) === cid), "CaseMaster");
        add({
          id: otherNodeId,
          label: crimeNoOf.get(cid) || cid,
          kind: "case",
          verified: true,
          crimeNo: crimeNoOf.get(cid),
          caseMasterId: cid,
          hop: 1,
          detail: [
            { label: "Crime No.", value: s(oc.CrimeNo) || crimeNoOf.get(cid) || "—" },
            { label: "Registered", value: s(oc.CrimeRegisteredDate) || "—" },
            { label: "Station", value: unitName.get(s(oc.PoliceStationID)) || "Not recorded" },
            { label: "Link", value: `Shares accused "${s(a.AccusedName)}" with ${crimeNoOf.get(rootId)}` },
            { label: "Hop", value: "1 — direct accused overlap" },
          ],
        });
        counts.otherCase++;
      }
      link(accusedNodeId, otherNodeId, "also accused in");
    }
  }

  // ── TWO-HOP EXTENSION ────────────────────────────────────────────────────
  // For each 1-hop case, find its accused. For each of those accused, find
  // the OTHER cases they appear on (that are not already in the graph).
  // This reveals a second ring of connected cases for organised-crime analysis.
  counts.twoHopCase = 0;

  if (hops === 2) {
    // Collect all case IDs already in the graph (root + 1-hop).
    const graphCaseIds = new Set(
      nodes.filter((n) => n.kind === "case").map((n) => n.caseMasterId).filter(Boolean) as string[]
    );

    // Build a map of score: caseId → how many accused in THIS graph also appear on it.
    // Higher score = more shared accused = stronger organised-crime signal.
    const twoHopScores = new Map<string, { score: number; sharedWith: string[] }>();

    const hopOneCaseIds = [...graphCaseIds].filter((cid) => cid !== rootId);

    for (const hopOneCaseId of hopOneCaseIds) {
      // Find accused on this 1-hop case.
      const hopOneAccused = accusedRows
        .map((r) => unwrap(r, "Accused"))
        .filter((a) => s(a.CaseMasterID) === hopOneCaseId);

      for (const a of hopOneAccused) {
        const key = normName(a.AccusedName);
        const others = [...(casesByName.get(key) || [])].filter(
          (cid) => cid && !graphCaseIds.has(cid)
        );
        for (const cid of others) {
          if (!twoHopScores.has(cid)) twoHopScores.set(cid, { score: 0, sharedWith: [] });
          const entry = twoHopScores.get(cid)!;
          entry.score++;
          entry.sharedWith.push(s(a.AccusedName));
        }
      }
    }

    // Sort by score descending and cap.
    const ranked = [...twoHopScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, MAX_TWO_HOP_CASES);

    for (const [cid, { sharedWith }] of ranked) {
      const twoHopNodeId = caseNodeId(cid);
      if (seen.has(twoHopNodeId)) continue;

      const oc = unwrap(
        caseRows.find((x) => s(unwrap(x, "CaseMaster").CaseMasterID) === cid),
        "CaseMaster"
      );
      add({
        id: twoHopNodeId,
        label: crimeNoOf.get(cid) || cid,
        kind: "case",
        verified: true,
        crimeNo: crimeNoOf.get(cid),
        caseMasterId: cid,
        hop: 2,
        detail: [
          { label: "Crime No.", value: s(oc.CrimeNo) || crimeNoOf.get(cid) || "—" },
          { label: "Registered", value: s(oc.CrimeRegisteredDate) || "—" },
          { label: "Station", value: unitName.get(s(oc.PoliceStationID)) || "Not recorded" },
          { label: "Shared accused", value: [...new Set(sharedWith)].slice(0, 3).join(", ") },
          { label: "Hop", value: "2 — extended network" },
        ],
      });
      counts.twoHopCase++;

      // Find the accused node(s) that bridge to this 2-hop case and add edges.
      // We only draw edges from accused that ARE already in the graph to avoid
      // adding unrooted nodes.
      const bridgeAccused = accusedRows
        .map((r) => unwrap(r, "Accused"))
        .filter((a) => s(a.CaseMasterID) === cid && seen.has(`accused:${s(a.ROWID)}`));
      if (bridgeAccused.length) {
        for (const ba of bridgeAccused) {
          link(`accused:${s(ba.ROWID)}`, twoHopNodeId, "2nd-degree link");
        }
      } else {
        // No direct accused bridge visible — link from any 1-hop case that
        // shares an accused with this 2-hop case.
        for (const hopOneCaseId of hopOneCaseIds) {
          const shared = accusedRows
            .map((r) => unwrap(r, "Accused"))
            .filter((a) => {
              const k = normName(a.AccusedName);
              return s(a.CaseMasterID) === hopOneCaseId && (casesByName.get(k) || new Set()).has(cid);
            });
          if (shared.length) {
            link(caseNodeId(hopOneCaseId), twoHopNodeId, "2nd-degree link");
            break;
          }
        }
      }
    }
  }

  return {
    nodes,
    links,
    meta: {
      rootCrimeNo: crimeNoOf.get(rootId) || rootId,
      rootCaseMasterId: rootId,
      counts,
      otherCaseCount: counts.otherCase,
      twoHopCaseCount: counts.twoHopCase ?? 0,
      hops,
      identityBasis:
        "Cross-case links are matched by accused name. The Accused table has no person-level identifier, so common names may over-link and spelling variants may be missed.",
      note:
        hops === 2
          ? "Two-hop view: the root case, its direct network (hop 1), and cases reachable through accused on hop-1 cases (hop 2). Faded nodes are at the outer ring."
          : "Every node is a registered record. Edges are co-occurrences the schema records, not investigative findings.",
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════
 * NOTES MODE — extract what the officer WROTE, then let the records confirm it.
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * The extraction contract with the model.
 *
 * The model is a PARSER, not an analyst. It may only return entities and
 * relationships that are stated in the officer's text. It is told, in as many
 * words, not to invent tiers, aliases, records or connections — that invented
 * enrichment is exactly what was stripped out of this platform once already.
 * The truth about any person comes from the Accused table below, never here.
 */
const EXTRACT_SYSTEM = `You convert an investigator's free-text notes into a strict JSON graph of ONLY what the text explicitly states.

Return a JSON object of this exact shape and nothing else:
{"entities":[{"name":"<as written>","type":"person|vehicle|phone|location|item|organization"}],"relationships":[{"from":"<entity name>","to":"<entity name>","label":"<short verb from the text>"}]}

RULES:
- Include ONLY people, things and links the text actually mentions. Never add anything not in the text.
- Do NOT invent aliases, ranks, tiers, criminal history, bank accounts, phone numbers, or relationships. If the text does not say it, it does not exist.
- "label" must be a short phrase grounded in the text (e.g. "met", "drove", "called", "seen at"). Do not embellish.
- Use the person's name exactly as written so it can be matched against records.
- If the text names nothing, return {"entities":[],"relationships":[]}.`;

/** Parse the model's JSON, tolerating fences, prose and light truncation. */
function parseExtraction(raw: string): { entities: any[]; relationships: any[] } {
  let t = raw
    // A reasoning model may prepend its thinking; drop it before parsing.
    .replace(/<(?:think|thinking|reasoning)>[\s\S]*?<\/(?:think|thinking|reasoning)>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  t = t.replace(/,\s*([}\]])/g, "$1"); // trailing commas

  const tryParse = (str: string) => {
    try { return JSON.parse(str); } catch { return null; }
  };
  let obj = tryParse(t);
  if (!obj) {
    // Best-effort close of unbalanced brackets from a truncated response.
    const opens = (t.match(/[{[]/g) || []).length;
    const closes = (t.match(/[}\]]/g) || []).length;
    let patched = t.replace(/,\s*"[^"]*"\s*:?\s*$/,"");
    for (let i = 0; i < opens - closes; i++) patched += t.lastIndexOf("[") > t.lastIndexOf("{") ? "]" : "}";
    obj = tryParse(patched);
  }
  return {
    entities: Array.isArray(obj?.entities) ? obj.entities : [],
    relationships: Array.isArray(obj?.relationships) ? obj.relationships : [],
  };
}

const slug = (v: string) => normName(v).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

/**
 * Build a graph from free-text notes.
 *
 * The AI extracts entities and links. Then, for every PERSON, the Accused table
 * is consulted: a name that matches a real record becomes a VERIFIED node
 * carrying that person's real cases; a name with no record stays UNVERIFIED and
 * says so. Vehicles, phones and places are shown as written but never claimed to
 * be verified — the schema records none of them.
 */
export async function buildNotesGraph(text: string): Promise<Graph> {
  const notes = s(text);
  if (!notes) {
    return {
      nodes: [], links: [],
      meta: { rootCrimeNo: "", rootCaseMasterId: "", counts: {}, otherCaseCount: 0, twoHopCaseCount: 0, hops: 1 as const, identityBasis: "", note: "No notes provided." },
    };
  }

  const { text: aiText } = await aiChat(
    [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: notes.slice(0, 8000) },
    ],
    { maxTokens: 1500, temperature: 0.1, timeoutMs: 15000, preferProvider: "Groq", reasoningEffort: "low" }
  );
  const { entities, relationships } = parseExtraction(aiText);

  // Index the Accused table by normalised name, so an extracted person can be
  // confirmed and shown with the real cases they are recorded on.
  const [accusedRows, caseRows] = await Promise.all([getAllRows("Accused"), getAllRows("CaseMaster")]);
  const crimeNoOf = new Map<string, string>();
  for (const r of caseRows) {
    const c = unwrap(r, "CaseMaster");
    crimeNoOf.set(s(c.CaseMasterID), s(c.CrimeNo) || s(c.CaseNo) || s(c.CaseMasterID));
  }
  const recordByName = new Map<string, { cases: Set<string>; age: string; gender: string }>();
  for (const r of accusedRows) {
    const a = unwrap(r, "Accused");
    const key = normName(a.AccusedName);
    if (!key) continue;
    if (!recordByName.has(key)) recordByName.set(key, { cases: new Set(), age: "", gender: "" });
    const rec = recordByName.get(key)!;
    rec.cases.add(crimeNoOf.get(s(a.CaseMasterID)) || s(a.CaseMasterID));
    if (!rec.age && a.AgeYear) rec.age = s(a.AgeYear);
    if (!rec.gender && a.GenderID) rec.gender = genderLabel(s(a.GenderID));
  }

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const idByName = new Map<string, string>();
  const seen = new Set<string>();
  let confirmed = 0;

  for (const e of entities) {
    const name = s(e?.name);
    if (!name) continue;
    const type = s(e?.type).toLowerCase();
    const kind: NodeKind = type === "person" ? "accused" : "complainant"; // only people map to a record-kind
    const id = `note:${type || "x"}:${slug(name)}`;
    if (seen.has(id)) { idByName.set(normName(name), id); continue; }
    seen.add(id);
    idByName.set(normName(name), id);

    if (type === "person") {
      const rec = recordByName.get(normName(name));
      if (rec) {
        confirmed++;
        nodes.push({
          id, label: name, kind: "accused", verified: true,
          detail: [
            { label: "Status", value: "Found in accused records" },
            { label: "Cases", value: [...rec.cases].join(", ") || "—" },
            { label: "Age", value: rec.age || "Not recorded" },
            { label: "Gender", value: rec.gender || "Not recorded" },
          ],
        });
      } else {
        nodes.push({
          id, label: name, kind: "accused", verified: false,
          detail: [{ label: "Status", value: "Mentioned in notes — no matching record" }],
        });
      }
    } else {
      nodes.push({
        id, label: name, kind,
        verified: false,
        detail: [
          { label: "Type", value: type || "unknown" },
          { label: "Status", value: "From notes — not a recorded entity type" },
        ],
      });
    }
  }

  for (const r of relationships) {
    const from = idByName.get(normName(s(r?.from)));
    const to = idByName.get(normName(s(r?.to)));
    if (from && to && from !== to) links.push({ source: from, target: to, label: s(r?.label) || "linked" });
  }

  return {
    nodes, links,
    meta: {
      rootCrimeNo: "", rootCaseMasterId: "",
      counts: { entities: nodes.length, confirmed, unverified: nodes.length - confirmed },
      otherCaseCount: 0,
      twoHopCaseCount: 0,
      hops: 1 as const,
      identityBasis: "People are matched to the Accused table by name; matching is approximate and record-free entities cannot be verified.",
      note: "Entities and links are extracted from the notes as written. Solid nodes matched a real record; hollow nodes are from the notes only and are not verified.",
    },
  };
}
