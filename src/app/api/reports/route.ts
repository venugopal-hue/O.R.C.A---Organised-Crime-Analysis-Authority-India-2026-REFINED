import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/reports — every document sealed into the verification ledger.
 *
 * WHY THIS EXISTS
 *
 * The Reports tab listed five invented documents ("KSP ISD Annual
 * Counter-Terrorism Intelligence Assessment", 2.4 MB, SECRET) with working
 * download buttons. Removing them left the tab honest but permanently empty,
 * because nothing read the real table.
 *
 * `VerifiedDocument` is that table. A row is written every time a document is
 * sealed — it carries the crime number it belongs to, the SHA-256 of the
 * sealed content, who issued it and when. That is a real report repository and
 * it is what this returns.
 *
 * Classification is DERIVED from the verification status rather than stored:
 * the ledger has no classification column, and inventing one per row is how the
 * old list came to claim SECRET on documents nobody had classified.
 */

/** Case numbers are joined in so a report can be read without a second call. */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, reports: [] });
  }

  try {
    const [docs, cases] = await Promise.all([
      getAllRows("VerifiedDocument"),
      getAllRows("CaseMaster"),
    ]);

    const caseByOwnId = new Map(cases.map((c) => [String(c.CaseMasterID), c]));

    const reports = docs
      .map((d) => {
        const linked = caseByOwnId.get(String(d.CaseMasterID));
        const status = String(d.VerificationStatus || "").toUpperCase();
        return {
          id: String(d.VerificationID || d.ROWID),
          title: d.CrimeNo ? `Sealed document — Crime No. ${d.CrimeNo}` : "Sealed document",
          crimeNo: String(d.CrimeNo || linked?.CrimeNo || ""),
          caseMasterId: d.CaseMasterID ? String(d.CaseMasterID) : "",
          // Not a stored classification — see the note above.
          classification: status === "REVOKED" ? "REVOKED" : status || "ISSUED",
          author: String(d.IssuedBy || "—"),
          date: String(d.IssuedAt || d.CREATEDTIME || ""),
          documentHash: String(d.DocumentHash || ""),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ success: true, configured: true, reports });
  } catch (error: any) {
    console.error("[reports GET]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read the report ledger." },
      { status: 500 }
    );
  }
}
