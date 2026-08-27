/**
 * Shapes for the intelligence screens.
 *
 * These used to live in `src/lib/mock.ts` alongside a fabricated crime
 * database — invented districts, invented suspect dossiers, invented FIRs —
 * which the dashboard rendered as though it were real casework. The data is
 * gone; the shapes are real and are what the Catalyst-backed screens fill.
 *
 * Nothing in this file holds a value. If you are looking for where a screen
 * gets its content, it is an API route under src/app/api.
 */

/**
 * THE CASE WORKSPACE SHAPES.
 *
 * These replace `FIRCase`, `Suspect`, `BNSSection`, `TimelineNode` and
 * `ChainOfCustodyLog`, which described a case file this schema cannot produce:
 * a modus operandi paragraph, a per-case SHA-256, an OCR confidence, an entity
 * match weight, a watchlist status, aliases, known associates, and a
 * per-suspect match percentage. Every one of those came from the deleted mock
 * database and has no column anywhere in Catalyst.
 *
 * They are removed rather than left optional. A field that is always empty
 * still renders a label, and a box reading "PACKET HASH:" tells an officer a
 * verification took place.
 *
 * Custody is genuinely recorded — per evidence item, in Evidence and
 * EvidenceCustody. That is the Evidence Management tab.
 *
 * Filled by src/lib/firCaseView.ts, which is the only place the Catalyst
 * column names appear.
 */

/** `GravityOffence` holds two rows, so two values are reachable. The screen
 *  previously offered four levels; the other two could never occur. */
export type CaseSeverity = "severe" | "moderate";

export interface FirCaseListItem {
  caseMasterId: string;
  /** The FIR number as printed — what an officer recognises a case by. */
  id: string;
  caseNo: string;
  title: string;
  district: string;
  station: string;
  datetime: string;
  severity: CaseSeverity;
  severityLabel: string;
  category: string;
  status: string;
}

export interface CaseTimelineEvent {
  label: string;
  when: string;
}

export interface CasePerson {
  /** Catalyst ROWID of the person's record. */
  id: string;
  name: string;
  age: number | null;
  gender: string;
}

export interface CaseSection {
  act: string;
  code: string;
  description: string;
}

export interface FirCaseDetail extends FirCaseListItem {
  officer: string;
  /** `BriefFacts` — the only narrative the schema records. */
  summary: string;
  timeline: CaseTimelineEvent[];
  accused: CasePerson[];
  victims: CasePerson[];
  complainants: CasePerson[];
  legalSections: CaseSection[];
}

export interface DistrictTelemetry {
  name: string;
  level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  density: string;
  firs: string;
  dominant: string;
  patrol: string;
  squads: string;
  advisory: string;
  pulsatingHotspot: boolean;
  geofenceAlert?: string;
  patrolCoordinates: string;
}

export interface SuspectDossier {
  name: string;
  age: number;
  tier: string;
  status: string;
  modusOperandi: string;
  location: string;
  firs: string;
  contacts: string;
  vehicles: string;
  accounts: string;
  notes: string;
  aliases: string;
  knownAssociates: string;
  financialAnomaly: string;
  watchlistStatus: "CRITICAL" | "SURVEILLANCE" | "FLAGGED";
}

export interface AIPresetBrief {
  title: string;
  classification: string;
  content: string;
}

export interface TelemetryLogEntry {
  timestamp: string;
  source: string;
  message: string;
  type: "info" | "alert" | "success" | "danger";
}
