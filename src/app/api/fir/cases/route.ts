import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { caseDetailView, listCaseViews } from "@/lib/firCaseView";

/**
 * GET /api/fir/cases                     — raw CaseMaster rows, newest first
 * GET /api/fir/cases?id=<CaseMasterID>   — one raw row with its child records
 * GET /api/fir/cases?view=console        — the same list, joined and renamed
 * GET /api/fir/cases?view=console&id=…   — one case, joined and renamed
 *
 * TWO SHAPES, ON PURPOSE.
 *
 * The Case Ledger prints FIR letterheads and needs the columns as stored —
 * PoliceStationID, CourtID, latitude, longitude — which it resolves against
 * reference options it already holds. Flattening those away to suit another
 * screen would silently strip fields off every printed FIR.
 *
 * The case workspace on the Forensic Evidence Copilot tab needs the opposite:
 * `district`, `severity`, `summary`. It was handed the raw rows and read those
 * names off them, so every field arrived undefined and the tab crashed on
 * `district.toUpperCase()` — invisible so far only because CaseMaster is empty.
 *
 * `view=console` serves that screen. See src/lib/firCaseView.ts for the fields
 * that were dropped because nothing in the schema records them.
 *
 * Child rows are filtered in memory rather than with a WHERE clause because the
 * Self Client token carries only ZohoCatalyst.tables.* scopes; /query needs
 * ZohoCatalyst.zcql.READ. Correct at current volumes.
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, configured: false, cases: [] });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    const console_ = req.nextUrl.searchParams.get("view") === "console";

    if (console_) {
      if (!id) {
        return NextResponse.json({
          success: true,
          configured: true,
          cases: await listCaseViews(),
        });
      }
      const detail = await caseDetailView(id);
      if (!detail) {
        return NextResponse.json(
          { success: false, error: `No case with CaseMasterID ${id}.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, configured: true, case: detail });
    }

    const cases = await getAllRows("CaseMaster");

    // Newest first, by registration date then by ID.
    const sorted = [...cases].sort((a, b) => {
      const d = String(b.CrimeRegisteredDate || "").localeCompare(String(a.CrimeRegisteredDate || ""));
      return d !== 0 ? d : Number(b.CaseMasterID || 0) - Number(a.CaseMasterID || 0);
    });

    if (!id) {
      return NextResponse.json({ success: true, configured: true, cases: sorted });
    }

    const target = cases.find((c) => String(c.CaseMasterID) === String(id));
    if (!target) {
      return NextResponse.json({ success: false, error: `No case with CaseMasterID ${id}.` }, { status: 404 });
    }

    const [complainants, victims, accused, actSections] = await Promise.all([
      getAllRows("ComplainantDetails"),
      getAllRows("Victim"),
      getAllRows("Accused"),
      getAllRows("ActSectionAssociation"),
    ]);

    const mine = (rows: any[]) => rows.filter((r) => String(r.CaseMasterID) === String(id));

    return NextResponse.json({
      success: true,
      configured: true,
      case: target,
      complainants: mine(complainants),
      victims: mine(victims),
      accused: mine(accused),
      actSections: mine(actSections),
    });
  } catch (error: any) {
    console.error("[FIR Cases Error]:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load cases." },
      { status: 500 }
    );
  }
}
