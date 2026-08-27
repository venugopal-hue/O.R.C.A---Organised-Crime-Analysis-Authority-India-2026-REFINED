import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { listSecurityAlerts, acknowledgeSecurityAlert } from "@/lib/adminData";
import { listOfficerProfiles } from "@/lib/officerAccount";
import { denyWrite } from "@/lib/writeGuard";

/**
 * Unauthorised access warnings.
 *
 * GET   — every recorded alert, with the officer's name joined in.
 * PATCH — mark one as reviewed.
 *
 * Admin-only: these name officers and the networks they connected from.
 *
 * There is no DELETE, deliberately. A security warning that an administrator
 * can make disappear is not a record of anything — acknowledging one marks who
 * reviewed it and when, and the row stays.
 */

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req, "Security Center");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  try {
    const [alerts, officers] = await Promise.all([
      listSecurityAlerts(),
      listOfficerProfiles().catch(() => []),
    ]);

    const byUid = new Map(officers.map((o) => [o.firebaseUid, o]));
    const rows = alerts.map((a) => {
      const who = byUid.get(a.firebaseUid);
      return {
        ...a,
        // Falls back to the UID rather than inventing a name for an alert
        // raised by an account that has since been removed.
        officer: who?.name || a.firebaseUid || "Unattributed",
        badge: who?.kgid || "",
        district: who?.district || "",
      };
    });

    return NextResponse.json({
      success: true,
      alerts: rows,
      stats: {
        total: rows.length,
        lockedOut: rows.filter((r) => r.outcome === "LOCKED_OUT").length,
        warned: rows.filter((r) => r.outcome === "WARNED").length,
        unreviewed: rows.filter((r) => !r.acknowledgedAt).length,
        officers: new Set(rows.map((r) => r.firebaseUid)).size,
      },
    });
  } catch (err: any) {
    console.error("[security-alerts GET]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not read the security alerts." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await checkAdminAuth(req, "Security Center");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(admin, "operational");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const rowId = String(body.rowId || "").trim();
  if (!rowId) {
    return NextResponse.json({ success: false, error: "rowId is required." }, { status: 400 });
  }

  try {
    const who = admin.name || admin.email || "Command Administrator";
    const ok = await acknowledgeSecurityAlert(rowId, who);
    if (!ok) {
      return NextResponse.json({ success: false, error: "No such alert." }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Marked as reviewed." });
  } catch (err: any) {
    console.error("[security-alerts PATCH]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not update the alert." },
      { status: 500 }
    );
  }
}
