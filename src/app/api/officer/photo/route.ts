import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest, verifyAdminRequest } from "@/lib/firebaseAdmin";
import {
  getPhoto,
  getPhotos,
  savePhoto,
  deletePhoto,
  PhotoUnavailableError,
} from "@/lib/officerPhoto";

/**
 * Officer face captures.
 *
 * GET    /api/officer/photo                  -> the caller's own capture
 * GET    /api/officer/photo?uid=<uid>        -> another officer's, ADMINS ONLY
 * GET    /api/officer/photo?uids=a,b,c       -> several, ADMINS ONLY (applications list)
 * POST   /api/officer/photo                  -> store the caller's capture
 * DELETE /api/officer/photo?uid=<uid>        -> erase, ADMINS ONLY
 *
 * The capture is written during registration, immediately after the Firebase
 * account is created — at that moment the applicant IS signed in, so the upload
 * is authenticated and the UID comes from the verified token rather than the
 * request body. That is what makes it possible to store this in Catalyst at all
 * without exposing a public upload endpoint.
 *
 * Reading someone else's face requires admin rights: it is biometric data, and
 * an officer-level session must not be able to enumerate colleagues' faces.
 */

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const uidParam = req.nextUrl.searchParams.get("uid");
  const uidsParam = req.nextUrl.searchParams.get("uids");

  try {
    // Own capture — the common case, no elevated rights needed.
    if (!uidParam && !uidsParam) {
      const photo = await getPhoto(officer.uid);
      return NextResponse.json({ success: true, configured: true, photo });
    }

    const admin = await verifyAdminRequest(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "ACCESS DENIED: viewing another officer's capture requires administrator rights." },
        { status: 403 }
      );
    }

    if (uidParam) {
      const photo = await getPhoto(uidParam);
      return NextResponse.json({ success: true, configured: true, photo });
    }

    // Cap the batch so one request cannot pull every stored face at once.
    const uids = uidsParam!.split(",").map((u) => u.trim()).filter(Boolean).slice(0, 50);
    const photos = await getPhotos(uids);
    return NextResponse.json({ success: true, configured: true, photos });
  } catch (error: any) {
    if (error instanceof PhotoUnavailableError) {
      return NextResponse.json({ success: true, configured: false, reason: error.reason, photo: null, photos: {} });
    }
    console.error("[officer/photo GET]", error);
    return NextResponse.json({ success: false, error: "Failed to read the capture." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const dataUrl = String(body.dataUrl || "");
  if (!dataUrl) {
    return NextResponse.json({ success: false, error: "dataUrl is required." }, { status: 400 });
  }

  try {
    // Always the caller's own UID. A body-supplied uid is ignored, not honoured.
    const result = await savePhoto(
      officer.uid,
      dataUrl,
      body.livenessMetrics && typeof body.livenessMetrics === "object" ? body.livenessMetrics : null
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof PhotoUnavailableError) {
      return NextResponse.json({ success: false, configured: false, reason: error.reason }, { status: 503 });
    }
    // Validation failures (wrong format, too large) are the caller's problem.
    return NextResponse.json({ success: false, error: error?.message || "Failed to store the capture." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdminRequest(req);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: erasing a capture requires administrator rights." },
      { status: 403 }
    );
  }

  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ success: false, error: "uid is required." }, { status: 400 });
  }

  try {
    const removed = await deletePhoto(uid);
    return NextResponse.json({ success: true, removed });
  } catch (error: any) {
    console.error("[officer/photo DELETE]", error);
    return NextResponse.json({ success: false, error: "Failed to erase the capture." }, { status: 500 });
  }
}
