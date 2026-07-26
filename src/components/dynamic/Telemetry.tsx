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

export const Telemetry: React.FC = () => {
  const { threatIndex, activeCells, patrolRate, ocrIntegrity } = useIntelligence();

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
        title="Critical Threat Index"
        value={String(threatIndex)}
        subLine1="SOC: ISO-S1"
        subLine2="Active Network Index Score"
      />
      <StatCard
        title="Tower Pings Under Audit"
        value={activeCells.toLocaleString()}
        subLine1="FREQ: 900 MHz"
        subLine2="Active Cells Tracked"
      />
      <StatCard
        title="Resolved State Warrants"
        value={`${patrolRate}%`}
        subLine1="RATIO YTD"
        subLine2="Patrol & Force Response Coverage"
      />
      <StatCard
        title="Extraction Calibration"
        value={`${ocrIntegrity}%`}
        subLine1="CERT-IN SCORE"
        subLine2="OCR Forensic Integrity Index"
      />
    </div>
  );
};
