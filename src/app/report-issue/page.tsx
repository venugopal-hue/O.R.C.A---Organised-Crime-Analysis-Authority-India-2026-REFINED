"use client";

import React, { useState, useEffect } from "react";

const ORCA = {
  navy:      "#001f3f",
  navyMid:   "#002855",
  navyLight: "#003366",
  gold:      "#FF9933",
  white:     "#ffffff",
  offWhite:  "#f8fafc",
  textDark:  "#1e293b",
  textGray:  "#475569",
  textMuted: "#94a3b8",
  border:    "#cbd5e1",
  red:       "#ef4444",
  green:     "#10b981",
  shadow:    "0 1px 3px rgba(0,0,0,0.08)",
};

export default function ReportIssuePage() {
  const [mounted, setMounted] = useState(false);
  const [diagnostics, setDiagnostics] = useState({
    userAgent: "",
    screenSize: "",
    language: "",
    platform: "",
    connectionStatus: "Online",
    timestamp: ""
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setDiagnostics({
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width} × ${window.screen.height}`,
        language: navigator.language || "en-US",
        platform: navigator.platform || "Web",
        connectionStatus: navigator.onLine ? "Online" : "Offline",
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  if (!mounted) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100vh", width: "100vw", overflow: "hidden",
        background: ORCA.offWhite, fontFamily: "'Inter', sans-serif",
        justifyContent: "center", alignItems: "center", color: ORCA.navy
      }}>
        <span>Initializing Diagnostics Pipeline...</span>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100vw", overflow: "hidden",
      background: ORCA.offWhite, fontFamily: "'Inter', sans-serif",
    }}>
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{
        background: ORCA.navy, color: ORCA.white,
        padding: "0 32px", height: 56, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)", zIndex: 100,
      }}>
        <a href="/index.html" style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none", color: "inherit",
        }}>
          <img src="/logo.png" alt="ORCA" style={{ height: 32, width: 32, objectFit: "contain" }} />
          <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em" }}>
            O.R.C.A
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }}>
            ORGANIZED CRIME ANALYSIS AUTHORITY
          </span>
        </a>
        <a href="/index.html" style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", borderRadius: 6, padding: "6px 12px",
          cursor: "pointer", fontSize: 12, textDecoration: "none",
        }}>
          ← Home
        </a>
      </header>

      {/* ── Page Banner ─────────────────────────────────────────── */}
      <div style={{
        background: ORCA.navyMid, color: ORCA.white,
        padding: "24px 32px", flexShrink: 0,
        borderBottom: `3px solid ${ORCA.gold}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <span style={{
            display: "inline-block", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.12em", color: ORCA.gold,
            fontFamily: "JetBrains Mono, monospace",
            background: "rgba(255,153,51,0.15)", padding: "3px 10px",
            borderRadius: 4, marginBottom: 8, border: "1px solid rgba(255,153,51,0.3)",
          }}>
            SECURITY & STABILITY
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
            Incident & Glitch Reporting
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "4px 0 0" }}>
            Log platform bugs, database anomalies, or intelligence data discrepancies directly to the ISD Dev Cell.
          </p>
        </div>
      </div>

      {/* ── Content Body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>

          {/* Yellow Coming Soon Banner */}
          <div style={{
            background: "rgba(255, 153, 51, 0.08)",
            border: "1px dashed rgba(255, 153, 51, 0.35)",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#001f3f"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255, 153, 51, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0
              }}>
                ⚡
              </div>
              <div>
                <strong style={{ display: "block", fontSize: 13.5, color: "#001f3f", fontFamily: "JetBrains Mono, monospace" }}>
                  INCIDENT & GLITCH REPORTING PIPELINE — COMING SOON
                </strong>
                <span style={{ fontSize: 12, color: "#475569", marginTop: 2, display: "block" }}>
                  Statewide direct-to-dev bug reporting & triage pipeline integration is currently under active deployment.
                </span>
              </div>
            </div>
            <span style={{
              background: "#FF9933",
              color: "#001f3f",
              fontSize: 10,
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: 12,
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              whiteSpace: "nowrap"
            }}>
              UNDER DEVELOPMENT
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "11fr 9fr", gap: 32 }}>
            {/* Left Column: Reporting Form (Blocked & Hover Locked) */}
            <BlockedReportForm />

            {/* Right Column: Diagnostics & Guidelines */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ background: ORCA.white, border: `1px solid ${ORCA.border}`, borderRadius: 8, padding: "24px", boxShadow: ORCA.shadow }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 800, color: ORCA.navy, margin: "0 0 14px 0", borderBottom: `1px solid ${ORCA.border}`, paddingBottom: 8 }}>
                  System Diagnostics
                </h3>
                <p style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.5, margin: "0 0 16px 0" }}>
                  The details below are securely compiled locally and will be bundled with your ticket to help the engineering cell replicate the issue.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: ORCA.textGray }}>
                  <div style={{ borderBottom: `1px dashed ${ORCA.border}`, paddingBottom: 6 }}>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>OPERATING PLATFORM</div>
                    <div style={{ fontWeight: 700, color: ORCA.navy }}>{diagnostics.platform || "Detecting..."}</div>
                  </div>
                  <div style={{ borderBottom: `1px dashed ${ORCA.border}`, paddingBottom: 6 }}>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>SCREEN CANVAS</div>
                    <div style={{ fontWeight: 700, color: ORCA.navy }}>{diagnostics.screenSize || "Detecting..."}</div>
                  </div>
                  <div style={{ borderBottom: `1px dashed ${ORCA.border}`, paddingBottom: 6 }}>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>BROWSER ENGINE</div>
                    <div style={{ fontWeight: 700, color: ORCA.navy, overflowWrap: "anywhere" }}>
                      {diagnostics.userAgent ? diagnostics.userAgent.split(" ").slice(-2).join(" ") : "Detecting..."}
                    </div>
                  </div>
                  <div style={{ borderBottom: `1px dashed ${ORCA.border}`, paddingBottom: 6 }}>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>LANGUAGE RESOLUTION</div>
                    <div style={{ fontWeight: 700, color: ORCA.navy }}>{diagnostics.language || "Detecting..."}</div>
                  </div>
                  <div style={{ borderBottom: `1px dashed ${ORCA.border}`, paddingBottom: 6 }}>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>CONNECTION NODE</div>
                    <div style={{ fontWeight: 700, color: diagnostics.connectionStatus === "Online" ? ORCA.green : ORCA.red }}>
                      {diagnostics.connectionStatus}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: ORCA.textMuted, fontSize: 9 }}>TELEMETRY TIMESTAMP</div>
                    <div style={{ fontWeight: 700, color: ORCA.navy }}>{diagnostics.timestamp || "Detecting..."}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: "rgba(239,68,68,0.03)", border: `1px solid #fca5a5`, borderRadius: 8, padding: "20px" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: 13, color: ORCA.red, fontWeight: 700 }}>Security Notice Regarding Logs</h4>
                <p style={{ margin: 0, fontSize: 12, color: ORCA.textGray, lineHeight: 1.5 }}>
                  Do NOT paste actual classified suspect evidence details, criminal case summaries, or operational warrants into bug details. Only submit technology layout behaviors, error traces, and non-sensitive interface bugs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{
        background: ORCA.navy, color: "rgba(255,255,255,0.45)",
        padding: "16px 32px", fontSize: 11, flexShrink: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: `1px solid rgba(255,255,255,0.08)`,
      }}>
        <span>© 2026 Karnataka State Police · Internal Security Division</span>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/privacy" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Privacy</a>
          <a href="/terms" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Terms</a>
          <a href="/accessibility" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>Accessibility</a>
          <a href="/rti" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>RTI</a>
        </div>
      </footer>
    </div>
  );
}

