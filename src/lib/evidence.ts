import {
  getAllRows,
  insertRows,
  updateRows,
  isCatalystConfigured,
  nextId,
} from "@/lib/catalyst";
import { catalystDate } from "@/lib/officerTelemetry";
import {
  nextChainRow,
  verifyChain,
  type ChainRow,
  type ChainVerdict,
} from "@/lib/evidenceCustody";

/**
 * O.R.C.A — Evidence Registration data layer (SERVER-SIDE ONLY).
 *
 * Records physical and digital evidence against an existing FIR, and maintains
 * the append-only chain of custody in `evidenceCustody.ts`.
 *
 * Nothing here updates or deletes a custody row. Correcting a mistake means
 * appending a correcting event, the way a paper register is corrected.
 */

export const T_EVIDENCE = "Evidence";
export const T_FILE = "EvidenceFile";
export const T_CUSTODY = "EvidenceCustody";
export const T_TYPE = "EvidenceType";
export const T_STATUS = "EvidenceStatus";
export const T_EVENT = "CustodyEventType";

export class EvidenceUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`Evidence store unavailable: ${reason}`);
    this.name = "EvidenceUnavailableError";
  }
}

const isMissingTable = (err: any): boolean => {
  const m = String(err?.message || "");
  return m.includes("(404)") || /no such resource|does not exist|INVALID_URL_PATTERN/i.test(m);
};

const str = (v: any) => (v === null || v === undefined ? "" : String(v));
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function rows(table: string): Promise<any[]> {
  if (!isCatalystConfigured()) throw new EvidenceUnavailableError("Catalyst credentials are not set");
  try {
    return await getAllRows(table);
  } catch (err: any) {
    if (isMissingTable(err)) throw new EvidenceUnavailableError(`${table} table does not exist yet`);
    throw err;
  }
}

// ── Reference data ───────────────────────────────────────────────────────────

export interface Lookup { id: number; name: string }

const lookup = (list: any[], idCol: string, nameCol: string): Lookup[] =>
  list
    .filter((r) => num(r[idCol]) !== null)
    .map((r) => ({ id: Number(r[idCol]), name: str(r[nameCol]) }))
    .sort((a, b) => a.id - b.id);

