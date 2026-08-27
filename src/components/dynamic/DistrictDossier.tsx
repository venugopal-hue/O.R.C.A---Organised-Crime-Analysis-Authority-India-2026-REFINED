"use client";

import React from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useDistrictStats } from "@/lib/useDistrictStats";

/**
 * The numbers behind whichever district is selected on the map.
 *
 * WHY THIS IS A PANEL AND NOT A CARD ON THE MAP
 *
 * These counts used to appear in a small box floating over the map. It covered
 * the shapes it was describing, it had to be tiny to stay out of the way, and
 * the panel beside it sat almost empty. Putting the detail where there is room
 * for it means the figures can be read at a normal size and the map stays
 * unobstructed.
 *
 * A shaded district that cannot be checked against its inputs is the same
 * failure as the hardcoded "9.4 Critical" this screen used to print, so every
 * component of the score is listed.
 */

const ORCA = {
  navy: "#001f3f",
  textGray: "#475569",
  textMuted: "#94a3b8",
  border: "#cbd5e1",
};

const BAND_COLOR: Record<string, string> = {
  Critical: "#b91c1c",
  Elevated: "#ea580c",
  Moderate: "#0369a1",
  None: "#94a3b8",
};

export const DistrictDossier: React.FC = () => {
  const { selectedDistrictCode } = useIntelligence();
  const { rows, loaded, error } = useDistrictStats();

  const district = rows.find((r) => String(r.districtId) === selectedDistrictCode) || null;

  const limits = (
    <div
      style={{
        borderTop: `1px solid ${ORCA.border}`,
        paddingTop: 14,
        marginTop: 18,
        fontSize: 13,
        lineHeight: 1.6,
        color: ORCA.textGray,
      }}
    >
      <strong style={{ color: ORCA.navy, display: "block", marginBottom: 5 }}>
        What this is not
      </strong>
      The Threat Index is a workload and severity indicator drawn from registered cases. It is not a
      crime rate — no population data is held — and not a prediction. Patrol coverage, force
      deployment and dispatch advisories are not collected by this platform.
    </div>
  );

  if (error) {
    return (
      <div style={{ padding: "20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: ORCA.navy, marginBottom: 8 }}>
          District statistics unavailable
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: ORCA.textGray, margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!district) {
    return (
      <div style={{ padding: "20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: ORCA.navy, marginBottom: 8 }}>
          {loaded ? "Select a district on the map" : "Reading registered cases…"}
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: ORCA.textGray, margin: 0 }}>
          Each district is shaded by its Threat Index, computed from registered cases. Click one to
          see the counts behind that colour. Districts with nothing registered are left hatched
          rather than shaded.
        </p>
        {limits}
      </div>
    );
  }

  const band = district.threat.band;
  const colour = BAND_COLOR[band];

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: ORCA.navy, marginBottom: 2 }}>
        {district.districtName}
      </div>

      {district.total === 0 ? (
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: ORCA.textGray, margin: "10px 0 0" }}>
          No cases registered in this district.{" "}
          <strong style={{ color: ORCA.navy }}>Not a score of zero</strong> — nothing has been
          recorded here yet.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 16px" }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: colour, lineHeight: 1 }}>
              {district.threat.score?.toFixed(1)}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colour,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {band}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {(
              [
                ["Total cases", district.total],
                ["Heinous", district.heinous],
                ["Under investigation", district.underInvestigation],
                ["Charge-sheeted", district.chargeSheeted],
                ["Closed", district.closed],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "7px 0",
                  borderBottom: `1px solid #f1f5f9`,
                }}
              >
                <span style={{ fontSize: 13.5, color: ORCA.textGray }}>{label}</span>
                <strong
                  style={{
                    fontSize: 15,
                    color: ORCA.navy,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>

          {district.threat.provisional && (
            <div
              style={{
                marginTop: 12,
                background: "rgba(255,153,51,0.08)",
                border: "1px dashed rgba(255,153,51,0.45)",
                borderRadius: 6,
                padding: "9px 11px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "#b45309",
              }}
            >
              <strong>Provisional.</strong> Too few cases back this score for it to be treated as
              settled — the shares swing sharply while the count is small.
            </div>
          )}
        </>
      )}

      {limits}
    </div>
  );
};