function BlockedReportForm() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        background: ORCA.white,
        border: `1px solid ${ORCA.border}`,
        borderRadius: 8,
        padding: "24px",
        boxShadow: ORCA.shadow,
        cursor: "not-allowed",
        overflow: "hidden"
      }}
    >
      {/* Blocked Overlay on Hover */}
      {isHovered && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "rgba(255, 153, 51, 0.15)",
            border: "1px solid rgba(255, 153, 51, 0.4)",
            color: "#FF9933",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 12
          }}>
            ⚡
          </div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: ORCA.navy, margin: "0 0 6px 0", fontFamily: "JetBrains Mono, monospace" }}>
            FORM LOCKED — COMING SOON
          </h4>
          <p style={{ fontSize: 12, color: ORCA.textGray, margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
            Statewide incident & glitch reporting pipeline is locked while direct-to-dev automated triage is under active deployment.
          </p>
          <span style={{
            marginTop: 14,
            background: "#FF9933",
            color: ORCA.navy,
            fontSize: 10,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 12,
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.05em",
            textTransform: "uppercase"
          }}>
            UNDER DEVELOPMENT
          </span>
        </div>
      )}

      <h3 style={{ fontSize: 16, fontWeight: 800, color: ORCA.navy, margin: "0 0 16px 0" }}>
        Incident Details
      </h3>

      <form style={{ display: "flex", flexDirection: "column", gap: 14, opacity: isHovered ? 0.35 : 0.65, pointerEvents: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>OFFICER NAME *</label>
            <input
              type="text"
              disabled
              placeholder="e.g. Inspector Ramesh Kumar"
              style={{
                padding: "8px 12px", fontSize: 13, borderRadius: 6,
                border: `1px solid ${ORCA.border}`, outline: "none", cursor: "not-allowed", background: "#f8fafc"
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>BADGE ID *</label>
            <input
              type="text"
              disabled
              placeholder="e.g. KSP-10928"
              style={{
                padding: "8px 12px", fontSize: 13, borderRadius: 6,
                border: `1px solid ${ORCA.border}`, outline: "none", cursor: "not-allowed", background: "#f8fafc"
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>AFFECTED COMPONENT *</label>
            <select
              disabled
              style={{
                padding: "8px 12px", fontSize: 13, borderRadius: 6,
                border: `1px solid ${ORCA.border}`, outline: "none",
                background: "#f8fafc", cursor: "not-allowed"
              }}
            >
              <option>AI Chatbot (ZIA)</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>SEVERITY LEVEL *</label>
            <select
              disabled
              style={{
                padding: "8px 12px", fontSize: 13, borderRadius: 6,
                border: `1px solid ${ORCA.border}`, outline: "none",
                background: "#f8fafc", cursor: "not-allowed"
              }}
            >
              <option>Medium (Visual or UI bug)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>SUMMARY DESCRIPTION *</label>
          <input
            type="text"
            disabled
            placeholder="Brief headline of the bug..."
            style={{
              padding: "8px 12px", fontSize: 13, borderRadius: 6,
              border: `1px solid ${ORCA.border}`, outline: "none", cursor: "not-allowed", background: "#f8fafc"
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: ORCA.textGray }}>DETAILED STEPS TO REPRODUCE *</label>
          <textarea
            disabled
            rows={4}
            placeholder="Explain the steps taken..."
            style={{
              padding: "8px 12px", fontSize: 13, borderRadius: 6,
              border: `1px solid ${ORCA.border}`, outline: "none",
              resize: "none", cursor: "not-allowed", background: "#f8fafc"
            }}
          />
        </div>

        <button
          disabled
          type="button"
          style={{
            background: ORCA.textMuted, color: ORCA.white, border: "none",
            borderRadius: 6, padding: "10px 16px", fontSize: 13,
            fontWeight: 700, cursor: "not-allowed", marginTop: 8,
            display: "flex", justifyContent: "center", alignItems: "center"
          }}
        >
          Log Incident (Locked)
        </button>
      </form>
    </div>
  );
}
