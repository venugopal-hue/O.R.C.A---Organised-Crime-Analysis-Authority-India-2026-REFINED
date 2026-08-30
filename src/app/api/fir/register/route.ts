import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { insertRows, getAllRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { registerInLedger, verificationIdFor, documentHash } from "@/lib/verificationLedger";
import { denyWrite } from "@/lib/writeGuard";

/**
 * POST /api/fir/register
 * Registers a case across CaseMaster and its child tables in Catalyst.
 *
 * CrimeNo composition is fixed by the ER diagram:
 *   1 digit Case Category + 4 digit District + 4 digit Unit + 4 digit Year + 5 digit serial
 *   e.g. FIR 1 0443 0006 2026 00001  ->  104430006202600001
 * The serial runs separately per police station, per case category, per year.
 * CaseNo is the last 9 digits (YYYY + serial), exactly as documented.
 */

function pad(value: string | number, width: number): string {
  return String(value ?? "").replace(/\D/g, "").padStart(width, "0").slice(-width);
}

/*
 * NOT exported: a Next route module may only export request handlers and
 * the framework's own config keys. Exporting anything else fails the
 * production type check — Turbopack does not check it, webpack does.
 */
function buildCrimeNo(
  caseCategoryId: string | number,
  districtId: string | number,
  unitId: string | number,
  year: number,
  serial: number
): { crimeNo: string; caseNo: string } {
  const crimeNo =
    pad(caseCategoryId, 1) + pad(districtId, 4) + pad(unitId, 4) + pad(year, 4) + pad(serial, 5);
  return { crimeNo, caseNo: crimeNo.slice(-9) };
}

/**
 * Next running serial for this station + category + year.
 *
 * Reads CaseMaster over the row API and filters in memory, because the Self
 * Client token carries only ZohoCatalyst.tables.* scopes — /query needs
 * ZohoCatalyst.zcql.READ and returns OAUTH_SCOPE_MISMATCH without it.
 * Correct at current volumes; revisit with a WHERE clause once CaseMaster is large.
 */
async function nextSerial(unitId: string, caseCategoryId: string, year: number): Promise<number> {
  try {
    const rows = await getAllRows("CaseMaster");
    let max = 0;
    for (const r of rows) {
      const rec = (r as any).CaseMaster || r;
      if (String(rec.PoliceStationID ?? "") !== String(unitId)) continue;
      if (String(rec.CaseCategoryID ?? "") !== String(caseCategoryId)) continue;
      const crimeNo = String(rec.CrimeNo ?? "");
      if (crimeNo.length < 9) continue;
      if (Number(crimeNo.slice(-9, -5)) !== year) continue;
      max = Math.max(max, Number(crimeNo.slice(-5)) || 0);
    }
    return max + 1;
  } catch {
    return 1;
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error:
          "Catalyst is not connected. Add CATALYST_CLIENT_ID, CATALYST_CLIENT_SECRET and " +
          "CATALYST_REFRESH_TOKEN to .env.local before registering a case.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const c = body.caseMaster || {};

    // Minimum set the crime number and the record cannot be built without.
    const required = ["CaseCategoryID", "PoliceStationID", "CrimeRegisteredDate"];
    const missing = required.filter((f) => !c[f]);
    if (missing.length) {
      return NextResponse.json(
        { success: false, error: `Missing required field(s): ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const year = new Date(c.CrimeRegisteredDate).getFullYear() || new Date().getFullYear();
    const districtId = c.DistrictID || "0";
    const serial = await nextSerial(String(c.PoliceStationID), String(c.CaseCategoryID), year);
    const { crimeNo, caseNo } = buildCrimeNo(
      c.CaseCategoryID,
      districtId,
      c.PoliceStationID,
      year,
      serial
    );

    const caseMasterId = await nextId("CaseMaster", "CaseMasterID");

    const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
    const age = (v: any, label: string) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0 || n > 125) {
        throw new Error(`${label} age must be a whole number between 1 and 125.`);
      }
      return n;
    };

    /**
     * Catalyst DateTime columns want "YYYY-MM-DD HH:MM:SS".
     * The form's <input type="datetime-local"> produces "YYYY-MM-DDTHH:MM" -
     * a "T" separator and no seconds - which Catalyst rejects outright with
     * "Invalid input value for <col>. datetime value expected". Normalise here
     * rather than in the component, so any caller of this route is covered.
     */
    const dt = (v: any) => {
      const raw = String(v ?? "").trim();
      if (!raw) return null;
      const s = raw.replace("T", " ");
      return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? `${s}:00` : s;
    };

    const caseRow: Record<string, any> = {
      CaseMasterID: caseMasterId,
      CrimeNo: crimeNo,
      CaseNo: caseNo,
      CrimeRegisteredDate: c.CrimeRegisteredDate,
      PolicePersonID: num(c.PolicePersonID),
      PoliceStationID: num(c.PoliceStationID),
      CaseCategoryID: num(c.CaseCategoryID),
      GravityOffenceID: num(c.GravityOffenceID),
      CrimeMajorHeadID: num(c.CrimeMajorHeadID),
      CrimeMinorHeadID: num(c.CrimeMinorHeadID),
      CaseStatusID: num(c.CaseStatusID),
      CourtID: num(c.CourtID),
      IncidentFromDate: dt(c.IncidentFromDate),
      IncidentToDate: dt(c.IncidentToDate),
      InfoReceivedPSDate: dt(c.InfoReceivedPSDate),
      latitude: c.latitude === "" ? null : Number(c.latitude),
      longitude: c.longitude === "" ? null : Number(c.longitude),
      // Catalyst Text caps at 10,000 characters.
      BriefFacts: String(c.BriefFacts || "").slice(0, 10000),
    };
    Object.keys(caseRow).forEach((k) => caseRow[k] === null && delete caseRow[k]);

    await insertRows("CaseMaster", [caseRow]);

    // ── Child records ────────────────────────────────────────────────────
    const written: Record<string, number> = { CaseMaster: 1 };

    const complainants = (body.complainants || []).filter((x: any) => x.ComplainantName?.trim());
    if (complainants.length) {
      let id = await nextId("ComplainantDetails", "ComplainantID");
      await insertRows(
        "ComplainantDetails",
        complainants.map((x: any, i: number) => ({
          ComplainantID: id++,
          CaseMasterID: caseMasterId,
          ComplainantName: x.ComplainantName,
          AgeYear: age(x.AgeYear, `Complainant ${i + 1}`),
          OccupationID: num(x.OccupationID),
          ReligionID: num(x.ReligionID),
          CasteID: num(x.CasteID),
          GenderID: num(x.GenderID),
        }))
      );
      written.ComplainantDetails = complainants.length;
    }

    const victims = (body.victims || []).filter((x: any) => x.VictimName?.trim());
    if (victims.length) {
      let id = await nextId("Victim", "VictimMasterID");
      await insertRows(
        "Victim",
        victims.map((x: any, i: number) => ({
          VictimMasterID: id++,
          CaseMasterID: caseMasterId,
          VictimName: x.VictimName,
          AgeYear: age(x.AgeYear, `Victim ${i + 1}`),
          GenderID: num(x.GenderID),
          VictimPolice: x.VictimPolice || "0",
        }))
      );
      written.Victim = victims.length;
    }

    const accused = (body.accused || []).filter((x: any) => x.AccusedName?.trim());
    if (accused.length) {
      let id = await nextId("Accused", "AccusedMasterID");
      await insertRows(
        "Accused",
        accused.map((x: any, i: number) => ({
          AccusedMasterID: id++,
          CaseMasterID: caseMasterId,
          AccusedName: x.AccusedName,
          AgeYear: age(x.AgeYear, `Accused ${i + 1}`),
          GenderID: x.GenderID || "",       // holds M/F/T, hence text
          PersonID: x.PersonID || `A${i + 1}`,
        }))
      );
      written.Accused = accused.length;
    }

    const sections = (body.actSections || []).filter((x: any) => x.ActID && x.SectionID);
    if (sections.length) {
      await insertRows(
        "ActSectionAssociation",
        sections.map((x: any, i: number) => ({
          CaseMasterID: caseMasterId,
          ActID: String(x.ActID),           // Act.ActCode is VARCHAR
          SectionID: String(x.SectionID),   // Section.SectionCode is VARCHAR
          ActOrderID: i + 1,
          SectionOrderID: i + 1,
        }))
      );
      written.ActSectionAssociation = sections.length;
    }

    // Register the case in the verification ledger so a printed FIR's barcode
    // resolves. Done at registration, not at print, so every case is verifiable
    // whether or not anyone prints it — and reprints never duplicate the row.
    const verificationId = verificationIdFor(crimeNo);
    const ledgerWritten = await registerInLedger({
      VerificationID: verificationId,
      CrimeNo: crimeNo,
      CaseMasterID: caseMasterId,
      DocumentHash: documentHash({
        crimeNo,
        caseNo,
        policeStationId: c.PoliceStationID,
        caseCategoryId: c.CaseCategoryID,
        registeredDate: c.CrimeRegisteredDate,
        briefFacts: String(c.BriefFacts || ""),
      }),
      IssuedBy: officer.name || officer.email || "Officer",
      IssuedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      VerificationStatus: "VERIFIED",
    });

    return NextResponse.json({
      success: true,
      caseMasterId,
      verificationId,
      ledgerWritten,
      crimeNo,
      caseNo,
      serial,
      written,
      registeredBy: officer.name,
      message: `Case registered. Crime No ${crimeNo}`,
    });
  } catch (error: any) {
    console.error("[FIR Register Error]:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register case." },
      { status: 500 }
    );
  }
}
