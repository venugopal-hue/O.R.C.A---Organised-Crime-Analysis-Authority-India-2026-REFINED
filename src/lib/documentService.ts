import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

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

/**
 * Register a newly generated ORCA report directly into Firestore collection `verified_documents`
 */
export async function registerReportInFirestore(record: VerifiedDocumentRecord): Promise<void> {
  if (typeof window !== "undefined") {
    const res = await fetch("/api/verification/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to register report in Firestore database.");
    }
  } else {
    const { adminDb } = await import("./firebaseAdmin");
    await adminDb.collection("verified_documents").doc(record.verificationId).set(record, { merge: true });
  }
}

/**
 * Lookup an authoritative document record by Verification ID directly from Firestore `verified_documents`
 */
export async function getReportFromFirestore(verificationId: string): Promise<VerifiedDocumentRecord | null> {
  if (typeof window === "undefined") {
    const { adminDb } = await import("./firebaseAdmin");
    const docSnap = await adminDb.collection("verified_documents").doc(verificationId).get();
    if (docSnap.exists) {
      return docSnap.data() as VerifiedDocumentRecord;
    }
    return null;
  } else {
    const docRef = doc(db, "verified_documents", verificationId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as VerifiedDocumentRecord;
    }
    return null;
  }
}
