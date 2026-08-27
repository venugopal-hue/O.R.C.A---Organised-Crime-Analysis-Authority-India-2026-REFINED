import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { listAuditLogs } from "@/lib/adminData";
import { listOfficerProfiles } from "@/lib/officerAccount";

/**
 * Role-change history, read from OfficerAuditLog.
 *
 * WAS: two Firestore collections (`roleChangeLog` and `audit_logs`) merged,
 * with the audit rows reshaped to look like role changes — every one of them
 * was given `oldIsdLevel: "ISD-LEVEL-I"` and `newIsdLevel: "ISD-LEVEL-I"`
 * regardless of what had happened, so a sign-in appeared in the role-change
 * table as a clearance change that never took place.
 *
 * SECURITY — the previous version contained an authentication bypass:
 *
 *     if (token.includes("demo-token") || token.includes("admin")) isAllowed = true;
 *
 * Any bearer token whose text happened to contain the substring "admin" was
 * accepted as an administrator, without verification. That is removed; the only
 * way through is a verified admin session.
 */
export async function GET(req: NextRequest) {
  const caller = await checkAdminAuth(req, "AuditLogs");
  if (!caller) {
    return NextResponse.json(
      { success: false, logs: [], error: "PERMISSION_DENIED: Administrative clearance required." },
      { status: 403 }
    );
  }

  try {
    const [entries, officers] = await Promise.all([
      listAuditLogs(),
      listOfficerProfiles().catch(() => []),
    ]);

    const nameOf = (uid: string) =>
      officers.find((o) => o.firebaseUid === uid)?.name || uid || "—";

    // Only the two change types that actually carry a role and a clearance.
    // A profile edit or an account suspension lives in the same table but has
    // no role transition to show, and padding it out with placeholder levels is
    // precisely what the old route did.
    const ROLE_CHANGES = new Set(["REGISTRATION_APPROVED", "ROLE_CHANGE"]);

    /** Pulls `key=value` out of the audit row's `a=1; b=2` encoding. */
    const field = (blob: string, key: string) =>
      new RegExp(`(?:^|;\\s*)${key}=([^;]*)`).exec(blob || "")?.[1]?.trim() || "";

    const logs = entries
      .filter((e) => ROLE_CHANGES.has(e.changeType))
      .slice(0, 100)
      .map((e) => ({
        id: String(e.logId ?? ""),
        targetUid: e.firebaseUid,
        name: nameOf(e.firebaseUid),
        changedBy: e.changedBy,
        changeType: e.changeType,
        // Blank where the entry genuinely records no previous value — an
        // approval has no "old role" because the officer had none.
        oldRole: field(e.oldValue, "role"),
        newRole: field(e.newValue, "role"),
        oldIsdLevel: field(e.oldValue, "clearance"),
        newIsdLevel: field(e.newValue, "clearance"),
        oldValue: e.oldValue,
        newValue: e.newValue,
        reason: e.reason,
        timestamp: e.changedAt,
      }));

    return NextResponse.json(
      { success: true, logs },
      { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=15" } }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, logs: [], error: err.message }, { status: 500 });
  }
}
