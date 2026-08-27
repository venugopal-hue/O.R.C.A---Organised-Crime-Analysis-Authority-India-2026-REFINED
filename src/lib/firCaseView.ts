import { getAllRows } from "@/lib/catalyst";
import { loadFirCases, type FirCase } from "@/lib/firCases";
import type {
  CasePerson,
  CaseSection,
  CaseTimelineEvent,
  FirCaseDetail,
  FirCaseListItem,
} from "@/lib/intelligenceTypes";

/**
 * Turning a Catalyst case row into what the case workspace screen renders.
 *
 * WHY THIS FILE EXISTS
 *
 * `/api/fir/cases` returned raw `CaseMaster` rows — `CaseMasterID`, `CrimeNo`,
 * `GravityOffenceID`, `BriefFacts`. The screen asks for `case.district`,
 * `case.severity`, `case.summary`. Nothing translated between the two, so
 * every field arrived undefined and `activeCase.district.toUpperCase()` threw.
 * It has never been noticed because `CaseMaster` is empty: the tab renders its
 * "no cases" state and the crash waits for the first registered FIR.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * The old screen showed a Modus Operandi paragraph, a packet SHA-256, a chain
 * of custody and a "Sync match: 91%" against each suspect. None of those have
 * a column anywhere in this schema — they came from the deleted mock database.
 * They are not stubbed or defaulted here; the fields do not exist, so the
 * blocks that displayed them are gone from the screen. An empty box labelled
 * "PACKET HASH" reads as a verification that happened.
 *
 * Custody IS tracked, per evidence item, in Evidence / EvidenceCustody. That is
 * the Evidence Management tab, and the screen now says so rather than showing a
 * blank ledger here.
 */

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "").trim();
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const titleOf = (c: FirCase): string =>
  // CrimeHead is the natural title and is currently an EMPTY reference table,
  // so in practice this falls through to the category until it is loaded.
  c.headName || c.categoryName || (c.caseNo ? `Case ${c.caseNo}` : "Unclassified case");

const toListItem = (c: FirCase): FirCaseListItem => ({
  caseMasterId: c.caseMasterId,
  id: c.crimeNo || c.caseNo || c.caseMasterId,
  caseNo: c.caseNo,
  title: titleOf(c),
  district: c.districtName,
  station: c.stationName,
  datetime: c.registered,
  severity: c.heinous ? "severe" : "moderate",
  severityLabel: c.gravityName || (c.heinous ? "Heinous" : "Not recorded"),
  category: c.categoryName,
  status: c.statusName,
});

/** Newest first, by registration date then by id. */
export async function listCaseViews(): Promise<FirCaseListItem[]> {
  const { cases } = await loadFirCases();
  return [...cases]
    .sort(
      (a, b) =>
        b.registered.localeCompare(a.registered) ||
        Number(b.caseMasterId || 0) - Number(a.caseMasterId || 0)
    )
    .map(toListItem);
}

const person = (r: any, table: string, nameCol: string): CasePerson => {
  const p = unwrap(r, table);
  return {
    id: s(r.ROWID ?? p.ROWID),
    name: s(p[nameCol]),
    age: num(p.AgeYear),
    gender: s(p.GenderID),
  };
};

/**
 * The chronology, built from the four dates the schema actually records.
 *
 * The old version narrated an investigation — sightings, tower dumps, an
 * arrest. None of it was recorded anywhere. These four are, and an event with
 * no date is left out rather than shown as pending.
 */
function timelineOf(c: any): CaseTimelineEvent[] {
  const events: CaseTimelineEvent[] = [];
  const add = (label: string, when: unknown) => {
    const v = s(when);
    if (v) events.push({ label, when: v });
  };
  add("Incident began", c.IncidentFromDate);
  add("Incident ended", c.IncidentToDate);
  add("Information received at station", c.InfoReceivedPSDate);
  add("FIR registered", c.CrimeRegisteredDate);
  return events.sort((a, b) => a.when.localeCompare(b.when));
}

export async function caseDetailView(caseMasterId: string): Promise<FirCaseDetail | null> {
  const [{ cases }, caseRows] = await Promise.all([loadFirCases(), getAllRows("CaseMaster")]);

  const joined = cases.find((c) => c.caseMasterId === String(caseMasterId));
  if (!joined) return null;

  const raw = unwrap(
    caseRows.find((r) => s(unwrap(r, "CaseMaster").CaseMasterID) === String(caseMasterId)),
    "CaseMaster"
  );

  const [accused, victims, complainants, links, sections, acts] = await Promise.all([
    getAllRows("Accused"),
    getAllRows("Victim"),
    getAllRows("ComplainantDetails"),
    getAllRows("ActSectionAssociation"),
    getAllRows("Section"),
    getAllRows("Act"),
  ]);

  const mine = (rows: any[], table: string) =>
    rows.filter((r) => s(unwrap(r, table).CaseMasterID) === String(caseMasterId));

  // Section and Act are keyed by VARCHAR codes, not numeric ids.
  const sectionText = new Map<string, string>();
  for (const r of sections) {
    const sec = unwrap(r, "Section");
    const code = s(sec.SectionCode);
    if (code) sectionText.set(code, s(sec.SectionDescription));
  }
  const actName = new Map<string, string>();
  for (const r of acts) {
    const a = unwrap(r, "Act");
    const code = s(a.ActCode);
    if (code) actName.set(code, s(a.ShortName) || s(a.ActDescription));
  }

  const legalSections: CaseSection[] = mine(links, "ActSectionAssociation")
    .map((r) => {
      const l = unwrap(r, "ActSectionAssociation");
      // The association table names these ID, but they hold the VARCHAR CODES:
      // /api/fir/register writes Section.SectionCode into SectionID and
      // Act.ActCode into ActID. Reading `SectionCode` here returned undefined
      // for every charge, which the fixture test caught.
      const code = s(l.SectionID);
      const act = s(l.ActID);
      return {
        act: actName.get(act) || act,
        code,
        // Blank when the section code is not in the 929-row Section table —
        // stated as unlisted rather than silently dropped.
        description: sectionText.get(code) || "",
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return {
    ...toListItem(joined),
    officer: joined.officerName,
    summary: s(raw.BriefFacts),
    timeline: timelineOf(raw),
    accused: mine(accused, "Accused").map((r) => person(r, "Accused", "AccusedName")),
    victims: mine(victims, "Victim").map((r) => person(r, "Victim", "VictimName")),
    complainants: mine(complainants, "ComplainantDetails").map((r) =>
      person(r, "ComplainantDetails", "ComplainantName")
    ),
    legalSections,
  };
}
