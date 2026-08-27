import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { normaliseIdentifier, isMatchable, MIN_MATCHABLE_IDENTIFIER } from "@/lib/propertyRegister";

/**
 * Identifier lookup across the property register.
 *
 * GET /api/property/matches?identifier=356938035643809
 *
 * WHAT THIS IS
 *
 * The reason a register earns its keep: a phone handed in today can be checked
 * against every phone reported stolen. Without it this is a filing cabinet.
 *
 * WHAT IT IS NOT
 *
 * It is not a finding. It reports that the SAME identifier string appears on
 * another report — nothing more. It does not conclude the items are the same
 * object, does not score confidence, and does not act.
 *
 * Two rules keep it honest:
 *
 *   1. EXACT normalised match only. No fuzzy matching, no partial matching, no
 *      matching on description or owner name. A near-match presented as a hit
 *      is an accusation the data does not support.
 *
 *   2. Short or degenerate identifiers are refused. A four-character "serial"
 *      collides with half the register by coincidence, and a confident-looking
 *      link between two unrelated reports is exactly the failure this platform
 *      has spent its time removing.
 */

const ITEMS = "PropertyItem";
const REPORTS = "PropertyReport";
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, matches: [] });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("identifier") || "";
  const exclude = (url.searchParams.get("exclude") || "").trim().toUpperCase();
  const normalised = normaliseIdentifier(raw);

  if (!normalised) {
    return NextResponse.json({ success: true, configured: true, matches: [], searched: "" });
  }
  if (!isMatchable(normalised)) {
    return NextResponse.json({
      success: true,
      configured: true,
      matches: [],
      searched: normalised,
      refused: `Too short or too generic to search. An identifier needs at least ${MIN_MATCHABLE_IDENTIFIER} letters or digits, and cannot be a single repeated character.`,
    });
  }

  try {
    const [itemRows, reportRows] = await Promise.all([
      getAllRows(ITEMS),
      getAllRows(REPORTS),
    ]);

    const reports = new Map<string, any>();
    for (const r of reportRows) {
      const row = unwrap(r, REPORTS);
      if (row.Reference) reports.set(String(row.Reference), row);
    }

    const matches = itemRows
      .map((r) => unwrap(r, ITEMS))
      .filter((r) => String(r.IdentifierNormalised || "") === normalised)
      .filter((r) => !exclude || String(r.ReportReference || "") !== exclude)
      .map((r) => {
        const report = reports.get(String(r.ReportReference)) || {};
        return {
          reference: String(r.ReportReference || ""),
          reportType: String(report.ReportType || ""),
          reportStatus: String(report.ReportStatus || ""),
          itemId: Number(r.ItemID || 0),
          category: String(r.Category || ""),
          itemDescription: String(r.ItemDescription || ""),
          identifierType: String(r.IdentifierType || ""),
          identifierValue: String(r.IdentifierValue || ""),
          itemStatus: String(r.ItemStatus || ""),
          placeOfIncident: String(report.PlaceOfIncident || ""),
          incidentFrom: String(report.IncidentFrom || ""),
          // Deliberately absent: owner name, contact and address. A match is a
          // pointer to a report, not a reason to surface a complainant's
          // personal details to whoever typed a number into a search box.
        };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference));

    return NextResponse.json({
      success: true,
      configured: true,
      searched: normalised,
      matches,
      basis:
        "Reports whose item carries this exact identifier, compared after removing spaces and punctuation. This says the same identifier was recorded twice — it is not a conclusion that the items are the same object.",
    });
  } catch (err: any) {
    console.error("[property/matches] failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Identifier search failed." },
      { status: 500 }
    );
  }
}
