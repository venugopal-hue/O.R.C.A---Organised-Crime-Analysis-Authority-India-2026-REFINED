"use client";

import { useEffect, useState } from "react";
import { fetchTelemetry } from "@/lib/officerTelemetryClient";

/**
 * Live duration of the officer's CURRENT sign-in, measured from the server.
 *
 * Why not sessionStorage: the dashboard tile and the sidebar clock both used to
 * read `orca_session_start`, a timestamp written by the browser when it first
 * rendered. That is per-tab, so opening a second tab restarted the counter and
 * the officer's "active session time" silently under-reported. It also had no
 * relationship to the session actually recorded in the audit log.
 *
 * The start time now comes from the open `OfficerSession` row (`LoginAt`,
 * written server-side at authentication). It is cached in sessionStorage so a
 * re-render or a route change does not re-read the table, but a fresh tab with
 * no cache fetches it rather than inventing "now".
 *
 * Ticking is local; only the ORIGIN is authoritative.
 */

const CACHE_KEY = "orca_session_login_at";

/** Catalyst returns `YYYY-MM-DD HH:MM:SS` (no `T`, no zone) in server-local time. */
function parseCatalystDate(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function formatElapsed(seconds: number, style: "long" | "clock" = "long"): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return style === "clock" ? `${p(h)}:${p(m)}:${p(s)}` : `${p(h)}h ${p(m)}m ${p(s)}s`;
}

export interface ActiveSession {
  /** Seconds since the recorded sign-in, or null while unknown. */
  elapsedSeconds: number | null;
  /** True once a real server-side start time is in hand. */
  known: boolean;
}

export function useActiveSession(): ActiveSession {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Resolve the start time once.
  useEffect(() => {
    let cancelled = false;

    const cached = typeof window !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
    const cachedMs = cached ? parseCatalystDate(cached) : null;
    if (cachedMs) {
      setStartMs(cachedMs);
      return;
    }

    (async () => {
      try {
        // Shared with the settings screen's own read - this used to be a second
        // independent request, and each one scanned two tables server-side.
        const data = await fetchTelemetry();
        if (cancelled) return;
        const open = data.sessions.find((s) => s.status === "ACTIVE");
        const ms = open ? parseCatalystDate(open.loginAt) : null;
        if (ms && open) {
          sessionStorage.setItem(CACHE_KEY, open.loginAt);
          setStartMs(ms);
        }
      } catch {
        // Leave it unknown. The UI shows "—" rather than a number that would
        // look measured but be made up.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Tick.
  useEffect(() => {
    if (startMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return {
    elapsedSeconds: startMs === null ? null : Math.floor((now - startMs) / 1000),
    known: startMs !== null,
  };
}
