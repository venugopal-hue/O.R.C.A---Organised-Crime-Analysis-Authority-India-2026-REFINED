import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { clientIp } from "@/lib/requestIp";
import {
  startSession,
  endSession,
  findOpenSession,
  TelemetryUnavailableError,
} from "@/lib/officerTelemetry";

/**
 * Session ingress / egress log.
 *
 * POST /api/auth/session-log   { action: "START" | "RESUME" | "END", sessionId?, reason? }
 *
 * START  - the officer signed in with a password.
 * RESUME - Firebase restored an existing sign-in (a reopened tab or browser).
 *          Adopts the open session rather than logging a login that did not
 *          happen; opens one only if there is nothing to adopt.
 * END    - sign-out, or the tab closing.
 *
 * SEC-06 — this route used to be UNAUTHENTICATED and took `uid`, `email` and
 * `name` straight from the request body, so anyone who could reach the URL
 * could write audit entries under any officer's name, or forge logout records
 * to cover a session. It is now authenticated, and the identity comes from the
 * verified session only. The body fields are ignored; the same rule as SEC-05.
 *
 * Sessions are recorded in Catalyst (`OfficerSession`) — that is what the
 * profile screen reads. The Firestore `audit_logs` write is kept alongside it
 * because the admin audit console still reads that collection; it is a mirror,
 * not the source of truth, and should go once that console moves over.
 */
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

  const action = String(body.action || "");
  const reason = String(body.reason || "");
  // Identity from the session, never the body.
  const uid = officer.uid;
  const operator = officer.name || officer.email || "Officer";
  const email = officer.email || "";

  try {
    if (action === "START" || action === "RESUME") {
      let rowId = "";
      let loginAt = "";
      try {
        // RESUME is sent when Firebase restores a sign-in rather than the
        // officer typing a password. Reopening the app, or opening a second
        // tab, must not look like a fresh login in the audit trail - so an
        // already-open session is adopted when there is one.
        const open = action === "RESUME" ? await findOpenSession(uid) : null;
        if (open) {
          return NextResponse.json({
            success: true,
            resumed: true,
            sessionId: "",
            rowId: open.rowId,
            loginAt: open.loginAt,
          });
        }

        const started = await startSession(uid, {
          ipAddress:
            clientIp(req),
          userAgent: req.headers.get("user-agent") || "",
        });
        rowId = started.rowId;
        loginAt = started.loginAt;
      } catch (err) {
        // A telemetry outage must not block sign-in.
        if (!(err instanceof TelemetryUnavailableError)) throw err;
        console.warn("[session-log] Catalyst session not recorded:", (err as Error).message);
      }

      let sessionId = "";
      if (adminDb) {
        const docRef = await adminDb.collection("audit_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "SESSION_INGRESS",
          action: "USER_LOGIN_SUCCESS",
          uid,
          operator,
          email,
          status: "ACTIVE",
          loginTime: new Date().toISOString(),
          logoutTime: null,
          duration: null,
        });
        sessionId = docRef.id;
      }

      return NextResponse.json({ success: true, sessionId, rowId, loginAt });
    }

    if (action === "END") {
      const rowId = String(body.rowId || "");
      if (rowId) {
        try {
          // Only closes a row belonging to this officer.
          await endSession(uid, rowId, reason);
        } catch (err) {
          if (!(err instanceof TelemetryUnavailableError)) throw err;
        }
      }

      const now = new Date();
      const loginTimeStr = req.headers.get("x-login-time") || "";
      let durationStr = "";
      if (loginTimeStr) {
        const start = new Date(loginTimeStr).getTime();
        const diffSecs = Math.max(0, Math.floor((now.getTime() - start) / 1000));
        const h = Math.floor(diffSecs / 3600);
        const m = Math.floor((diffSecs % 3600) / 60);
        const s = diffSecs % 60;
        durationStr = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
      }

      const sessionId = String(body.sessionId || "");
      if (adminDb) {
        if (sessionId) {
          // Confirm the document belongs to this officer before writing to it —
          // otherwise a caller could close somebody else's session record.
          const ref = adminDb.collection("audit_logs").doc(sessionId);
          const snap = await ref.get();
          if (snap.exists && (snap.data() || {}).uid === uid) {
            await ref.update({
              logoutTime: now.toISOString(),
              duration: durationStr,
              status: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "LOGOUT_COMPLETED",
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          await adminDb.collection("audit_logs").add({
            timestamp: FieldValue.serverTimestamp(),
            type: "SESSION_EGRESS",
            action: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "USER_LOGOUT",
            uid,
            operator,
            email,
            logoutTime: now.toISOString(),
            duration: durationStr,
            status: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "COMPLETED",
          });
        }
      }

      return NextResponse.json({ success: true, ended: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[Session Log API Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
