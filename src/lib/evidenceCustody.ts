import { createHash } from "crypto";

/**
 * O.R.C.A — chain of custody integrity (SERVER-SIDE).
 *
 * A custody log that can be edited is not a custody log. Two rules make this
 * one defensible in front of a court:
 *
 *   1. APPEND ONLY. Nothing here updates or deletes a row, and no API route
 *      exposes such an operation. Correcting a mistake means appending a
 *      correcting event, exactly as a paper register is corrected.
 *
 *   2. HASH CHAINED. Each row stores the hash of the row before it, plus a hash
 *      of its own contents. Altering any earlier row — in the database, by
 *      anyone, including an administrator — breaks every hash after it, so
 *      tampering becomes DETECTABLE rather than merely discouraged.
 *
 * This does not make the log tamper-PROOF (an attacker with write access could
 * recompute the whole chain). It makes silent alteration impossible, which is
 * the achievable and useful property. A future improvement would be to publish
 * the head hash somewhere append-only outside Catalyst.
 */

/** Fields that are hashed. Order is fixed — changing it invalidates every chain. */
export interface CustodyPayload {
  evidenceId: number;
  seqNo: number;
  eventTypeId: number;
  fromEmployeeId: number | null;
  toEmployeeId: number | null;
  eventAt: string;
  location: string;
  remarks: string;
  recordedByUid: string;
  recordedAt: string;
}

/** The first row in a chain has no predecessor. */
export const GENESIS_HASH = "0".repeat(64);

/**
 * Canonical string form of a custody row.
 *
 * Deliberately explicit rather than JSON.stringify of the object: key order in
 * JS objects is not something to stake evidence integrity on, and a null must
 * hash differently from an empty string.
 */
export function canonicalise(p: CustodyPayload): string {
  const nn = (v: number | null) => (v === null || v === undefined ? "~" : String(v));
  return [
    `evidence=${p.evidenceId}`,
    `seq=${p.seqNo}`,
    `event=${p.eventTypeId}`,
    `from=${nn(p.fromEmployeeId)}`,
    `to=${nn(p.toEmployeeId)}`,
    `at=${p.eventAt}`,
    `loc=${p.location}`,
    `remarks=${p.remarks}`,
    `by=${p.recordedByUid}`,
    `rec=${p.recordedAt}`,
  ].join("|");
}

/** SHA-256 of the previous hash plus this row's canonical form. */
export function hashRow(prevHash: string, p: CustodyPayload): string {
  return createHash("sha256").update(`${prevHash}\n${canonicalise(p)}`).digest("hex");
}

export interface ChainRow extends CustodyPayload {
  prevHash: string;
  rowHash: string;
}

export type ChainProblem =
  | { kind: "SEQUENCE"; seqNo: number; detail: string }
  | { kind: "BROKEN_LINK"; seqNo: number; detail: string }
  | { kind: "ALTERED_ROW"; seqNo: number; detail: string };

export interface ChainVerdict {
  intact: boolean;
  rowsChecked: number;
  problems: ChainProblem[];
  /** Hash of the last row — the value to compare against an external record. */
  headHash: string | null;
}

/**
 * Verify a whole chain for one evidence item.
 *
 * Rows may arrive in any order; they are sorted by SeqNo first. The three
 * failure modes are reported separately because they mean different things:
 * a sequence gap suggests a row was DELETED, a broken link suggests one was
 * INSERTED or reordered, and an altered row means its contents changed.
 */
export function verifyChain(rows: ChainRow[]): ChainVerdict {
  const problems: ChainProblem[] = [];
  const ordered = [...rows].sort((a, b) => a.seqNo - b.seqNo);

  if (!ordered.length) {
    return { intact: true, rowsChecked: 0, problems: [], headHash: null };
  }

  let prev = GENESIS_HASH;

  ordered.forEach((row, i) => {
    const expectedSeq = i + 1;
    if (row.seqNo !== expectedSeq) {
      problems.push({
        kind: "SEQUENCE",
        seqNo: row.seqNo,
        detail: `expected sequence ${expectedSeq}, found ${row.seqNo} — a custody entry may have been removed`,
      });
    }

    if (row.prevHash !== prev) {
      problems.push({
        kind: "BROKEN_LINK",
        seqNo: row.seqNo,
        detail: "this entry does not follow the one before it — an entry may have been inserted or reordered",
      });
    }

    const recomputed = hashRow(row.prevHash, row);
    if (recomputed !== row.rowHash) {
      problems.push({
        kind: "ALTERED_ROW",
        seqNo: row.seqNo,
        detail: "the stored contents no longer match this entry's own hash — it has been altered since it was written",
      });
    }

    prev = row.rowHash;
  });

  return {
    intact: problems.length === 0,
    rowsChecked: ordered.length,
    problems,
    headHash: ordered[ordered.length - 1].rowHash,
  };
}

/**
 * Build the next row in a chain from the rows already stored.
 *
 * Takes the existing rows rather than a caller-supplied sequence number, so a
 * caller cannot accidentally (or deliberately) write a row out of order.
 */
export function nextChainRow(
  existing: ChainRow[],
  entry: Omit<CustodyPayload, "seqNo">
): ChainRow {
  const ordered = [...existing].sort((a, b) => a.seqNo - b.seqNo);
  const last = ordered[ordered.length - 1];
  const payload: CustodyPayload = { ...entry, seqNo: (last?.seqNo ?? 0) + 1 };
  const prevHash = last?.rowHash ?? GENESIS_HASH;
  return { ...payload, prevHash, rowHash: hashRow(prevHash, payload) };
}
