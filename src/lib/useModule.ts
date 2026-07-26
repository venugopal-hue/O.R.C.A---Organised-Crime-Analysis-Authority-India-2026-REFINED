"use client";

import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_ROLES, PlatformModule } from "@/lib/permissions";

/**
 * Hook to verify if the currently authenticated officer's dashboardRole
 * includes the requested UI platform module.
 */
export function useModule(moduleKey: PlatformModule | string): boolean {
  const { dashboardRole } = useAuth();
  if (!dashboardRole) return false;

  const roleConfig = DASHBOARD_ROLES[dashboardRole];
  if (!roleConfig) return false;

  return roleConfig.modules.includes(moduleKey as PlatformModule);
}
