"use client";

import { useState, useEffect } from "react";
import type { SelectOption } from "@/components/dynamic/SearchableSelect";

/**
 * Fetches registered FIR / crime numbers from /api/fir/cases and converts
 * them into SelectOption[] for the SearchableSelect component.
 */
export function useFIROptions(): { firOptions: SelectOption[]; firLoading: boolean } {
  const [firOptions, setFirOptions] = useState<SelectOption[]>([]);
  const [firLoading, setFirLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fir/cases");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const cases: Record<string, string>[] = data.cases ?? [];
        setFirOptions(
          cases
            .filter((c) => c.CrimeNo)
            .map((c) => ({
              id: String(c.CrimeNo),
              label: String(c.CrimeNo),
              hint: c.CrimeRegisteredDate ? String(c.CrimeRegisteredDate).substring(0, 10) : undefined,
            }))
        );
      } catch {
        // silently ignore — the field falls back to being skippable
      } finally {
        if (!cancelled) setFirLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { firOptions, firLoading };
}
