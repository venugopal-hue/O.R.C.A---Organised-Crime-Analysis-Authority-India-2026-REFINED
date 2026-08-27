"use client";

import React, { useEffect } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessTab, getRoleConfig } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import DashboardPage from "@/app/dashboard/page";

export default function DocumentVerificationPage() {
  const { setActiveTab } = useIntelligence();
  const { dashboardRole, isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    /**
     * WAIT FOR THE ROLE. DO NOT JUDGE THE PLACEHOLDER.
     *
     * This guard used to run as soon as `isLoggedIn` turned true, and that is
     * strictly earlier than the officer's role being known. AuthContext seeds
     * `dashboardRole` with "field_officer_l4" — a REAL role, not a sentinel —
     * and sets `user` at the top of the auth handler, before the Catalyst
     * profile has been fetched. So there is a window in which the context
     * reports: signed in, role = field officer.
     *
     * `field_officer_l4` has no "verification-document" tab. A Full Command
     * Administrator opening this page in that window was therefore bounced to
     * /unauthorized for a tab their role plainly grants — and because the
     * bounce is a navigation, it stuck: the real role arriving a moment later
     * had nothing left to correct.
     *
     * `loading` is false only after setDashboardRole has run, so it is the
     * signal that the role on the context is the officer's own. Every other
     * role check in the app is a render guard that re-evaluates and fixes
     * itself; this one moves the browser, so it has to be right first time.
     */
    if (loading) return;

    // Not signed in is not this page's decision — DashboardPage sends them to
    // the login screen. Redirecting here as well would race with that.
    if (isLoggedIn && getRoleConfig(dashboardRole) && !canAccessTab(dashboardRole, "verification-document")) {
      // `replace`, not `push`: a denied officer pressing Back would otherwise
      // land on this page again and be bounced straight back out.
      router.replace("/unauthorized");
      return;
    }

    setActiveTab("verification-document");
  }, [setActiveTab, dashboardRole, isLoggedIn, loading, router]);

  return <DashboardPage />;
}
