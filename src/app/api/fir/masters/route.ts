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

type MasterOption = { id: string; label: string; extra: any };

const str = (v: any) => String(v ?? "").trim();
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function optionLabel(table: string, rec: any, idCol: string, labelCol: string): string {
  if (table === "Employee") {
    const name = str(rec.FirstName);
    const kgid = str(rec.KGID);
    return [name || str(rec[idCol]), kgid ? `KGID ${kgid}` : ""]
      .filter(Boolean)
      .join(" - ");
  }
  return String(rec[labelCol] ?? rec[idCol] ?? "");
}

function isActiveAccount(rec: any): boolean {
  const active = String(rec.Active ?? "").toLowerCase();
  const status = String(rec.AccountStatus ?? rec.Status ?? "").toLowerCase();
  return (active === "true" || active === "1") && (!status || status === "active");
}

async function activeEmployeeIds(): Promise<Set<string>> {
  try {
    const accounts = await getAllRows("OfficerAccount");
    return new Set(
      accounts
        .map((r: any) => r.OfficerAccount || r)
        .filter(isActiveAccount)
        .map((a: any) => str(a.EmployeeID))
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

function dedupeEmployees(options: MasterOption[], linkedIds: Set<string>): MasterOption[] {
  const groups = new Map<string, MasterOption[]>();

  for (const option of options) {
    const kgid = str(option.extra?.KGID).toLowerCase();
    const key = kgid ? `kgid:${kgid}` : `employee:${option.id}`;
    groups.set(key, [...(groups.get(key) || []), option]);
  }

  return [...groups.values()]
    .map((group) =>
      group.sort((a, b) => {
        const aLinked = linkedIds.has(a.id) ? 1 : 0;
        const bLinked = linkedIds.has(b.id) ? 1 : 0;
        if (aLinked !== bLinked) return bLinked - aLinked;
        return num(b.extra?.EmployeeID ?? b.id) - num(a.extra?.EmployeeID ?? a.id);
      })[0]
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

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
      let options = rows
        .map((r: any) => {
          const rec = r[table] || r;
          return {
            id: String(rec[idCol] ?? ""),
            label: optionLabel(table, rec, idCol, labelCol),
            extra: rec,
          };
        })
        .filter((o) => o.id !== "")
        .sort((a, b) => a.label.localeCompare(b.label));

      if (table === "Employee") {
        options = dedupeEmployees(options, await activeEmployeeIds());
      }

      masters[table] = { options };
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
