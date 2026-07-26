"use client";

import React, { useState } from "react";
import { Tv, ExternalLink, Lock } from "lucide-react";

const ORCA = {
  navy:      "#001f3f",
  navyMid:   "#002855",
  gold:      "#FF9933",
  white:     "#ffffff",
  offWhite:  "#f8fafc",
  textDark:  "#1e293b",
  textGray:  "#475569",
  textMuted: "#94a3b8",
  border:    "#cbd5e1",
  red:       "#ef4444",
  green:     "#10b981",
  blue:      "#2563eb",
  purple:    "#7c3aed",
  shadow:    "0 2px 6px rgba(0,0,0,0.06)",
};

interface ActiveChannel {
  id: string;
  name: string;
  category: "STATE (KARNATAKA)" | "NATIONAL (INDIA)" | "INTERNATIONAL";
  categoryBadgeColor: string;
  youtubeLiveUrl: string;
  embedSrc: string;
  isComingSoon?: false;
}

interface ComingSoonChannel {
  id: string;
  name: string;
  category: string;
  schedule: string;
  isComingSoon: true;
}

type NewsChannel = ActiveChannel | ComingSoonChannel;

const CHANNELS: NewsChannel[] = [
  // ── 1 ACTIVE EMBEDDED CHANNEL ────────────────────────────────
  {
    id: "aljazeera",
    name: "AL JAZEERA ENGLISH LIVE",
    category: "INTERNATIONAL",
    categoryBadgeColor: ORCA.purple,
    youtubeLiveUrl: "https://www.youtube.com/@AlJazeeraEnglish/live",
    embedSrc: "https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1"
  },

  // ── 5 AWAITING PERMISSIONS CHANNELS ─────────────────────────
  {
    id: "tv9",
    name: "TV9 KANNADA LIVE",
    category: "STATE (KARNATAKA)",
    schedule: "ISD Satellite Clearance & Broadcast Authorization Pending",
    isComingSoon: true
  },
  {
    id: "ndtv",
    name: "NDTV 24x7 INDIA LIVE",
    category: "NATIONAL (INDIA)",
    schedule: "Ministry of Information & Broadcasting Permit Verification",
    isComingSoon: true
  },
  {
    id: "publictv",
    name: "PUBLIC TV KANNADA",
    category: "STATE (KARNATAKA)",
    schedule: "ISD Satellite Clearance & Broadcast Key Approval Required",
    isComingSoon: true
  },
  {
    id: "suvarna",
    name: "ASIANET SUVARNA NEWS",
    category: "STATE (KARNATAKA)",
    schedule: "Awaiting State Intelligence Directorate Feed Authorization",
    isComingSoon: true
  },
  {
    id: "republic",
    name: "REPUBLIC TV / BHARAT",
    category: "NATIONAL (INDIA)",
    schedule: "National Broadcast License Verification In Progress",
    isComingSoon: true
  }
];

