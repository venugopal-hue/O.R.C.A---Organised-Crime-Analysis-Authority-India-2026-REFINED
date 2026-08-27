import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import {
  getOfficerProfile,
  OfficerAccountUnavailableError,
} from "@/lib/officerAccount";

/**
 * The signed-in officer's own profile, read from Catalyst.
 *
 * GET /api/officer/profile
 *
 * Firebase still authenticates. This route takes the UID from the verified
 * session and returns the Catalyst-side record joined to Employee — the
 * Firebase/Catalyst split agreed with the user.
 *
 * A caller can never ask for someone else's profile: there is no uid parameter,
 * by design. Reading another officer's record belongs behind an admin route
 * with its own role check.
 *
 * While the OfficerAccount table is still being built the route answers
 * `configured: false` rather than erroring, so callers can keep using the
 * Firestore profile. `profile: null` with `configured: true` genuinely means
 * "this officer has no Catalyst account row yet".
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await getOfficerProfile(officer.uid);
    return NextResponse.json({ success: true, configured: true, profile });
  } catch (error: any) {
    if (error instanceof OfficerAccountUnavailableError) {
      return NextResponse.json({
        success: true,
        configured: false,
        profile: null,
        reason: error.reason,
      });
    }
    console.error("[officer/profile]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read officer profile." },
      { status: 500 }
    );
  }
}
