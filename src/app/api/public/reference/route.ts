import { NextResponse } from "next/server";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * Reference lists the REGISTRATION form needs, before anyone is signed in.
 *
 * GET /api/public/reference
 *
 * Why a separate public route: /api/fir/reference requires a verified officer,
 * and registration happens before an officer exists. This one is deliberately
 * narrow:
 *
 *   - Read only. No POST.
 *   - A fixed whitelist of three tables. No table name comes from the caller,
 *     so it cannot be pointed at CaseMaster or anything holding personal data.
 *   - Only id + name + the ordering column are returned, never whole rows.
 *
 * What it exposes is district names, police station names and rank names —
 * public information about a public police force, and the same lists the form
 * previously hardcoded.
 */

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; payload: any } | null = null;

export async function GET() {
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, districts: [], units: [], ranks: [] });
  }

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const [districts, units, ranks] = await Promise.all([
      getAllRows("District"),
      getAllRows("Unit"),
      getAllRows("Rank"),
    ]);

    const unwrap = (r: any, t: string) => r?.[t] || r || {};
    const active = (rec: any) => rec.Active !== false && String(rec.Active).toLowerCase() !== "false";

    const payload = {
      success: true,
      configured: true,
      districts: districts
        .map((r) => unwrap(r, "District"))
        .filter(active)
        .map((d) => ({ id: Number(d.DistrictID), name: String(d.DistrictName || "") }))
        .filter((d) => d.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
      units: units
        .map((r) => unwrap(r, "Unit"))
        .filter(active)
        .map((u) => ({
          id: Number(u.UnitID),
          name: String(u.UnitName || ""),
          districtId: u.DistrictID != null ? Number(u.DistrictID) : null,
        }))
        .filter((u) => u.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
      // Hierarchy comes along because the form derives ISD clearance from it —
      // see src/lib/clearance.ts. Lower number = higher rank, per the ER diagram.
      ranks: ranks
        .map((r) => unwrap(r, "Rank"))
        .filter(active)
        .map((r) => ({
          id: Number(r.RankID),
          name: String(r.RankName || ""),
          hierarchy: Number(r.Hierarchy),
        }))
        .filter((r) => r.name)
        .sort((a, b) => a.hierarchy - b.hierarchy),
    };

    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (error: any) {
    // The form must still render if Catalyst is unreachable.
    console.error("[public/reference]", error);
    return NextResponse.json({ success: false, configured: false, districts: [], units: [], ranks: [] });
  }
}
