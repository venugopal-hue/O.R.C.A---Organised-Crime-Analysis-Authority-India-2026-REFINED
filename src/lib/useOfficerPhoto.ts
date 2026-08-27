"use client";

import { useEffect, useState } from "react";

/**
 * The signed-in officer's stored face capture, for use as their profile picture.
 *
 * The image lives in Catalyst (`OfficerPhoto`, chunked — see src/lib/officerPhoto.ts)
 * rather than inline in Firestore documents, so it is fetched once per session
 * and cached in sessionStorage. Several components show the avatar; without the
 * cache each mount would trigger a table read.
 *
 * Returns "" until it is known. Callers fall back to initials, which is what
 * they did before any capture existed.
 */

const CACHE_KEY = "orca_officer_photo";

let inFlight: Promise<string> | null = null;

async function fetchPhoto(): Promise<string> {
  const res = await fetch("/api/officer/photo");
  if (!res.ok) return "";
  const data = await res.json();
  return data?.photo?.dataUrl || "";
}

export function useOfficerPhoto(): string {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const cached = typeof window !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
    if (cached !== null) {
      setDataUrl(cached);
      return;
    }

    // De-duplicate: the topbar and the profile card mount together.
    if (!inFlight) {
      inFlight = fetchPhoto()
        .catch(() => "")
        .finally(() => {
          // Allow a later retry if this attempt produced nothing.
          setTimeout(() => { inFlight = null; }, 0);
        });
    }

    inFlight.then((url) => {
      if (cancelled) return;
      try {
        // Cache the empty result too, so an officer with no capture does not
        // re-read the table on every navigation.
        sessionStorage.setItem(CACHE_KEY, url);
      } catch {
        // sessionStorage can be full or blocked; the fetch still worked.
      }
      setDataUrl(url);
    });

    return () => { cancelled = true; };
  }, []);

  return dataUrl;
}

/** Drop the cached avatar — call after a capture is replaced, and on sign-out. */
export function clearOfficerPhotoCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing cached */
  }
}
