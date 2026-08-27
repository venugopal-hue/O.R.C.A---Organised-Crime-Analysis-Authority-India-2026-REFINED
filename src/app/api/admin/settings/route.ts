import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { loadSettings, saveSettings, SETTING_SPECS } from "@/lib/systemSettings";
import { appendAudit } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";

/**
 * System settings.
 *
 * GET  — current values plus the catalogue that describes them.
 * PUT  — persist changed values and record each change in the audit trail.
 *
 * Admin-only in both directions. These values describe the security posture
 * (sign-in attempt limits, session timeout), so they are not readable by an
 * officer-level session either.
 *
 * Every accepted change is written to OfficerAuditLog with its old and new
 * value. The previous screen saved nothing at all, so there was nothing to
 * audit; now that settings persist, a silent change would be the bigger problem.
 */

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req, "System Settings");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json({
      success: true,
      settings: await loadSettings(),
      specs: SETTING_SPECS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Could not read system settings." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const admin = await checkAdminAuth(req, "System Settings");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  // Read-only and limited-write roles are refused here, not by hiding
  // controls — see writeGuard.ts.
  const denied = denyWrite(admin, "config");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const patch = body?.settings;
  if (!patch || typeof patch !== "object") {
    return NextResponse.json(
      { success: false, error: "Expected a `settings` object." },
      { status: 400 }
    );
  }

  try {
    const who = admin.name || admin.email || "Command Administrator";
    const { changed } = await saveSettings(patch, who);

    // One audit row per changed setting, not one for the whole save. A single
    // "settings updated" entry would not tell a reviewer what actually moved.
    for (const c of changed) {
      await appendAudit({
        firebaseUid: admin.uid,
        changeType: "SYSTEM_SETTING",
        oldValue: `${c.key}=${c.from}`,
        newValue: `${c.key}=${c.to}`,
        changedBy: who,
        reason: String(body.reason || "System settings updated from the admin console."),
      });
    }

    return NextResponse.json({
      success: true,
      changed,
      settings: await loadSettings(),
      message: changed.length
        ? `${changed.length} setting${changed.length === 1 ? "" : "s"} saved.`
        : "No changes to save.",
    });
  } catch (err: any) {
    console.error("[Admin Settings Save Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not save system settings." },
      { status: 500 }
    );
  }
}
