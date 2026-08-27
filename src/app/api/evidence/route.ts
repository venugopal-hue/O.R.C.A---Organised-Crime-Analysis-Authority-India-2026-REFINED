import { NextRequest, NextResponse } from "next/server";
import { denyWrite } from "@/lib/writeGuard";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import {
  listEvidence,
  createEvidence,
  evidenceReference,
  evidenceWithoutChain,
  summarise,
  EvidenceUnavailableError,
} from "@/lib/evidence";
import { validateEvidenceForm, isVehicleType } from "@/lib/evidenceValidation";

/**
 * Evidence register.
 *
 * GET  /api/evidence            -> { rows, reference, orphans }
 * POST /api/evidence            -> registers an item AND opens its chain
 *
 * The officer's identity comes from the verified session and is never accepted
 * from the body (SEC-05/06).
 */

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  try {
    const url = new URL(req.url);
    const caseParam = url.searchParams.get("case");
    const caseMasterId = caseParam ? Number(caseParam) : null;

    const [rows, reference, orphans] = await Promise.all([
      listEvidence({ caseMasterId: Number.isFinite(caseMasterId as number) ? caseMasterId : null }),
      evidenceReference(),
      evidenceWithoutChain().catch(() => []),
    ]);

    return NextResponse.json({
      success: true, configured: true, rows, reference, orphans,
      stats: summarise(rows),
    });
  } catch (error: any) {
    if (error instanceof EvidenceUnavailableError) {
      return NextResponse.json({
        success: true,
        configured: false,
        reason: error.reason,
        rows: [],
        reference: null,
        orphans: [],
        stats: { total: 0, inCustody: 0, atForensics: 0, inCourt: 0, closed: 0, other: 0 },
      });
    }
    console.error("[evidence GET]", error);
    return NextResponse.json({ success: false, error: "Failed to read the evidence register." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const n = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

  /**
   * Validated with the SAME rules the form uses.
   *
   * The two used to disagree: the form checked one field and this route checked
   * four, so a form could pass its own check and still be refused here — and,
   * worse, a request that skipped the form entirely could store an exhibit with
   * no location, no seal number and no custodian.
   *
   * The evidence types are read for this, because "is it a vehicle" is resolved
   * by NAME through the lookup rather than by a hardcoded id.
   */
  let types: { id: number; name: string }[] = [];
  try {
    types = (await evidenceReference()).types;
  } catch {
    // A reference outage must not let an incomplete record through, so
    // validation proceeds with an empty type list: every unconditional field is
    // still enforced, and vehicleRequired simply resolves false.
  }

  const { errors, ok } = validateEvidenceForm(body, types);
  if (!ok) {
    const first = Object.keys(errors)[0];
    return NextResponse.json(
      {
        success: false,
        // The first message reads naturally in the UI banner; `fields` lets the
        // client mark every offending control at once.
        error: errors[first],
        fields: errors,
      },
      { status: 400 }
    );
  }

  try {
    const created = await createEvidence(
      {
        caseMasterId: Number(body.caseMasterId),
        evidenceTypeId: Number(body.evidenceTypeId),
        description: String(body.description),
        collectedAt: String(body.collectedAt).replace("T", " ").slice(0, 19).padEnd(19, ":00").slice(0, 19),
        collectionPlace: String(body.collectionPlace || ""),
        latitude: n(body.latitude),
        longitude: n(body.longitude),
        sealNumber: String(body.sealNumber || ""),
        quantity: String(body.quantity || ""),
        collectedByEmployeeId: n(body.collectedByEmployeeId),
        custodianEmployeeId: n(body.custodianEmployeeId),
        eventTypeId: n(body.eventTypeId) || 1,
        remarks: String(body.remarks || ""),
        /**
         * Only stored when the evidence IS a vehicle.
         *
         * The form hides the field for other types and clears the value on a
         * type change, but that is a CLIENT guarantee and this route does not
         * depend on it: a stale or hand-crafted body must not be able to put a
         * registration mark on a knife. Dropped here rather than rejected, so
         * a request that carries a leftover value still succeeds — it just
         * does not record the part that does not apply.
         */
        vehicleNumber: isVehicleType(body.evidenceTypeId, types)
          ? String(body.vehicleNumber || "")
          : "",
      },
      officer.uid
    );
    return NextResponse.json({ success: true, ...created });
  } catch (error: any) {
    if (error instanceof EvidenceUnavailableError) {
      return NextResponse.json({ success: false, error: error.reason }, { status: 503 });
    }
    console.error("[evidence POST]", error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to register evidence." }, { status: 500 });
  }
}
