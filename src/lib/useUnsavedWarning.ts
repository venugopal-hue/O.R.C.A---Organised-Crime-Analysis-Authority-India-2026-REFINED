"use client";

import { useEffect } from "react";

/**
 * Warn before a refresh or navigation would discard unsubmitted work.
 *
 * WHY THIS EXISTS
 *
 * A reporter fills in an incident — badge, component, severity, several
 * paragraphs of reproduction steps — hits F5 or the back button by accident,
 * and every word is gone with no way back. The same is true of an officer
 * typing a resolution note into the triage panel.
 *
 * WHAT IT CANNOT DO, AND WHY THAT MATTERS HERE
 *
 * The browser writes the dialog, not us. Every engine ignores a custom string
 * and shows its own wording ("Changes you made may not be saved"), so this
 * cannot tell the reporter that it is specifically their unsent ticket at
 * risk. That is why the forms also carry a visible on-page cue: the dialog
 * provides the interruption, the page provides the meaning.
 *
 * It also only catches NAVIGATION — refresh, tab close, back, an outbound
 * link. A crash or a dead battery still loses the text. This narrows the
 * common case; it is not durability.
 *
 * THE RULE THAT KEEPS IT USEFUL
 *
 * Pass `enabled` only when there is genuinely something to lose. A guard that
 * fires on an untouched form, or after a successful submit, teaches people to
 * click through the dialog without reading it — and then it fails silently on
 * the one occasion it mattered. Warning too often is worse than not warning.
 */
export function useUnsavedWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      // Both are needed: preventDefault is the modern spec, returnValue is
      // what older engines still read. Setting neither means no dialog.
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handler);

    // Removing this is not optional. A listener left registered keeps warning
    // on pages that have nothing unsaved, which is the exact failure this hook
    // is meant to avoid — and it is painful to trace back to its source.
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}

/** True when any of the given values holds something the user typed or chose. */
export function anyFilled(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => String(v ?? "").trim().length > 0);
}
