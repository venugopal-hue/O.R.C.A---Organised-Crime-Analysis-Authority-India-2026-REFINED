"use client";

import { useEffect, useState } from "react";

/**
 * District case statistics, shared by the map and the dossier beside it.
 *
 * WHY A SHARED HOOK
 *
 * The map draws the shading and the dossier states the counts behind whichever
 * district is selected. Both need the same rows. Fetching twice would mean two
 * full scans of `CaseMaster` per visit and, worse, two copies of the numbers
 * that could disagree if one refreshed and the other did not — the dossier
 * would then explain a colour the map is no longer showing.
 *
 * The in-flight promise is cached at module scope so concurrent mounts share
 * one request. The RESULT is not cached beyond that: a stale count on a police
 * console is worse than a second request, so revisiting the tab re-reads.
 */

export interface DistrictStatRow {
  districtId: number;
  districtName: string;
  latitude: number | null;
  longitude: number | null;
  total: number;
  heinous: number;
  underInvestigation: number;
  chargeSheeted: number;
  closed: number;
  threat: {
    score: number | null;
    band: "None" | "Moderate" | "Elevated" | "Critical";
    provisional: boolean;
  };
}

interface Result {
  rows: DistrictStatRow[];
  loaded: boolean;
  error: string;
}

let inFlight: Promise<DistrictStatRow[]> | null = null;

async function load(): Promise<DistrictStatRow[]> {
  const res = await fetch("/api/analytics/crime");
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || `Statistics request failed (${res.status})`);
  }
  return Array.isArray(body.rows) ? body.rows : [];
}

export function useDistrictStats(): Result {
  const [rows, setRows] = useState<DistrictStatRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!inFlight) {
      inFlight = load().finally(() => {
        // Cleared once settled, so the next mount re-reads rather than
        // replaying a result that may since have gone stale.
        inFlight = null;
      });
    }
    inFlight.then(
      (r) => { if (!cancelled) { setRows(r); setLoaded(true); } },
      (e) => { if (!cancelled) { setError(e?.message || "Could not load district statistics."); setLoaded(true); } }
    );
    return () => { cancelled = true; };
  }, []);

  return { rows, loaded, error };
}
