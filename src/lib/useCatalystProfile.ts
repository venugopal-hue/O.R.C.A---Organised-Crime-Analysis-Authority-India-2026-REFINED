"use client";

import { useEffect, useState } from "react";

/**
 * The signed-in officer's Catalyst record (OfficerAccount joined to Employee).
 *
 * Firebase still says WHO the caller is; everything about them lives in
 * Catalyst. Components that used to read `officerProfile` from AuthContext
 * (a Firestore document) should read this instead, so one record backs the
 * whole console.
 *
 * Fetched once per session and cached, because several screens want the same
 * fields and each read is a full-table scan while the ZCQL scope is missing.
 */

const CACHE_KEY = "orca_catalyst_profile";

export interface CatalystProfile {
  firebaseUid: string;
  name: string;
  email: string;
  mobile: string;
  kgid: string;
  rank: string;
  designation: string;
  station: string;
  district: string;
  clearanceLevel: string;
  dashboardRole: string;
  accountStatus: string;
}

let inFlight: Promise<CatalystProfile | null> | null = null;

async function fetchProfile(): Promise<CatalystProfile | null> {
  const res = await fetch("/api/officer/profile");
  if (!res.ok) return null;
  const data = await res.json();
  return data?.profile || null;
}

export function useCatalystProfile(): { profile: CatalystProfile | null; loading: boolean } {
  const [profile, setProfile] = useState<CatalystProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cached = typeof window !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
    if (cached) {
      try {
        setProfile(JSON.parse(cached));
        setLoading(false);
        return;
      } catch {
        // Corrupt cache: fall through and refetch.
      }
    }

    if (!inFlight) {
      inFlight = fetchProfile()
        .catch(() => null)
        .finally(() => { setTimeout(() => { inFlight = null; }, 0); });
    }

    inFlight.then((p) => {
      if (cancelled) return;
      if (p) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch { /* storage full */ }
      }
      setProfile(p);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return { profile, loading };
}

export function clearCatalystProfileCache(): void {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* nothing cached */ }
}
