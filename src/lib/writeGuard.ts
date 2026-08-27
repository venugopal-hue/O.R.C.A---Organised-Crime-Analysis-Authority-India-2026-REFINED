import { NextResponse } from "next/server";
import { canWrite, writeDenialReason, type WriteKind } from "@/lib/rbac";

/**
 * Refuse a write the caller's role does not permit.
 *
 * WHY THIS EXISTS
 *
 * RBAC gated which TABS rendered and nothing else. A role marked "read only"
 * would have been a label with nothing behind it: hiding a Save button does not
 * stop a POST, and every mutating route was reachable by any authenticated
 * officer regardless of role. The O.R.C.A Demonstration account is read-only
 * because this guard refuses its writes, not because its buttons are hidden.
 *
 * Returns a 403 response when the write is not allowed, or null when it is —
 * so a route reads:
 *
 *     const denied = denyWrite(officer, "operational");
 *     if (denied) return denied;
 *
 * `kind` matters: "config" covers system settings, AI parameters and anyone's
 * role or clearance; "operational" covers day-to-day records. O.R.C.A Support
 * may do the second and not the first.
 */
export function denyWrite(
  actor: { dashboardRole?: string | null; role?: string | null } | null | undefined,
  kind: WriteKind
): NextResponse | null {
  const role = actor?.dashboardRole || actor?.role || null;
  if (canWrite(role, kind)) return null;

  return NextResponse.json(
    {
      success: false,
      error: writeDenialReason(role, kind),
      // Lets a client show the right thing — "read only" is not a failure to
      // retry, it is the account working as intended.
      readOnly: true,
      requiredWrite: kind,
    },
    { status: 403 }
  );
}
