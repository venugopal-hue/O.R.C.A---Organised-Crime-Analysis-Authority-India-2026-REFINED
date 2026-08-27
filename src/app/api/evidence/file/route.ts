import { NextRequest, NextResponse } from "next/server";
import { denyWrite } from "@/lib/writeGuard";
import { createHash } from "crypto";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { uploadFile, downloadFile, EVIDENCE_FOLDER_ID } from "@/lib/catalyst";
import { recordFile, listFiles } from "@/lib/evidence";

/**
 * Evidence attachments - photos, video, PDFs.
 *
 * POST /api/evidence/file        multipart: file + evidenceId
 * GET  /api/evidence/file?id=..&evidence=..  streams the bytes back
 *
 * Bytes go to the Catalyst File Store (India DC), never into a table. A SHA-256
 * is taken on the way in and stored alongside, so the file can be proved
 * unaltered later - and stays provable across any future move to another store.
 *
 * The upload passes through this route rather than going browser-to-Catalyst,
 * so the Catalyst credentials never reach the client.
 */

/** Large enough for a body-cam clip, small enough to refuse an accident. */
const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected a file upload." }, { status: 400 });
  }

  const evidenceId = Number(form.get("evidenceId"));
  const file = form.get("file");

  if (!Number.isFinite(evidenceId) || !evidenceId) {
    return NextResponse.json({ success: false, error: "evidenceId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: `"${file.name}" is ${Math.round(file.size / 1024 / 1024)} MB. The limit is ${
          MAX_BYTES / 1024 / 1024
        } MB.`,
      },
      { status: 413 }
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const stored = await uploadFile(
      EVIDENCE_FOLDER_ID,
      file.name,
      bytes,
      file.type || "application/octet-stream"
    );

    const evidenceFileId = await recordFile(
      evidenceId,
      {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: bytes.length,
        fileStoreId: stored.id,
        folderId: EVIDENCE_FOLDER_ID,
        sha256,
      },
      officer.uid
    );

    return NextResponse.json({
      success: true,
      evidenceFileId,
      fileStoreId: stored.id,
      sha256,
      size: bytes.length,
    });
  } catch (error: any) {
    console.error("[evidence/file POST]", error);
    return NextResponse.json({ success: false, error: error?.message || "Upload failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const id = Number(params.get("id"));
  const evidenceId = Number(params.get("evidence"));
  if (!Number.isFinite(id) || !Number.isFinite(evidenceId)) {
    return NextResponse.json({ success: false, error: "id and evidence are required." }, { status: 400 });
  }

  try {
    // Look the record up rather than trusting a File Store id from the query -
    // otherwise anyone could pull any file in the folder by guessing an id.
    const meta = (await listFiles(evidenceId)).find((f) => f.evidenceFileId === id);
    if (!meta) return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });

    const bytes = await downloadFile(meta.folderId || EVIDENCE_FOLDER_ID, meta.fileStoreId);

    // Verify on the way out. A file that no longer matches its recorded hash is
    // not served as though nothing were wrong.
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (meta.sha256 && actual !== meta.sha256) {
      console.error("[evidence/file] INTEGRITY FAILURE", { id, expected: meta.sha256, actual });
      return NextResponse.json(
        { success: false, error: "Integrity check failed - this file does not match its recorded hash." },
        { status: 409 }
      );
    }

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": meta.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${meta.fileName.replace(/"/g, "")}"`,
        "Content-Length": String(bytes.length),
      },
    });
  } catch (error: any) {
    console.error("[evidence/file GET]", error);
    return NextResponse.json({ success: false, error: "Download failed." }, { status: 500 });
  }
}
