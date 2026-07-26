import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { action, uid, email, name, sessionId, reason } = await req.json();

    if (!adminDb) {
      return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });
    }

    if (action === "START") {
      const docRef = await adminDb.collection("audit_logs").add({
        timestamp: FieldValue.serverTimestamp(),
        type: "SESSION_INGRESS",
        action: "USER_LOGIN_SUCCESS",
        uid: uid || "unknown",
        operator: name || email || "Officer",
        email: email || "",
        status: "ACTIVE",
        loginTime: new Date().toISOString(),
        logoutTime: null,
        duration: null
      });

      return NextResponse.json({ success: true, sessionId: docRef.id });
    }

    if (action === "END") {
      const loginTimeStr = req.headers.get("x-login-time") || "";
      const now = new Date();
      let durationStr = "00h 01m 00s";

      if (loginTimeStr) {
        const start = new Date(loginTimeStr).getTime();
        const diffSecs = Math.floor((now.getTime() - start) / 1000);
        const h = Math.floor(diffSecs / 3600);
        const m = Math.floor((diffSecs % 3600) / 60);
        const s = diffSecs % 60;
        durationStr = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
      }

      if (sessionId) {
        await adminDb.collection("audit_logs").doc(sessionId).update({
          logoutTime: now.toISOString(),
          duration: durationStr,
          status: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "LOGOUT_COMPLETED",
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        await adminDb.collection("audit_logs").add({
          timestamp: FieldValue.serverTimestamp(),
          type: "SESSION_EGRESS",
          action: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "USER_LOGOUT",
          uid: uid || "unknown",
          operator: name || email || "Officer",
          email: email || "",
          logoutTime: now.toISOString(),
          duration: durationStr,
          status: reason === "VPN_LOCKDOWN" ? "VPN_FORCED_LOCKDOWN" : "COMPLETED"
        });
      }

      return NextResponse.json({ success: true, ended: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[Session Log API Error]:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
