"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  allowed: string[];
  children: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowed,
  children,
  redirectTo = "/unauthorized",
}) => {
  const { dashboardRole, loading, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isLoggedIn) {
        router.replace("/login");
      } else if (!allowed.includes(dashboardRole)) {
        router.replace(redirectTo);
      }
    }
  }, [loading, isLoggedIn, dashboardRole, allowed, router, redirectTo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#001f3f] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF9933] mb-4" />
        <p className="font-mono text-sm tracking-wider text-slate-300 uppercase">
          VERIFYING ISD CLEARANCE & COMMAND ACCESS...
        </p>
      </div>
    );
  }

  if (!isLoggedIn || !allowed.includes(dashboardRole)) {
    return null;
  }

  return <>{children}</>;
};
