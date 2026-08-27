/**
 * O.R.C.A design tokens — the single set.
 *
 * These lived as a private `ORCA` const inside dashboard/page.tsx, and the
 * admin console carried its own `ADMIN_THEME` with the SAME values written out
 * again under different names. Two lists of one palette drift the moment either
 * is edited, and there is no way to tell from one of them that the other exists.
 *
 * Values are unchanged — this is a consolidation, not a restyle. `ADMIN_THEME`
 * still exists in the admin console as an alias of these, because renaming ~400
 * usages would touch every line of that file for no visual difference.
 */
export const ORCA_TOKENS = {
  navy: "#001f3f",
  navyMid: "#002855",
  navyLight: "#003366",
  gold: "#FF9933",
  white: "#ffffff",
  offWhite: "#f8fafc",
  textDark: "#1e293b",
  textGray: "#475569",
  textMuted: "#94a3b8",
  border: "#cbd5e1",
  red: "#ef4444",
  redDark: "#990000",
  green: "#10b981",
  orange: "#f97316",
  blue: "#1E3A8A",
  shadow: "0 1px 3px rgba(0,0,0,0.1)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.1)",
} as const;

/** The mono face used for labels, ids and anything an officer reads as a code. */
export const ORCA_MONO = "'JetBrains Mono', monospace";
