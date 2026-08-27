/**
 * Client-side helper for registering a generated document in the O.R.C.A
 * verification ledger.
 *
 * The ledger now lives in Zoho Catalyst (table `VerifiedDocument`), not
 * Firestore. This module deliberately holds no database client of its own — it
 * posts to /api/verification/register, which authenticates the caller and
 * writes the row server-side. That is what stopped the old endpoint from
 * accepting forged "VERIFIED" records from anyone who could reach it.
 */

export interface VerifiedDocumentRecord {
  verificationId: string;
  caseNumber: string;
  reportReference: string;
  reportType: string;
  verificationStatus: string;
  issuingAuthority: string;
  officerName: string;
  officerRank: string;
  policeStation: string;
  district: string;
  classification: string;
  generatedAt: string;
  lastUpdated: string;
  reportHash?: string;
}

/** Register a generated report in the Catalyst verification ledger. */
export async function registerReportInLedger(record: VerifiedDocumentRecord): Promise<void> {
  const res = await fetch("/api/verification/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to register the document in the verification ledger.");
  }
}

/**
 * Kept under its previous name so existing callers continue to work.
 * @deprecated The ledger is Catalyst-backed now; prefer registerReportInLedger.
 */
export const registerReportInFirestore = registerReportInLedger;
