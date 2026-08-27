import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/fir/masters
 * Returns every lookup list the Case Registration form needs, in one round trip.
 * Each list reports its own status so the form can show which reference data is
 * still empty rather than rendering a silently blank dropdown.
 */

// [Catalyst table, business id column, display column]
const LOOKUPS: [string, string, string][] = [
  ["CaseCategory", "CaseCategoryID", "LookupValue"],
  ["GravityOffence", "GravityOffenceID", "LookupValue"],
  ["CaseStatusMaster", "CaseStatusID", "CaseStatusName"],
  ["CrimeHead", "CrimeHeadID", "CrimeGroupName"],
  ["CrimeSubHead", "CrimeSubHeadID", "CrimeHeadName"],
  ["District", "DistrictID", "DistrictName"],
  ["Unit", "UnitID", "UnitName"],
  ["Court", "CourtID", "CourtName"],
  ["Employee", "EmployeeID", "FirstName"],
  ["Act", "ActCode", "ActDescription"],
  ["Section", "SectionCode", "SectionDescription"],
  ["OccupationMaster", "OccupationID", "OccupationName"],
  ["ReligionMaster", "ReligionID", "ReligionName"],
  ["CasteMaster", "caste_master_id", "caste_master_name"],
];

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({
      success: false,
      configured: false,
      error:
        "Catalyst is not connected. Add CATALYST_CLIENT_ID, CATALYST_CLIENT_SECRET and " +
        "CATALYST_REFRESH_TOKEN to .env.local to load reference data.",
      masters: {},
    });
  }

  const masters: Record<string, { options: { id: string; label: string; extra?: any }[]; error?: string }> = {};

  const loadOne = async ([table, idCol, labelCol]: [string, string, string]) => {
    try {
      const rows = await getAllRows(table);
      masters[table] = {
        options: rows
          .map((r: any) => {
            const rec = r[table] || r;
            return {
              id: String(rec[idCol] ?? ""),
              label: String(rec[labelCol] ?? rec[idCol] ?? ""),
              extra: rec,
            };
          })
          .filter((o) => o.id !== "")
          .sort((a, b) => a.label.localeCompare(b.label)),
      };
    } catch (err: any) {
      masters[table] = { options: [], error: err.message };
    }
  };

  // Loaded in small batches rather than all at once. Fourteen simultaneous
  // lookups (Section alone spans two pages) push Catalyst into rate-limiting,
  // and a throttled table returns empty — which reads to the officer as
  // "this dropdown is broken" rather than "try again".
  const BATCH = 4;
  for (let i = 0; i < LOOKUPS.length; i += BATCH) {
    await Promise.all(LOOKUPS.slice(i, i + BATCH).map(loadOne));
  }

  const empty = Object.entries(masters)
    .filter(([, v]) => v.options.length === 0 && !v.error)
    .map(([k]) => k);

  return NextResponse.json({
    success: true,
    configured: true,
    masters,
    emptyTables: empty,
  });
}
