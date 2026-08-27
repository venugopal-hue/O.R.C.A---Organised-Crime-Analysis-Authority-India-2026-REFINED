import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import {
  CATEGORIES,
  UNITS,
  OWNER_ID_TYPES,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
} from "@/lib/propertyRegister";

/**
 * Everything the property register form needs to populate its selectors.
 *
 * GET /api/property/reference
 *
 * Districts and police stations come from the SAME Catalyst tables the rest of
 * the platform uses — 31 districts and 202 units already maintained there. A
 * new module inventing its own copy of that list is how two screens end up
 * disagreeing about which stations exist.
 *
 * Categories, units and statuses are code constants rather than tables: they
 * carry behaviour (which identifier label to show, whether decimals are
 * allowed) that a database row cannot express, and they change with the code
 * that reads them.
 */

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; payload: any } | null = null;

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  const constants = {
    categories: CATEGORIES,
    // NOT `units`: that name already belongs to police stations in this
    // payload, and two different meanings under one key is how a form ends up
    // offering "Kg" as a police station.
    quantityUnits: UNITS,
    ownerIdTypes: OWNER_ID_TYPES,
    reportTypes: REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] })),
    reportStatuses: REPORT_STATUSES.map((t) => ({ value: t, label: REPORT_STATUS_LABELS[t] })),
    itemStatuses: ITEM_STATUSES.map((t) => ({ value: t, label: ITEM_STATUS_LABELS[t] })),
  };

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, districts: [], units: [], ...constants });
  }

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.payload);
  }

  try {
    const [districtRows, unitRows] = await Promise.all([
      getAllRows("District"),
      getAllRows("Unit"),
    ]);

    const unwrap = (r: any, t: string) => r?.[t] || r || {};
    const active = (rec: any) => rec.Active !== false && String(rec.Active).toLowerCase() !== "false";

    const payload = {
      success: true,
      configured: true,
      districts: districtRows
        .map((r) => unwrap(r, "District"))
        .filter(active)
        .filter((d) => d.DistrictID != null)
        .map((d) => ({ id: Number(d.DistrictID), name: String(d.DistrictName || "") }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      // Stations carry their district so the form can narrow the list once a
      // district is chosen, rather than offering all 202 at once.
      units: unitRows
        .map((r) => unwrap(r, "Unit"))
        .filter(active)
        .filter((u) => u.UnitID != null)
        .map((u) => ({
          id: Number(u.UnitID),
          name: String(u.UnitName || ""),
          districtId: u.DistrictID != null ? Number(u.DistrictID) : null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...constants,
    };

    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("[property/reference] failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not load reference data.", ...constants },
      { status: 500 }
    );
  }
}
