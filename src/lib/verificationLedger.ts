/**
 * O.R.C.A document verification ledger — Catalyst backed (SERVER-SIDE ONLY).
 *
 * Replaces the Firestore `verified_documents` collection. A registered case
 * gets one ledger row; scanning its printed barcode resolves that row and then
 * reads the LIVE case out of CaseMaster and its child tables, so a scan always
 * reflects the current state of the case rather than a snapshot taken at print.
 *
 * The barcode carries CrimeNo, not CaseMasterID: CrimeNo is unique by
 * construction (category + district + unit + year + serial), it is the number
 * officers actually cite, and it is printed on the document in human-readable
 * form right next to the barcode.
 */

import crypto from "crypto";
import { getAllRows, insertRows, isCatalystConfigured } from "./catalyst";

const TABLE = "VerifiedDocument";

/** Exported so callers can allocate a reference serial against the same table. */
export const LEDGER_TABLE = TABLE;

/** Whether the ledger can be reached at all. */
export function isLedgerAvailable(): boolean {
  return isCatalystConfigured();
}

export interface LedgerEntry {
  VerificationID: string;
  CrimeNo: string;
  CaseMasterID: number;
  DocumentHash: string;
  IssuedBy: string;
  IssuedAt: string;
  VerificationStatus: string;
}

/**
 * Year a case was registered, read out of its own crime number.
 *
 * CrimeNo is 1 digit category + 4 district + 4 unit + 4 YEAR + 5 serial, so
 * the year sits at offset 9..12 and never has to be passed around separately.
 * Falls back to the current year if handed something that is not a crime number.
 */
export function caseYearOf(crimeNo: string): string {
  const m = String(crimeNo || "").match(/^\d{9}(\d{4})\d{5}$/);
  return m ? m[1] : String(new Date().getFullYear());
}

/**
 * Verification ID derived from the crime number — one ledger row per case.
 * The year is the CASE's year, not a fixed constant: a case registered in 2027
 * gets VER-2027-…, which is why it is read back out of the crime number here
 * rather than hardcoded.
 */
export function verificationIdFor(crimeNo: string): string {
  return `VER-${caseYearOf(crimeNo)}-${crimeNo}`;
}

/** Stable digest over the parts of a case that must not change silently. */
export function documentHash(input: {
  crimeNo: string;
  caseNo: string;
  policeStationId: string | number;
  caseCategoryId: string | number;
  registeredDate: string;
  briefFacts: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .toUpperCase();
}

/** Write the ledger row for a newly registered case. Non-fatal on failure. */
export async function registerInLedger(entry: LedgerEntry): Promise<boolean> {
  try {
    await insertRows(TABLE, [entry]);
    return true;
  } catch (err: any) {
    console.error("[verificationLedger] register failed:", err.message);
    return false;
  }
}

/**
 * Find a ledger row by verification ID, by crime number, or by bare reference.
 *
 * The `reference` form exists for AI intelligence briefs: their barcode carries
 * only "ISD-CR-nnnn", with no year in it, so neither the verification ID
 * (VER-<year>-ISD-CR-nnnn) nor the case number (FIR/<year>/BLR/nnnn) can be
 * reconstructed from the scan alone. Matching on the suffix keeps a brief
 * issued in one year verifiable in the next.
 */
export async function findLedgerEntry(opts: {
  verificationId?: string;
  crimeNo?: string;
  reference?: string;
}): Promise<any | null> {
  const rows = await getAllRows(TABLE);
  return (
    rows.find((r) => {
      const rec = r[TABLE] || r;
      if (opts.verificationId && String(rec.VerificationID) === String(opts.verificationId)) return true;
      if (opts.crimeNo && String(rec.CrimeNo) === String(opts.crimeNo)) return true;
      if (opts.reference) {
        const ref = String(opts.reference).toUpperCase();
        if (String(rec.VerificationID || "").toUpperCase().endsWith(`-${ref}`)) return true;
        if (String(rec.CrimeNo || "").toUpperCase().endsWith(`/${ref}`)) return true;
      }
      return false;
    }) || null
  );
}

/**
 * Resolve a scanned document to the live case record plus its child rows and
 * the human-readable labels the portal displays.
 */
export async function resolveCase(crimeNo: string): Promise<any | null> {
  const cases = await getAllRows("CaseMaster");
  const found = cases.find((c: any) => String((c.CaseMaster || c).CrimeNo) === String(crimeNo));
  if (!found) return null;
  const c: any = found.CaseMaster || found;
  const id = String(c.CaseMasterID);

  const [complainants, victims, accused, actSections, units, districts, cats, statuses, gravs, courts, acts, sections] =
    await Promise.all([
      getAllRows("ComplainantDetails"),
      getAllRows("Victim"),
      getAllRows("Accused"),
      getAllRows("ActSectionAssociation"),
      getAllRows("Unit"),
      getAllRows("District"),
      getAllRows("CaseCategory"),
      getAllRows("CaseStatusMaster"),
      getAllRows("GravityOffence"),
      getAllRows("Court"),
      getAllRows("Act"),
      getAllRows("Section"),
    ]);

  const mine = (rows: any[]) => rows.filter((r) => String(r.CaseMasterID) === id);
  const label = (rows: any[], idCol: string, nameCol: string, value: any) =>
    rows.find((r) => String(r[idCol]) === String(value))?.[nameCol] || "";

  // CaseMaster carries no DistrictID of its own — the district comes from the
  // station's Unit row. (CrimeNo digits 2-5 encode it too, but the Unit row is
  // the authoritative link.)
  const station = units.find((u: any) => String(u.UnitID) === String(c.PoliceStationID));

  const caseSections = mine(actSections).map((s: any) => ({
    actCode: s.ActID,
    act: label(acts, "ActCode", "ActDescription", s.ActID),
    section: s.SectionID,
    sectionDescription:
      sections.find(
        (x: any) => String(x.SectionCode) === String(s.SectionID) && String(x.ActCode) === String(s.ActID)
      )?.SectionDescription || "",
  }));

  return {
    caseMasterId: c.CaseMasterID,
    crimeNo: c.CrimeNo,
    caseNo: c.CaseNo,
    registeredDate: c.CrimeRegisteredDate,
    caseCategory: label(cats, "CaseCategoryID", "LookupValue", c.CaseCategoryID),
    policeStation: label(units, "UnitID", "UnitName", c.PoliceStationID),
    district: label(districts, "DistrictID", "DistrictName", station?.DistrictID),
    gravity: label(gravs, "GravityOffenceID", "LookupValue", c.GravityOffenceID),
    caseStatus: label(statuses, "CaseStatusID", "CaseStatusName", c.CaseStatusID),
    court: label(courts, "CourtID", "CourtName", c.CourtID),
    incidentFrom: c.IncidentFromDate,
    incidentTo: c.IncidentToDate,
    briefFacts: c.BriefFacts,
    latitude: c.latitude,
    longitude: c.longitude,
    actSections: caseSections,
    counts: {
      complainants: mine(complainants).length,
      victims: mine(victims).length,
      accused: mine(accused).length,
    },
    parties: {
      complainants: mine(complainants).map((x: any) => ({ name: x.ComplainantName, age: x.AgeYear })),
      victims: mine(victims).map((x: any) => ({ name: x.VictimName, age: x.AgeYear })),
      accused: mine(accused).map((x: any) => ({ ref: x.PersonID, name: x.AccusedName, age: x.AgeYear, gender: x.GenderID })),
    },
  };
}
