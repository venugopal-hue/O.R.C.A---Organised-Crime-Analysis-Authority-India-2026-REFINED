"use client";

import React from "react";

/**
 * The one section heading used across the dashboard.
 *
 * This lived as a private const inside dashboard/page.tsx, so the sections that
 * render their own shell (Case Registration, Document Verification, Evidence
 * Management) could not reach it and grew their own headings instead - two of
 * them as navy gradient banners. Lifting it here is what lets every section
 * share one heading rather than three that drift apart.
 *
 * `action` is the right-hand slot: a chip, a button, a sub-tab switcher. It sits
 * baseline-aligned with the title. There is deliberately no icon slot - none of
 * the plain headings carried one, and adding it would just recreate the
 * inconsistency this replaced.
 */
export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /**
   * Sections that render their own shell sit inside a `gap: 16` column, where
   * the default `marginBottom: 24` would stack to 40 and read wider than every
   * other section. Those pass `marginBottom: 0` and let the gap do the spacing.
   */
  style?: React.CSSProperties;
}> = ({ title, subtitle, action, style }) => (
  <div
    className="orca-page-header"
    style={{
      marginBottom: 24,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      gap: 16,
      flexWrap: "wrap",
      ...style,
    }}
  >
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#001f3f", marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: "#475569" }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

/**
 * The light-background counterpart to the saffron-on-navy chips the banners
 * used. Navy border, navy label, mono value - reads as the same family as the
 * barcode chips without needing a dark panel behind it.
 */
export const HeaderChip: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ label, value, hint }) => (
  <div
    style={{
      border: "1px solid #cbd5e1",
      borderLeft: "3px solid #FF9933",
      borderRadius: 4,
      background: "#f8fafc",
      padding: "7px 14px",
      textAlign: "right",
    }}
  >
    <div
      style={{
        fontSize: 9,
        color: "#475569",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.1em",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: "#001f3f",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.05em",
        marginTop: 2,
      }}
    >
      {value}
    </div>
    {hint && (
      <div
        style={{
          fontSize: 9,
          color: "#94a3b8",
          fontFamily: "'JetBrains Mono', monospace",
          marginTop: 2,
        }}
      >
        {hint}
      </div>
    )}
  </div>
);