export const LiveNewsFeeds: React.FC = () => {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const activeCount = CHANNELS.filter(c => !c.isComingSoon).length;

  const openYoutubeLive = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      width: "100%",
      overflow: "hidden",
      background: "#f8fafc",
      padding: "10px 12px 12px",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={{
        height: 38,
        background: ORCA.white,
        color: ORCA.navy,
        padding: "0 14px",
        borderRadius: 6,
        border: `1px solid ${ORCA.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
        boxShadow: ORCA.shadow,
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: ORCA.navy,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Tv style={{ width: 12, height: 12, color: ORCA.gold }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: ORCA.navy }}>
            Live News & Broadcast Directorate — Al Jazeera English (Active) • TV9 Kannada • NDTV 24x7
          </span>
          <span style={{
            background: "#fee2e2",
            color: ORCA.red,
            border: "1px solid #fca5a5",
            fontSize: 9,
            fontWeight: 800,
            padding: "1px 6px",
            borderRadius: 8,
            fontFamily: "JetBrains Mono, monospace"
          }}>
            ● {activeCount} ACTIVE STREAM{activeCount === 1 ? "" : "S"}
          </span>
        </div>

        <span style={{ fontSize: 10, color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
          ISD Live Surveillance Grid • 100% Fit Viewport
        </span>
      </div>

      {/* ── 3x2 Grid (3 Active Embeds + 3 Awaiting Clearance) ───── */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(2, 1fr)",
        gap: 8,
        width: "100%",
        height: "100%",
        overflow: "hidden"
      }}>
        {CHANNELS.map(channel => {
          if (channel.isComingSoon) {
            const isHovered = hoveredCardId === channel.id;

            return (
              <div
                key={channel.id}
                onMouseEnter={() => setHoveredCardId(channel.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  width: "100%",
                  background: "rgba(255, 247, 237, 0.6)",
                  border: isHovered ? "1.5px solid #FF9933" : "1px dashed rgba(245, 158, 11, 0.4)",
                  borderRadius: 6,
                  overflow: "hidden",
                  boxShadow: isHovered ? "0 4px 14px rgba(245, 158, 11, 0.15)" : ORCA.shadow,
                  transition: "all 0.2s ease",
                  cursor: "not-allowed",
                  position: "relative"
                }}
              >
                {/* Card Header Bar */}
                <div style={{
                  height: 30,
                  background: "#451a03",
                  color: "#fef3c7",
                  padding: "0 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <Lock style={{ width: 11, height: 11, color: ORCA.gold }} />
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.01em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {channel.name}
                    </span>
                  </div>

                  <span style={{
                    background: ORCA.gold,
                    color: "#451a03",
                    fontSize: 8.5,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em"
                  }}>
                    AWAITING CLEARANCE
                  </span>
                </div>

                {/* Locked Inner View — Awaiting Permissions */}
                <div style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  textAlign: "center",
                  background: isHovered ? "rgba(254, 243, 199, 0.35)" : "transparent",
                  transition: "background 0.2s"
                }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    color: "#b45309"
                  }}>
                    <Lock style={{ width: 16, height: 16 }} />
                  </div>

                  <strong style={{ fontSize: 12.5, color: "#78350f", marginBottom: 2 }}>
                    Awaiting Broadcast Permissions
                  </strong>
                  <span style={{ fontSize: 9.5, color: "#92400e", fontFamily: "JetBrains Mono, monospace", maxWidth: 260 }}>
                    {channel.schedule}
                  </span>

                  {isHovered && (
                    <div style={{
                      marginTop: 6,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      color: "#b45309",
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontFamily: "JetBrains Mono, monospace"
                    }}>
                      🔒 ACCESS RESTRICTED: Pending State Intelligence Clearance
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Active iFrame Embedded Channels (TV9, NDTV, Al Jazeera)
          return (
            <div
              key={channel.id}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: "100%",
                background: ORCA.white,
                border: `1px solid ${ORCA.border}`,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: ORCA.shadow,
                transition: "border-color 0.15s, box-shadow 0.15s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = ORCA.navy;
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,31,63,0.12)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = ORCA.border;
                e.currentTarget.style.boxShadow = ORCA.shadow;
              }}
            >
              {/* Card Header Bar */}
              <div style={{
                height: 30,
                background: ORCA.navyMid,
                color: ORCA.white,
                padding: "0 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexShrink: 0
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", flex: 1 }}>
                  <span style={{
                    background: ORCA.red,
                    color: "white",
                    fontSize: 7.5,
                    fontWeight: 800,
                    padding: "1px 4px",
                    borderRadius: 2,
                    fontFamily: "JetBrains Mono, monospace",
                    flexShrink: 0
                  }}>
                    LIVE
                  </span>
                  <span style={{
                    background: channel.categoryBadgeColor,
                    color: channel.category === "STATE (KARNATAKA)" ? ORCA.navy : "white",
                    fontSize: 7.5,
                    fontWeight: 800,
                    padding: "1px 4px",
                    borderRadius: 2,
                    fontFamily: "JetBrains Mono, monospace",
                    flexShrink: 0
                  }}>
                    {channel.category}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {channel.name}
                  </span>
                </div>

                {/* Direct Watch Live Button */}
                <button
                  onClick={() => openYoutubeLive(channel.youtubeLiveUrl)}
                  style={{
                    background: ORCA.gold,
                    color: ORCA.navy,
                    fontSize: 9.5,
                    fontWeight: 800,
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                  }}
                >
                  <span>Watch Live ↗</span>
                  <ExternalLink style={{ width: 10, height: 10 }} />
                </button>
              </div>

              {/* Direct YouTube iFrame Embed */}
              <div style={{ flex: 1, width: "100%", height: "100%", background: "#000", position: "relative" }}>
                <iframe
                  src={channel.embedSrc}
                  title={channel.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
