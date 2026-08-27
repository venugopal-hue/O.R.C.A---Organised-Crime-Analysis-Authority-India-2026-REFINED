import React from "react";
import { useIntelligence } from "@/context/IntelligenceContext";

// O.R.C.A Stat Card — matches .stat-card: white bg, 8px radius, gold top-border, shadow
const StatCard: React.FC<{
  title: string;
  value: string;
  subLine1: string;
  subLine2: string;
}> = ({ title, value, subLine1, subLine2 }) => (
  <div style={{
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    borderTop: "3px solid #FF9933",   // gold top accent — O.R.C.A .stat-card
    display: "flex",
    flexDirection: "column",
    gap: 4
  }}>
    {/* .stat-card-title */}
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: "#475569",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: "JetBrains Mono, monospace",
      marginBottom: 4
    }}>
      {title}
    </div>
    {/* .stat-card-value */}
    <div style={{
      fontSize: 28,
      fontWeight: 700,
      color: "#001f3f",
      lineHeight: 1,
      letterSpacing: "-0.02em"
    }}>
      {value}
    </div>
    {/* .stat-card-sub */}
    <div style={{
      fontSize: 11,
      color: "#94a3b8",
      marginTop: 4,
      textAlign: "right",
      fontFamily: "JetBrains Mono, monospace",
      lineHeight: 1.4
    }}>
      {subLine1}<br />{subLine2}
    </div>
  </div>
);

/**
 * Command Overview counters.
 *
 * These four cards used to read "9.4", "1,482", "96.2%" and "99.4%" — invented
 * figures that drifted by a random delta every six seconds so they looked live.
 * They are the first thing an officer sees after signing in.
 *
 * They now count real rows in CaseMaster. Until the counts have been read the
 * cards show a dash rather than 0, because "no cases registered" and "could not
 * read the ledger" must not look identical.
 */
export const Telemetry: React.FC = () => {
  const {
    heinousCount,
    underInvestigationCount,
    chargeSheetedCount,
    casesRegistered,
    statsLoaded,
  } = useIntelligence();

  const show = (n: number) => (statsLoaded ? n.toLocaleString() : "—");

  return (
    /* O.R.C.A .overview-grid: 4-column grid with 16px gap */
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 16,
      marginBottom: 24,
      flexShrink: 0
    }}>
      <StatCard
        title="Heinous Offences"
        value={show(heinousCount)}
        subLine1="GRAVITY: HEINOUS"
        subLine2={statsLoaded ? "Registered cases so classified" : "Reading case ledger..."}
      />
      <StatCard
        title="Under Investigation"
        value={show(underInvestigationCount)}
        subLine1="STATUS: OPEN"
        subLine2={statsLoaded ? "Cases not yet disposed" : "Reading case ledger..."}
      />
      <StatCard
        title="Charge-Sheeted"
        value={show(chargeSheetedCount)}
        subLine1="STATUS: FILED"
        subLine2={statsLoaded ? "Cases sent for prosecution" : "Reading case ledger..."}
      />
      <StatCard
        title="Cases Registered"
        value={show(casesRegistered)}
        subLine1="CASE LEDGER"
        subLine2={statsLoaded ? "Total on record" : "Reading case ledger..."}
      />
    </div>
  );
};
