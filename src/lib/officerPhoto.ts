/**
 * O.R.C.A — officer face captures stored in Catalyst (SERVER-SIDE ONLY).
 *
 * WHY CHUNKED ROWS
 * ----------------
 * The right home for an image is the Catalyst File Store, with the row holding
 * only a file id. Two things block that today:
 *
 *   1. File Store needs a scope the Self Client token does not carry
 *      (`GET /folder` returns OAUTH_SCOPE_MISMATCH).
 *   2. A Catalyst `text` column is CLAMPED TO 10,000 CHARACTERS. The API accepts
 *      `max_length: 1000000` and silently stores 10000 — verified by probing.
 *
 * A ~20 KB JPEG is ~27,000 base64 characters, so it cannot live in one column.
 * The capture is therefore split across rows of `OfficerPhoto`, ordered by
 * `ChunkIndex`, and reassembled on read. Metadata (size, mime, liveness
 * metrics) is written on chunk 0 only.
 *
 * Move to File Store once the scope is granted; `assemble()` is the only thing
 * that has to change.
 *
 * PRIVACY
 * -------
 * This is biometric data on identifiable police officers. It is stored once,
 * here, keyed by Firebase UID — not duplicated across three Firestore
 * collections as before. There is still no retention policy or deletion
 * schedule; that is a decision for the department, and `deletePhoto()` exists
 * so it can be enforced when one is set.
 */

import { getAllRows, insertRows, deleteRow, isCatalystConfigured, nextId } from "@/lib/catalyst";

export const PHOTO_TABLE = "OfficerPhoto";

/** Catalyst clamps `text` to this, whatever max_length is requested. */
const CHUNK_CHARS = 9000;

/**
 * Hard ceiling on a stored capture. At ~1.37 chars of base64 per byte this is
 * about 145 KB of image, or 22 chunks. The camera path produces far less; the
 * cap exists so a crafted request cannot write hundreds of rows.
 */
const MAX_CHARS = 200_000;

export class PhotoUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`Officer photo unavailable: ${reason}`);
    this.name = "PhotoUnavailableError";
  }
}

const isMissingTable = (err: any): boolean => {
  const m = String(err?.message || "");
  return m.includes("(404)") || /no such resource|does not exist|INVALID_URL_PATTERN/i.test(m);
};

const unwrap = (row: any) => (row && row[PHOTO_TABLE]) || row || {};
const str = (v: any) => (v === null || v === undefined ? "" : String(v));

function catalystDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function allChunks(): Promise<any[]> {
  if (!isCatalystConfigured()) throw new PhotoUnavailableError("Catalyst credentials are not set");
  try {
    return await getAllRows(PHOTO_TABLE);
  } catch (err: any) {
    if (isMissingTable(err)) throw new PhotoUnavailableError(`${PHOTO_TABLE} table does not exist yet`);
    throw err;
  }
}

export interface StoredPhoto {
  /** A complete `data:` URL, ready to drop into an <img src>. */
  dataUrl: string;
  byteSize: number;
  capturedAt: string;
  livenessMetrics: Record<string, any> | null;
}

function assemble(rows: any[]): StoredPhoto | null {
  if (!rows.length) return null;
  const ordered = [...rows].sort(
    (a, b) => Number(unwrap(a).ChunkIndex || 0) - Number(unwrap(b).ChunkIndex || 0)
  );
  const head = unwrap(ordered[0]);
  const expected = Number(head.ChunkCount || ordered.length);

  // A partial write (interrupted upload) must not render as a corrupt image.
  if (ordered.length < expected) return null;

  const base64 = ordered.map((r) => str(unwrap(r).ChunkData)).join("");
  if (!base64) return null;

  let metrics: Record<string, any> | null = null;
  try {
    metrics = head.LivenessMetrics ? JSON.parse(str(head.LivenessMetrics)) : null;
  } catch {
    metrics = null;
  }

  return {
    dataUrl: `data:${str(head.MimeType) || "image/jpeg"};base64,${base64}`,
    byteSize: Number(head.ByteSize || 0),
    capturedAt: str(head.CapturedAt),
    livenessMetrics: metrics,
  };
}

/** The stored capture for one officer, or null. */
export async function getPhoto(firebaseUid: string): Promise<StoredPhoto | null> {
  const uid = String(firebaseUid || "").trim();
  if (!uid) return null;
  const rows = (await allChunks()).filter((r) => str(unwrap(r).FirebaseUID) === uid);
  return assemble(rows);
}

/**
 * Captures for several officers at once — one table read instead of N.
 * Used by the admin console, which lists applicants side by side.
 */
export async function getPhotos(firebaseUids: string[]): Promise<Record<string, StoredPhoto>> {
  const wanted = new Set(firebaseUids.map((u) => String(u || "").trim()).filter(Boolean));
  if (!wanted.size) return {};

  const grouped = new Map<string, any[]>();
  for (const row of await allChunks()) {
    const uid = str(unwrap(row).FirebaseUID);
    if (!wanted.has(uid)) continue;
    if (!grouped.has(uid)) grouped.set(uid, []);
    grouped.get(uid)!.push(row);
  }

  const out: Record<string, StoredPhoto> = {};
  grouped.forEach((rows, uid) => {
    const photo = assemble(rows);
    if (photo) out[uid] = photo;
  });
  return out;
}

/** Remove every chunk belonging to an officer. Used before a replace, and for erasure. */
export async function deletePhoto(firebaseUid: string): Promise<number> {
  const uid = String(firebaseUid || "").trim();
  if (!uid) return 0;

  const rows = (await allChunks()).filter((r) => str(unwrap(r).FirebaseUID) === uid);
  let removed = 0;
  for (const row of rows) {
    const rowId = str(unwrap(row).ROWID || row.ROWID);
    if (!rowId) continue;
    // Leave whatever could not be removed; the caller reports the count.
    if (await deleteRow(PHOTO_TABLE, rowId)) removed++;
  }
  return removed;
}

/**
 * Store a capture, replacing any previous one for this officer.
 *
 * `dataUrl` must be a base64 `data:image/...` URL. The UID always comes from a
 * verified session at the call site — never from a request body.
 */
export async function savePhoto(
  firebaseUid: string,
  dataUrl: string,
  livenessMetrics: Record<string, any> | null
): Promise<{ chunks: number; byteSize: number }> {
  const uid = String(firebaseUid || "").trim();
  if (!uid) throw new Error("firebaseUid is required");

  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Expected a base64 data URL for a JPEG, PNG or WebP image.");

  const mimeType = match[1];
  const base64 = match[2];
  if (base64.length > MAX_CHARS) {
    throw new Error(`Image too large (${base64.length} chars, limit ${MAX_CHARS}).`);
  }

  // Replace rather than accumulate: an officer has one current capture.
  await deletePhoto(uid);

  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }

  const photoId = await nextId(PHOTO_TABLE, "PhotoID");
  const byteSize = Math.floor((base64.length * 3) / 4);
  const capturedAt = catalystDate();

  await insertRows(
    PHOTO_TABLE,
    chunks.map((data, index) => ({
      PhotoID: photoId,
      FirebaseUID: uid,
      ChunkIndex: index,
      ChunkCount: chunks.length,
      ChunkData: data,
      // Metadata rides on chunk 0 only; repeating it on every row would be waste.
      ...(index === 0
        ? {
            MimeType: mimeType,
            ByteSize: byteSize,
            CapturedAt: capturedAt,
            LivenessMetrics: livenessMetrics ? JSON.stringify(livenessMetrics).slice(0, 10000) : "",
          }
        : {}),
    }))
  );

  return { chunks: chunks.length, byteSize };
}
