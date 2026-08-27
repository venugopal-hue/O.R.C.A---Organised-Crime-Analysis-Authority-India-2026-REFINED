import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { createHash } from "crypto";
import { registerInLedger, isLedgerAvailable, LEDGER_TABLE } from "@/lib/verificationLedger";
import { getAllRows, nextId } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";

/**
 * POST /api/verification/register
 * Registers a generated document (AI intelligence brief, etc.) in the Catalyst
 * verification ledger so its printed barcode resolves.
 *
 * FIRs do NOT use this route — they are written to the ledger by
 * /api/fir/register at the moment the case is created.
 *
 * Previously this endpoint was unauthenticated and wrote the raw request body
 * straight into Firestore via the Admin SDK, which let anyone forge a
 * "VERIFIED" document record. It now requires an officer and accepts only a
 * whitelisted set of fields.
 */
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

  if (!isLedgerAvailable()) {
    return NextResponse.json(
      { success: false, error: "Catalyst is not connected; cannot register the document." },
      { status: 503 }
    );
  }

  try {
    const record = await req.json();

    const content = String(record?.content ?? "");
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, error: "content is required — the hash is computed from it." },
        { status: 400 }
      );
    }

    /**
     * THE REFERENCE AND THE HASH ARE PRODUCED HERE, NOT ACCEPTED.
     *
     * Both used to come from the browser, and the browser made them up:
     *
     *   reference   `ISD-CR-` + Math.floor(Math.random() * 8000) + 1000
     *   hash        one of THREE hard-coded SHA-256 strings, picked at random
     *
     * So two documents could carry the same reference, and every document
     * carried a hash that had nothing to do with its contents — while the
     * ledger recorded it as VERIFIED. Verification would then "confirm" a
     * document against a digest of nothing.
     *
     * The reference is now a serial from the ledger itself, and the hash is a
     * real SHA-256 of the exact text being sealed. A client-supplied hash is
     * ignored rather than trusted.
     */
    const serial = await nextId(LEDGER_TABLE, "VerificationID");
    const reference = `ISD-CR-${String(serial).padStart(5, "0")}`;
    const documentHash = createHash("sha256").update(content, "utf8").digest("hex");

    /**
     * A case number is attached ONLY when the case exists.
     *
     * The letterhead used to compose one from the random reference —
     * `FIR/2026/BLR/<random>` — and print it on a barcoded exhibit. That is a
     * citation to a case file that may belong to somebody else, or to nobody.
     * An intelligence brief with no case behind it now carries its own
     * reference and no crime number at all.
     */
    let crimeNo = "";
    let caseMasterId = 0;
    const requestedCase = String(record?.caseMasterId || "").trim();
    if (requestedCase) {
      const cases = await getAllRows("CaseMaster");
      const found = cases.find((c) => String(c.CaseMasterID) === requestedCase);
      if (!found) {
        return NextResponse.json(
          { success: false, error: `No case with CaseMasterID ${requestedCase}.` },
          { status: 400 }
        );
      }
      crimeNo = String(found.CrimeNo || "");
      caseMasterId = Number(found.CaseMasterID) || 0;
    }

    const written = await registerInLedger({
      VerificationID: String(serial),
      // Blank when the document is not a case file, rather than borrowing the
      // reference and making it look like a crime number.
      CrimeNo: crimeNo,
      CaseMasterID: caseMasterId,
      DocumentHash: documentHash,
      // Taken from the verified session, never from the request body.
      IssuedBy: officer.name || officer.email || "Officer",
      IssuedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      VerificationStatus: "VERIFIED",
    });

    if (!written) {
      return NextResponse.json(
        { success: false, error: "Failed to write the document to the verification ledger." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Document registered in the O.R.C.A Catalyst verification ledger.",
      verificationId: String(serial),
      reference,
      documentHash,
      crimeNo,
      issuedBy: officer.name || officer.email || "Officer",
      // The clearance the ISSUER actually holds — the letterhead used to print
      // a fixed "CLR: LEVEL-IV" on every document regardless of who made it.
      issuerClearance: officer.isdLevel || "",
    });
  } catch (error: any) {
    console.error("[Verification Register Error]:", error.message);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register document." },
      { status: 500 }
    );
  }
}
