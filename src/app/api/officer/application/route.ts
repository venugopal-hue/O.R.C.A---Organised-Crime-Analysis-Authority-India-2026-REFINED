import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { upsertApplication, listApplications, catalystNow } from "@/lib/adminData";
import { isCatalystConfigured } from "@/lib/catalyst";

/**
 * An officer's own registration application.
 *
 * POST — submit or re-submit. GET — read back your own.
 *
 * WHY THIS ROUTE EXISTS AT ALL
 *
 * Registration wrote three Firestore documents from the browser
 * (`pendingRegistrations`, `officers`, `officer_applications`), which the admin
 * console then read. Catalyst is server-side only, so the applicant's browser
 * cannot write `OfficerApplication` directly — hence this route.
 *
 * AUTHENTICATION IS DELIBERATELY DIFFERENT HERE
 *
 * Every other officer route uses `verifyOfficerRequest`, which requires an
 * approved officer profile or a role claim. An applicant has neither — that is
 * the entire point of applying. So this route verifies the Firebase ID token
 * directly: the caller has proved they own the account they just created, and
 * nothing more is claimed about them.
 *
 * The UID and email come from the verified token, never from the body. The same
 * rule as SEC-05: a caller must not be able to file an application under
 * somebody else's identity, which the old unauthenticated client-side write
 * allowed by construction.
 */

async function callerFromToken(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const fromCookie = cookie.match(/authToken=([^;]+)/)?.[1] || null;
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = fromCookie || (header.startsWith("Bearer ") ? header.slice(7) : null);
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || "" };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const caller = await callerFromToken(req);
  if (!caller) {
    return NextResponse.json(
      { success: false, error: "Sign-in required to submit an application." },
      { status: 401 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Catalyst is not connected; the application cannot be recorded." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const fullName = String(body.fullName || "").trim();
  if (!fullName) {
    return NextResponse.json({ success: false, error: "fullName is required." }, { status: 400 });
  }

  try {
    // Re-applying after a rejection is allowed and updates the same row. Being
    // re-considered after approval is not: that would quietly move an active
    // officer back to pending and strip them out of the directory.
    const existing = (await listApplications()).find((a) => a.firebaseUid === caller.uid);
    if (existing?.status === "approved") {
      return NextResponse.json(
        { success: false, error: "This account has already been approved." },
        { status: 409 }
      );
    }

    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const { applicationId, created } = await upsertApplication({
      firebaseUid: caller.uid,
      email: caller.email,
      fullName,
      /**
       * No `kgid` at all.
       *
       * The provisional `APP-…` id is derived from the ApplicationID inside
       * upsertApplication, where that id exists. Passing one here — even the
       * applicant's own — would defeat the point: the KGID is auto-serial, and
       * accepting input would let two people claim the same number or let
       * someone assert an id belonging to a serving officer.
       *
       * A re-application keeps the id it already has, because the upsert only
       * assigns on the create branch.
       */
      mobile: String(body.mobile || "").trim(),
      rankId: num(body.rankId),
      designationId: num(body.designationId),
      districtId: num(body.districtId),
      unitId: num(body.unitId),
      postingType: String(body.postingType || "").trim(),
      requestedAccess: String(body.requestedAccess || "").trim(),
      photoUrl: String(body.photoUrl || ""),
      status: "pending",
      submittedAt: catalystNow(),
      // A re-application clears the previous decision so the reviewer is not
      // looking at the last rejection's remarks while reading a new submission.
      reviewedBy: "",
      reviewedAt: "",
      remarks: "",
    });

    return NextResponse.json({
      success: true,
      applicationId,
      resubmitted: !created,
      message: created
        ? "Application submitted for administrative review."
        : "Application updated and returned to review.",
    });
  } catch (err: any) {
    console.error("[Officer Application Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not record the application." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const caller = await callerFromToken(req);
  if (!caller) {
    return NextResponse.json({ success: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    // Only ever their own row. There is deliberately no `uid` parameter —
    // reading somebody else's application belongs behind the admin route.
    const mine = (await listApplications()).find((a) => a.firebaseUid === caller.uid) || null;
    return NextResponse.json({ success: true, application: mine });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Could not read the application." },
      { status: 500 }
    );
  }
}