export async function evidenceReference() {
  const [types, statuses, events, employees, cases] = await Promise.all([
    rows(T_TYPE).catch(() => []),
    rows(T_STATUS).catch(() => []),
    rows(T_EVENT).catch(() => []),
    rows("Employee").catch(() => []),
    rows("CaseMaster").catch(() => []),
  ]);

  return {
    types: lookup(types, "EvidenceTypeID", "TypeName"),
    statuses: lookup(statuses, "EvidenceStatusID", "StatusName"),
    events: lookup(events, "EventTypeID", "EventName"),
    officers: employees
      .filter((r) => num(r.EmployeeID) !== null)
      .map((r) => ({
        id: Number(r.EmployeeID),
        name: [str(r.FirstName), str(r.KGID) ? `(${str(r.KGID)})` : ""].filter(Boolean).join(" "),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    cases: cases
      .filter((r) => num(r.CaseMasterID) !== null)
      .map((r) => ({
        id: Number(r.CaseMasterID),
        crimeNo: str(r.CrimeNo),
        caseNo: str(r.CaseNo),
        registeredOn: str(r.CrimeRegisteredDate),
      }))
      .sort((a, b) => b.id - a.id),
  };
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export interface EvidenceRecord {
  evidenceId: number;
  evidenceNo: string;
  caseMasterId: number | null;
  evidenceTypeId: number | null;
  description: string;
  collectedAt: string;
  collectionPlace: string;
  latitude: number | null;
  longitude: number | null;
  sealNumber: string;
  quantity: string;
  collectedByEmployeeId: number | null;
  currentCustodianEmployeeId: number | null;
  evidenceStatusId: number | null;
  vehicleNumber: string;
  createdByUid: string;
  createdAt: string;
  rowId: string;
}

const toRecord = (r: any): EvidenceRecord => ({
  evidenceId: Number(r.EvidenceID),
  evidenceNo: str(r.EvidenceNo),
  caseMasterId: num(r.CaseMasterID),
  evidenceTypeId: num(r.EvidenceTypeID),
  description: str(r.Description),
  collectedAt: str(r.CollectedAt),
  collectionPlace: str(r.CollectionPlace),
  latitude: num(r.latitude),
  longitude: num(r.longitude),
  sealNumber: str(r.SealNumber),
  quantity: str(r.Quantity),
  collectedByEmployeeId: num(r.CollectedByEmployeeID),
  currentCustodianEmployeeId: num(r.CurrentCustodianEmployeeID),
  evidenceStatusId: num(r.EvidenceStatusID),
  vehicleNumber: str(r.VehicleNumber),
  createdByUid: str(r.CreatedByUID),
  createdAt: str(r.CreatedAt),
  rowId: str(r.ROWID),
});

export async function listEvidence(filter: { caseMasterId?: number | null } = {}) {
  const all = (await rows(T_EVIDENCE)).filter((r) => num(r.EvidenceID) !== null).map(toRecord);
  const filtered =
    filter.caseMasterId != null ? all.filter((e) => e.caseMasterId === filter.caseMasterId) : all;
  return filtered.sort((a, b) => b.evidenceId - a.evidenceId);
}

/**
 * Headline counts for the Evidence Management view.
 *
 * The groupings are a judgement about what each status MEANS operationally, so
 * they are written down here rather than buried in a component:
 *
 *   IN CUSTODY   the item is physically with the police right now
 *   AT FORENSICS it is away at the FSL
 *   IN COURT     it has been produced and is with the court
 *   CLOSED       it has permanently left police hands (returned or destroyed)
 *
 * Anything whose status falls outside these groups lands in `other` rather than
 * being quietly folded into a bucket it does not belong to - a headline number
 * that silently absorbs unknown states is worse than one that admits the gap.
 */
export const STATUS_GROUPS = {
  inCustody: [1, 2, 4, 6],   // Collected, In Malkhana, Returned from FSL, Returned from Court
  atForensics: [3],          // Sent to FSL
  inCourt: [5],              // Produced in Court
  closed: [7, 8],            // Released to Owner, Disposed
} as const;

export interface EvidenceStats {
  total: number;
  inCustody: number;
  atForensics: number;
  inCourt: number;
  closed: number;
  /** Items whose status matches none of the groups above. */
  other: number;
}

export function summarise(items: EvidenceRecord[]): EvidenceStats {
  const inAny = (id: number | null, group: readonly number[]) => id != null && group.includes(id);
  const stats: EvidenceStats = {
    total: items.length, inCustody: 0, atForensics: 0, inCourt: 0, closed: 0, other: 0,
  };
  for (const it of items) {
    const s = it.evidenceStatusId;
    if (inAny(s, STATUS_GROUPS.inCustody)) stats.inCustody++;
    else if (inAny(s, STATUS_GROUPS.atForensics)) stats.atForensics++;
    else if (inAny(s, STATUS_GROUPS.inCourt)) stats.inCourt++;
    else if (inAny(s, STATUS_GROUPS.closed)) stats.closed++;
    else stats.other++;
  }
  return stats;
}

export async function getEvidence(evidenceId: number): Promise<EvidenceRecord | null> {
  const all = await rows(T_EVIDENCE);
  const hit = all.find((r) => num(r.EvidenceID) === evidenceId);
  return hit ? toRecord(hit) : null;
}

/**
 * Evidence number: `EVD/<year>/<6-digit serial>`.
 *
 * Human-readable on purpose — it goes on a physical label attached to a sealed
 * packet, and an officer has to be able to read it back over a radio.
 */
function evidenceNoFor(serial: number, when: Date): string {
  return `EVD/${when.getFullYear()}/${String(serial).padStart(6, "0")}`;
}

export interface NewEvidence {
  caseMasterId: number;
  evidenceTypeId: number;
  description: string;
  collectedAt: string;
  collectionPlace: string;
  latitude: number | null;
  longitude: number | null;
  sealNumber: string;
  quantity: string;
  collectedByEmployeeId: number | null;
  custodianEmployeeId: number | null;
  eventTypeId: number;
  remarks: string;
  vehicleNumber: string;
}

/**
 * Register a new item and open its chain of custody.
 *
 * Catalyst has no transactions. The Evidence row is written FIRST and the
 * opening custody row second, so a failure between them leaves an item with no
 * chain — visible and reportable — rather than a custody entry pointing at
 * nothing. `evidenceWithoutChain()` finds any such orphan.
 */
export async function createEvidence(input: NewEvidence, officerUid: string) {
  const now = new Date();
  const evidenceId = await nextId(T_EVIDENCE, "EvidenceID");
  const evidenceNo = evidenceNoFor(evidenceId, now);

  await insertRows(T_EVIDENCE, [
    {
      EvidenceID: evidenceId,
      EvidenceNo: evidenceNo,
      CaseMasterID: input.caseMasterId,
      EvidenceTypeID: input.evidenceTypeId,
      Description: String(input.description || "").slice(0, 10000),
      CollectedAt: input.collectedAt,
      CollectionPlace: String(input.collectionPlace || "").slice(0, 255),
      latitude: input.latitude,
      longitude: input.longitude,
      SealNumber: String(input.sealNumber || "").slice(0, 255),
      Quantity: String(input.quantity || "").slice(0, 255),
      CollectedByEmployeeID: input.collectedByEmployeeId,
      CurrentCustodianEmployeeID: input.custodianEmployeeId,
      EvidenceStatusID: 1, // "Collected"
      VehicleNumber: String(input.vehicleNumber || "").trim().slice(0, 32),
      CreatedByUID: officerUid,
      CreatedAt: catalystDate(now),
    },
  ]);

  await appendCustody(
    evidenceId,
    {
      eventTypeId: input.eventTypeId,
      fromEmployeeId: null,
      toEmployeeId: input.custodianEmployeeId,
      eventAt: input.collectedAt,
      location: input.collectionPlace,
      remarks: input.remarks || "Evidence collected and registered.",
    },
    officerUid
  );

  return { evidenceId, evidenceNo };
}

// ── Chain of custody ─────────────────────────────────────────────────────────

export interface CustodyRow extends ChainRow {
  custodyId: number;
}

const toChainRow = (r: any): CustodyRow => ({
  custodyId: Number(r.CustodyID),
  evidenceId: Number(r.EvidenceID),
  seqNo: Number(r.SeqNo),
  eventTypeId: Number(r.EventTypeID),
  fromEmployeeId: num(r.FromEmployeeID),
  toEmployeeId: num(r.ToEmployeeID),
  eventAt: str(r.EventAt),
  location: str(r.Location),
  remarks: str(r.Remarks),
  recordedByUid: str(r.RecordedByUID),
  recordedAt: str(r.RecordedAt),
  prevHash: str(r.PrevHash),
  rowHash: str(r.RowHash),
});

export async function listCustody(evidenceId: number): Promise<CustodyRow[]> {
  const all = await rows(T_CUSTODY);
  return all
    .filter((r) => num(r.EvidenceID) === evidenceId)
    .map(toChainRow)
    .sort((a, b) => a.seqNo - b.seqNo);
}

export interface NewCustodyEvent {
  eventTypeId: number;
  fromEmployeeId: number | null;
  toEmployeeId: number | null;
  eventAt: string;
  location: string;
  remarks: string;
  /** Optional new status for the item, e.g. "Sent to FSL". */
  newStatusId?: number | null;
}

/**
 * Append one custody event. There is deliberately no update or delete
 * counterpart anywhere in this module.
 */
export async function appendCustody(
  evidenceId: number,
  entry: NewCustodyEvent,
  officerUid: string
): Promise<CustodyRow> {
  const existing = await listCustody(evidenceId);

  // The row is built from the STORED chain, so the sequence and the previous
  // hash cannot be supplied (or spoofed) by the caller.
  const built = nextChainRow(existing, {
    evidenceId,
    eventTypeId: entry.eventTypeId,
    fromEmployeeId: entry.fromEmployeeId,
    toEmployeeId: entry.toEmployeeId,
    eventAt: entry.eventAt,
    location: entry.location,
    remarks: entry.remarks,
    recordedByUid: officerUid,     // from the verified session, never the body
    recordedAt: catalystDate(),    // server clock, never the client's
  });

  const custodyId = await nextId(T_CUSTODY, "CustodyID");

  await insertRows(T_CUSTODY, [
    {
      CustodyID: custodyId,
      EvidenceID: built.evidenceId,
      SeqNo: built.seqNo,
      EventTypeID: built.eventTypeId,
      FromEmployeeID: built.fromEmployeeId,
      ToEmployeeID: built.toEmployeeId,
      EventAt: built.eventAt,
      Location: String(built.location || "").slice(0, 255),
      Remarks: String(built.remarks || "").slice(0, 10000),
      RecordedByUID: built.recordedByUid,
      RecordedAt: built.recordedAt,
      PrevHash: built.prevHash,
      RowHash: built.rowHash,
    },
  ]);

  // Keep the item's denormalised custodian/status in step with the chain.
  const evidenceRow = (await rows(T_EVIDENCE)).find((r) => num(r.EvidenceID) === evidenceId);
  if (evidenceRow?.ROWID) {
    const patch: Record<string, any> = { ROWID: evidenceRow.ROWID };
    if (entry.toEmployeeId != null) patch.CurrentCustodianEmployeeID = entry.toEmployeeId;
    if (entry.newStatusId != null) patch.EvidenceStatusID = entry.newStatusId;
    if (Object.keys(patch).length > 1) await updateRows(T_EVIDENCE, [patch]);
  }

  return { ...built, custodyId };
}

/** Verify one item's chain. */
export async function verifyEvidenceChain(evidenceId: number): Promise<ChainVerdict> {
  return verifyChain(await listCustody(evidenceId));
}

/**
 * Items whose chain is missing entirely.
 *
 * Catalyst has no transactions, so a failure between writing the Evidence row
 * and its opening custody row leaves an orphan. Reporting them is better than
 * pretending it cannot happen.
 */
export async function evidenceWithoutChain(): Promise<number[]> {
  const [items, custody] = await Promise.all([rows(T_EVIDENCE), rows(T_CUSTODY)]);
  const withChain = new Set(custody.map((r) => num(r.EvidenceID)));
  return items
    .map((r) => num(r.EvidenceID))
    .filter((id): id is number => id !== null && !withChain.has(id));
}

// ── Attachments ──────────────────────────────────────────────────────────────

export interface EvidenceFileRecord {
  evidenceFileId: number;
  evidenceId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileStoreId: string;
  folderId: string;
  sha256: string;
  uploadedByUid: string;
  uploadedAt: string;
}

export async function listFiles(evidenceId: number): Promise<EvidenceFileRecord[]> {
  const all = await rows(T_FILE);
  return all
    .filter((r) => num(r.EvidenceID) === evidenceId)
    .map((r) => ({
      evidenceFileId: Number(r.EvidenceFileID),
      evidenceId: Number(r.EvidenceID),
      fileName: str(r.FileName),
      mimeType: str(r.MimeType),
      sizeBytes: Number(r.SizeBytes) || 0,
      fileStoreId: str(r.FileStoreId),
      folderId: str(r.FolderId),
      sha256: str(r.Sha256),
      uploadedByUid: str(r.UploadedByUID),
      uploadedAt: str(r.UploadedAt),
    }))
    .sort((a, b) => a.evidenceFileId - b.evidenceFileId);
}

export async function recordFile(
  evidenceId: number,
  file: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    fileStoreId: string;
    folderId: string;
    sha256: string;
  },
  officerUid: string
) {
  const evidenceFileId = await nextId(T_FILE, "EvidenceFileID");
  await insertRows(T_FILE, [
    {
      EvidenceFileID: evidenceFileId,
      EvidenceID: evidenceId,
      FileName: String(file.fileName).slice(0, 255),
      MimeType: String(file.mimeType).slice(0, 255),
      SizeBytes: file.sizeBytes,
      FileStoreId: file.fileStoreId,
      FolderId: file.folderId,
      Sha256: file.sha256,
      UploadedByUID: officerUid,
      UploadedAt: catalystDate(),
    },
  ]);
  return evidenceFileId;
}
