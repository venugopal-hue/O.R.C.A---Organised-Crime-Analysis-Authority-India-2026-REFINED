"use client";

import React, { useEffect } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessTab, getRoleConfig } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import DashboardPage from "@/app/dashboard/page";

export default function DocumentVerificationPage() {
  const { setActiveTab } = useIntelligence();
  const { dashboardRole, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && dashboardRole) {
      if (getRoleConfig(dashboardRole) && !canAccessTab(dashboardRole, "verification-document")) {
        router.push("/unauthorized");
        return;
      }
    }
    setActiveTab("verification-document");
  }, [setActiveTab, dashboardRole, isLoggedIn, router]);

  return <DashboardPage />;
}
