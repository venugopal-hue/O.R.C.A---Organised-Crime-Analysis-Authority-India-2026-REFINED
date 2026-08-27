"use client";

import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

/**
 * Type-to-filter dropdown for the Case Registration lookups.
 *
 * A native <select> is the wrong control here: the police-station list runs to
 * 200+ entries, and the browser renders a native option list as an OS-level
 * popup that opens upward and overruns the window when the field sits low on
 * the page. This panel is positioned inside the document, capped in height, and
 * filterable, so long reference lists stay usable.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const MONO = "JetBrains Mono, monospace";

const PANEL_MAX_HEIGHT = 240;

export interface SelectOption { id: string; label: string; hint?: string }

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  emptyMessage: string;
  required?: boolean;
  placeholder?: string;
}

export const SearchableSelect: React.FC<Props> = ({
  label, value, onChange, options, emptyMessage, required, placeholder = "— Select —",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  /** Cap on the option list, narrowed when neither side has full room. */
  const [listMax, setListMax] = useState(PANEL_MAX_HEIGHT);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEmpty = options.length === 0;
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Place the panel below unless it genuinely does not fit.
   *
   * This used to assume every panel needed `PANEL_MAX_HEIGHT + 60` (300px), so
   * a three-option list flipped upward as readily as the 200-entry station
   * list - opening over the fields above it with plenty of room below. The
   * panel is measured instead, in useLayoutEffect so the decision lands before
   * the browser paints and nothing is seen to jump.
   */
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const GAP = 8;                       // breathing room against the window edge
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;

    // Down is the default, and strongly preferred: a dropdown that opens over
    // the fields ABOVE it is disorienting. The panel body scrolls, so it does
    // not need its full height below - only enough to be usable. Flip up ONLY
    // when the field sits so low that a downward panel would be uselessly
    // short, and there is genuinely more room above.
    //
    // The earlier logic flipped up whenever the full panel height (168px for a
    // three-option list) did not fit below, so Case Status opened UPWARD with
    // 147px below it - all but fitting. Now 147px counts as usable and it opens
    // down.
    const MIN_USABLE_BELOW = 120;
    const goUp = spaceBelow < MIN_USABLE_BELOW && spaceAbove > spaceBelow;

    setDropUp(goUp);

    // Cap the option list to the room on the chosen side, minus the fixed
    // chrome (search box + footer, ~66px). Floored at ~3 rows so a short list
    // shows in full rather than being needlessly scrolled; a panel that spills
    // a little past the fold is fine, since the page scrolls to it.
    const CHROME = 66;
    const THREE_ROWS = 108;
    const room = goUp ? spaceAbove : spaceBelow;
    setListMax(Math.max(THREE_ROWS, Math.min(PANEL_MAX_HEIGHT, room - CHROME)));

    inputRef.current?.focus();
    // filtered.length matters: typing changes how tall the panel wants to be.
  }, [open, filtered.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: NAVY,
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, fontFamily: MONO,
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={labelStyle}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>

      <button
        type="button"
        disabled={isEmpty}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8, padding: "9px 11px", border: `1px solid ${open ? NAVY : BORDER}`,
          borderRadius: 4, fontSize: 13, textAlign: "left",
          background: isEmpty ? OFFWHITE : "#fff",
          color: isEmpty ? MUTED : selected ? TEXT : MUTED,
          cursor: isEmpty ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isEmpty ? emptyMessage : selected ? selected.label : placeholder}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {selected && !isEmpty && (
            <X
              style={{ width: 14, height: 14, color: MUTED }}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
            />
          )}
          <ChevronDown style={{ width: 15, height: 15, color: MUTED, transform: open ? "rotate(180deg)" : "none" }} />
        </span>
      </button>

      {open && !isEmpty && (
        <div
          ref={panelRef}
          style={{
            position: "absolute", left: 0, right: 0, zIndex: 60,
            ...(dropUp ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }),
            background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,31,63,0.16)", overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", borderBottom: `1px solid ${BORDER}` }}>
            <Search style={{ width: 13, height: 13, color: MUTED, position: "absolute", left: 10, top: 10 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${options.length} entries…`}
              style={{
                width: "100%", padding: "8px 10px 8px 30px", border: "none",
                outline: "none", fontSize: 12.5, fontFamily: "inherit", color: TEXT,
              }}
            />
          </div>

          <div style={{ maxHeight: listMax, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: 12.5, color: MUTED, textAlign: "center" }}>
                Nothing matches “{query}”
              </div>
            ) : (
              filtered.map((o, i) => {
                const active = o.id === value;
                return (
                  <button
                    // Index is part of the key on purpose: option ids are not
                    // guaranteed unique (section codes repeat across acts), and
                    // duplicate keys make React drop or duplicate rows silently.
                    key={`${o.id}-${i}`}
                    type="button"
                    onClick={() => { onChange(o.id); setOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, padding: "8px 12px", border: "none", cursor: "pointer",
                      background: active ? "rgba(255,153,51,0.10)" : "transparent",
                      color: active ? NAVY : TEXT, fontWeight: active ? 700 : 400,
                      fontSize: 12.5, textAlign: "left", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.label}
                      {o.hint && <span style={{ color: MUTED, marginLeft: 6, fontFamily: MONO, fontSize: 11 }}>{o.hint}</span>}
                    </span>
                    {active && <Check style={{ width: 14, height: 14, color: SAFFRON, flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <div style={{
              padding: "5px 12px", borderTop: `1px solid ${BORDER}`, background: OFFWHITE,
              fontSize: 10.5, color: MUTED, fontFamily: MONO, letterSpacing: "0.05em",
            }}>
              {filtered.length} of {options.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
