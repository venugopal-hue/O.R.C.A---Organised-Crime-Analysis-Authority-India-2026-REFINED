import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";
import { listOfficerProfiles, OfficerAccountUnavailableError } from "@/lib/officerAccount";
import {
  listApplications,
  listAuditLogs,
  listVerifications,
  listFailedScans,
  listSessions,
  listActivity,
  loadReference,
} from "@/lib/adminData";
import {
  buildSecurityEvents,
  buildPlatformAnalytics,
  buildNotifications,
  buildAiQueries,
  summariseAiQueries,
  SECURITY_BLIND_SPOTS,
} from "@/lib/adminInsights";
import { evidenceWithoutChain } from "@/lib/evidence";
import { loadSettings, SETTING_SPECS } from "@/lib/systemSettings";

/**
 * Everything the admin console needs, in one request.
 *
 * The console used to call `loadAdminData()` on EVERY tab change, and that
 * function ran five Firestore collection reads in series. Switching between the
 * thirteen admin tabs re-read the whole database each time, which is what made
 * the section feel slow. One endpoint, called once, fixes that: Catalyst's row
 * cache then collapses the overlapping table scans behind it.
 *
 * `?section=` narrows the response when a screen only needs part of it — used
 * by the refresh buttons so a single tab does not re-read everything.
 *
 * Admin-only. Officer-level sessions get 403: this returns every officer's
 * sign-in history and source addresses, which is not officer-level data.
 */

const SECTIONS = [
  "officers",
  "applications",
  "audit",
  "verification",
  "sessions",
  "analytics",
  "security",
  "notifications",
  "settings",
  "reference",
  "ai",
] as const;
type Section = (typeof SECTIONS)[number];

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req, "Administration");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({
      success: true,
      configured: false,
      error: "Catalyst credentials are not set — the console cannot reach the database.",
    });
  }

  const requested = (req.nextUrl.searchParams.get("section") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Section[];
  const wants = (s: Section) => requested.length === 0 || requested.includes(s);

  try {
    // Fetched together rather than in series. They overlap heavily — security,
    // analytics and notifications are all derived from the same sessions and
    // activity rows — and catalyst.ts de-duplicates concurrent scans of the
    // same table into one request, so asking for all of it costs one scan each.
    const needsOfficers =
      wants("officers") || wants("security") || wants("analytics") || wants("notifications") || wants("ai");
    const needsSessions = wants("sessions") || wants("security") || wants("analytics") || wants("notifications");
    const needsActivity = wants("analytics") || wants("ai");
    const needsApplications = wants("applications") || wants("notifications");
    const needsVerification = wants("verification") || wants("analytics");

    let officersUnavailable = "";
    const [officers, applications, audit, verifications, failedScans, sessions, activity] =
      await Promise.all([
        needsOfficers
          ? listOfficerProfiles().catch((e) => {
              if (e instanceof OfficerAccountUnavailableError) {
                officersUnavailable = e.reason;
                return [];
              }
              throw e;
            })
          : Promise.resolve([]),
        needsApplications ? listApplications() : Promise.resolve([]),
        wants("audit") ? listAuditLogs() : Promise.resolve([]),
        needsVerification ? listVerifications() : Promise.resolve([]),
        wants("verification") ? listFailedScans() : Promise.resolve([]),
        needsSessions ? listSessions() : Promise.resolve([]),
        needsActivity ? listActivity() : Promise.resolve([]),
      ]);

    const payload: Record<string, any> = { success: true, configured: true };

    if (wants("reference")) payload.reference = await loadReference();

    if (wants("officers")) {
      payload.officers = officers;
      if (officersUnavailable) payload.officersUnavailable = officersUnavailable;
    }
    if (wants("applications")) payload.applications = applications;
    if (wants("audit")) payload.audit = audit;
    if (wants("verification")) {
      payload.verifications = verifications;
      payload.failedScans = failedScans;
    }
    if (wants("sessions")) payload.sessions = sessions;

    const security =
      wants("security") || wants("notifications")
        ? buildSecurityEvents(sessions, officers)
        : [];
    if (wants("security")) {
      payload.security = security;
      payload.securityBlindSpots = SECURITY_BLIND_SPOTS;
    }

    if (wants("analytics")) {
      const [cases, evidence] = await Promise.all([
        getAllRows("CaseMaster").catch(() => []),
        getAllRows("Evidence").catch(() => []),
      ]);
      payload.analytics = buildPlatformAnalytics({
        activity,
        sessions,
        officers,
        caseCount: cases.length,
        evidenceCount: evidence.length,
        verifications,
      });
    }

    if (wants("notifications")) {
      const orphans = await evidenceWithoutChain().catch(() => [] as any[]);
      payload.notifications = buildNotifications({
        applications,
        security,
        officers,
        orphanEvidence: orphans.length,
      });
    }

    if (wants("ai")) {
      // Every officer's queries, not just the viewing administrator's. This is
      // a surveillance view and is admin-gated for that reason; see
      // buildAiQueries() for what is real here and what was removed.
      const aiQueries = buildAiQueries(activity, officers);
      payload.aiQueries = aiQueries;
      payload.aiStats = summariseAiQueries(aiQueries);
    }

    if (wants("settings")) {
      payload.settings = await loadSettings();
      payload.settingSpecs = SETTING_SPECS;
    }

    // The dashboard KPIs. Counted from the same rows the tabs show, so a card
    // and the table behind it can never disagree.
    if (requested.length === 0) {
      const openSessions = sessions.filter((s) => s.status === "ACTIVE");
      payload.summary = {
        pendingApplications: applications.filter((a) => a.status === "pending").length,
        rejectedApplications: applications.filter((a) => a.status === "rejected").length,
        activeOfficers: officers.filter((o) => o.active).length,
        totalOfficers: officers.length,
        // Real open sessions, not a percentage of the headcount. The old card
        // showed `Math.round(activeOfficers * 0.4)`, which was invented.
        openSessions: openSessions.length,
        signInsToday: sessions.filter((s) => {
          const t = Date.parse((s.loginAt || "").replace(" ", "T"));
          return t && new Date(t).toDateString() === new Date().toDateString();
        }).length,
        documentsSealed: verifications.length,
        scansRun: verifications.reduce((n, v) => n + v.scanCount, 0),
        failedScans: failedScans.length,
        auditEntries: audit.length,
        officersWithoutEmployeeRow: officers.filter((o) => !o.employeeId).length,
      };
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("[Admin Overview Error]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load administrative data." },
      { status: 500 }
    );
  }
}
