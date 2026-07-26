import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { OrcaBrand } from "./OrcaBrand";
import { useIntelligence } from "@/context/IntelligenceContext";

interface TourStep {
  targetId: string;
  eyebrow: string;
  title: string;
  description: string;
  nextLabel: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "nav-bulletins",
    eyebrow: "GETTING STARTED · 1 OF 4",
    title: "Official Bulletins",
    description: "Check this daily for critical state directives, official circulars, and SCRB broadcasts sent directly from headquarters.",
    nextLabel: "Next →"
  },
  {
    targetId: "nav-dashboard",
    eyebrow: "GETTING STARTED · 2 OF 4",
    title: "Command Overview",
    description: "Your live operational dashboard — view threat indices, active patrol rates, OCR integrity scores and real-time crime telemetry at a glance.",
    nextLabel: "Next →"
  },
  {
    targetId: "nav-chatbot",
    eyebrow: "GETTING STARTED · 3 OF 4",
    title: "AI Chatbot",
    description: "Ask questions in English, Hindi, or Kannada. The O.R.C.A AI Core queries SCRB crime records and delivers instant intelligence analysis.",
    nextLabel: "Next →"
  },
  {
    targetId: "mini-ai-float-btn",
    eyebrow: "GETTING STARTED · 4 OF 4",
    title: "Quick AI Assistant",
    description: "This floating button opens the O.R.C.A Mini AI Assistant from anywhere on the platform — ask questions, run queries, and get instant responses without leaving your current view.",
    nextLabel: "Get Started ✓"
  }
];

const CARD_WIDTH = 290;
const CARD_OFFSET = 16;
const HIGHLIGHT_PADDING = 6;

export const Topbar: React.FC = () => {
  const { isLoggedIn, officerProfile, dashboardRole, isdLevel } = useAuth();
  const { activeTab } = useIntelligence();
  const [mounted, setMounted] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const [vpnDetected, setVpnDetected] = useState(false);
  const [vpnMessage, setVpnMessage] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string>("127.0.0.1");
  const [ispName, setIspName] = useState<string>("Localhost Ingress");
  const [vpnCountdown, setVpnCountdown] = useState<number>(30);

  useEffect(() => { setMounted(true); }, []);

  // Mandatory VPN Lockdown Countdown & Forced Security Logout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (vpnDetected) {
      setVpnCountdown(30);
      timer = setInterval(() => {
        setVpnCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Save VPN Lockdown to local session history
            try {
              const existing = JSON.parse(localStorage.getItem("orca_session_history") || "[]");
              const loginTimeStr = sessionStorage.getItem("orca_login_time");
              const nowStr = new Date().toISOString();
              let durationStr = "00h 01m 30s";
              if (loginTimeStr) {
                const diffSecs = Math.floor((Date.now() - new Date(loginTimeStr).getTime()) / 1000);
                const h = Math.floor(diffSecs / 3600);
                const m = Math.floor((diffSecs % 3600) / 60);
                const s = diffSecs % 60;
                durationStr = `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
              }
              if (existing.length > 0) {
                existing[0].logoutTime = nowStr;
                existing[0].duration = durationStr;
                existing[0].status = "VPN_LOCKDOWN_FORCED";
                existing[0].reason = "VPN_LOCKDOWN";
                localStorage.setItem("orca_session_history", JSON.stringify(existing));
              }
            } catch (e) {}

            // Log forced VPN lockdown session end in Firestore
            fetch("/api/auth/session-log", {
              method: "POST",
              keepalive: true,
              headers: { 
                "Content-Type": "application/json",
                "x-login-time": typeof window !== "undefined" ? sessionStorage.getItem("orca_login_time") || "" : ""
              },
              body: JSON.stringify({
                action: "END",
                uid: officerProfile?.uid || "",
                email: officerProfile?.email || "",
                name: officerProfile?.name || "Officer",
                sessionId: typeof window !== "undefined" ? sessionStorage.getItem("orca_session_id") || null : null,
                reason: "VPN_LOCKDOWN"
              })
            }).catch(() => {});

            // Force immediate security logout
            window.dispatchEvent(new CustomEvent("orca_initiate_logout"));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setVpnCountdown(30);
    }
    return () => clearInterval(timer);
  }, [vpnDetected, officerProfile]);

  // VPN / Proxy Detection Check
  useEffect(() => {
    async function checkVpnStatus() {
      try {
        const isSimulated = typeof window !== "undefined" && window.location.search.includes("simulateVpn=true");
        const fetchUrl = isSimulated ? "/api/security/vpn-check?simulateVpn=true" : "/api/security/vpn-check";
        const res = await fetch(fetchUrl);
        const data = await res.json();
        if (data.success) {
          setClientIp(data.clientIp || "127.0.0.1");
          setIspName(data.ispName || "Localhost Ingress");
          
          const wasVpnDetected = vpnDetected;
          setVpnDetected(!!data.vpnDetected);

          if (data.vpnDetected && !wasVpnDetected) {
            setVpnMessage(data.warningMessage);
            // Log security audit to Firestore once when triggered
            if (officerProfile) {
              fetch("/api/security/vpn-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  officerName: officerProfile.name,
                  officerEmail: officerProfile.email,
                  clientIp: data.clientIp,
                  vpnDetails: `Untrusted proxy/VPN connection detected [ISP: ${data.ispName}]. Mandatory lockdown timer initiated.`
                })
              }).catch(e => console.error("VPN audit log failed", e));
            }
          }
        }
      } catch (err) {
        console.warn("VPN check bypassed", err);
      }
    }
    checkVpnStatus();
    const interval = setInterval(checkVpnStatus, 5000);
    return () => clearInterval(interval);
  }, [officerProfile, vpnDetected]);

  // Auto-open tour for NEW users (first login ever)
  useEffect(() => {
    if (!isLoggedIn || !officerProfile) return;
    const role = officerProfile.role || "";
    // Skip tour entirely if user has an administrative role, is in admin controls, or is in the AI Chatbot section
    if (role.includes("Admin") || role.includes("Verification") || activeTab?.startsWith("admin-") || activeTab === "chatbot") {
      return;
    }
    const uid = officerProfile.uid || officerProfile.email || "default";
    const seenKey = `orca_tour_seen_${uid}`;
    if (!localStorage.getItem(seenKey)) {
      // Small delay so the sidebar finishes rendering before spotlight targets elements
      const t = setTimeout(() => {
        setTutorialStep(0);
        setTutorialOpen(true);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [isLoggedIn, officerProfile, activeTab]);

  const activeLoggedIn = mounted ? isLoggedIn : true;

  useEffect(() => {
    if (!tutorialOpen) return;
    const computePositions = () => {
      const step = TOUR_STEPS[tutorialStep];
      const el = document.getElementById(step.targetId);
      if (!el) { setSpotlightRect(null); setCardPos(null); return; }
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);

      const nearBottom = rect.bottom > window.innerHeight * 0.6;
      const nearRight = rect.right > window.innerWidth * 0.6;

      let cardTop: number;
      let cardLeft: number;

      if (nearBottom) {
        // Place card ABOVE the element
        cardTop = rect.top - 240;
      } else {
        cardTop = rect.top + rect.height / 2 - 80;
      }

      if (nearRight) {
        // Place card to the LEFT of the element
        cardLeft = rect.left - CARD_WIDTH - CARD_OFFSET;
      } else {
        cardLeft = rect.right + CARD_OFFSET;
      }

      setCardPos({
        top: Math.max(80, Math.min(cardTop, window.innerHeight - 300)),
        left: Math.max(16, Math.min(cardLeft, window.innerWidth - CARD_WIDTH - 16))
      });
    };
    computePositions();
    const t = setTimeout(computePositions, 80);
    return () => clearTimeout(t);
  }, [tutorialOpen, tutorialStep]);

  const closeTutorial = () => {
    // Mark tour as seen for this user so it never auto-opens again
    if (officerProfile) {
      const uid = officerProfile.uid || officerProfile.email || "default";
      localStorage.setItem(`orca_tour_seen_${uid}`, "1");
    }
    setTutorialOpen(false);
    setTutorialStep(0);
    setSpotlightRect(null);
    setCardPos(null);
  };

  const nextStep = () => {
    if (tutorialStep < TOUR_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1);
    } else {
      closeTutorial();
    }
  };

  const step = TOUR_STEPS[tutorialStep];
  const hl = spotlightRect
    ? {
        x: spotlightRect.left - HIGHLIGHT_PADDING,
        y: spotlightRect.top - HIGHLIGHT_PADDING,
        w: spotlightRect.width + HIGHLIGHT_PADDING * 2,
        h: spotlightRect.height + HIGHLIGHT_PADDING * 2
      }
    : null;

  return (
    <>
      <header style={{
        height: "60px",
        background: "#002855",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexShrink: 0,
        zIndex: 50,
        position: "relative"
      }}>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <OrcaBrand />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Security Link Badge */}
          <div 
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "JetBrains Mono, monospace", fontSize: 11,
              color: vpnDetected ? "#f87171" : activeLoggedIn ? "#10b981" : "#f87171",
              background: vpnDetected ? "rgba(239, 68, 68, 0.25)" : activeLoggedIn ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
              border: vpnDetected ? "1px solid rgba(239,68,68,0.5)" : "none",
              padding: "4px 8px", borderRadius: 4,
              transition: "all 0.3s ease"
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: vpnDetected ? "#ef4444" : activeLoggedIn ? "#10b981" : "#f87171",
              display: "inline-block", animation: "pulse 1.2s infinite"
            }} />
            {vpnDetected 
              ? `⚠️ INSECURE LINK // PROXY-VPN DETECTED` 
              : activeLoggedIn 
                ? `SECURE LINK // ${officerProfile?.clearanceLevel || "ISD-LEVEL-IV"}` 
                : "SECURE LINK // INGRESS PENDING"}
          </div>

          {activeLoggedIn && !activeTab?.startsWith("admin-") && activeTab !== "chatbot" && !(officerProfile?.role || "").includes("Admin") && !(officerProfile?.role || "").includes("Verification") && (
            <button
              onClick={() => { setTutorialStep(0); setTutorialOpen(true); }}
              title="Start Platform Tour"
              style={{
                width: 24, height: 24, borderRadius: "50%",
                border: tutorialOpen ? "1.5px solid #FF9933" : "1.5px solid rgba(255,255,255,0.35)",
                background: tutorialOpen ? "rgba(255,153,51,0.12)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                color: tutorialOpen ? "#FF9933" : "rgba(255,255,255,0.75)",
                fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif",
                transition: "all 0.2s ease", flexShrink: 0
              }}
              onMouseEnter={e => {
                if (!tutorialOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "#FF9933";
                  (e.currentTarget as HTMLElement).style.color = "#FF9933";
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,153,51,0.1)";
                }
              }}
              onMouseLeave={e => {
                if (!tutorialOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.35)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              ?
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "white", textAlign: "right" }}>
            {isLoggedIn ? (
              <>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {officerProfile?.name ? officerProfile.name.split(" ")[0] : "Officer"}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                    {(() => {
                      const r = (dashboardRole || officerProfile?.role || "") as string;
                      const rank = officerProfile?.rank || "Developer";
                      if (r === "admin_full" || r === "admin_l2" || r === "ADMIN") return `${rank} • Full Command Admin`;
                      if (r === "admin_scrb") return `${rank} • SCRB Exec Admin`;
                      if (r === "admin_verification" || r === "admin_l1") return `${rank} • Verification Admin`;
                      if (r === "it_admin") return `${rank} • IT Security Admin`;
                      if (r === "investigation_l2") return `${rank} • Senior Investigator`;
                      if (r === "investigation_l1") return `${rank} • Field Investigator`;
                      return `${rank} • ${r.replace(/_/g, " ")}`;
                    })()}
                  </span>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("orca_initiate_logout"))}
                    style={{
                      fontSize: 9, color: "#f87171",
                      fontFamily: "JetBrains Mono, monospace",
                      background: "transparent", border: "none",
                      cursor: "pointer", textAlign: "right",
                      padding: 0, marginTop: 2, lineHeight: 1, textDecoration: "none"
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
                  >
                    [SIGN OUT]
                  </button>
                </div>
                <div style={{
                  width: 32, height: 32, background: "#FF9933", color: "#001f3f",
                  borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 700, fontSize: 14,
                  flexShrink: 0, userSelect: "none", overflow: "hidden"
                }}>
                  {officerProfile?.photoUrl ? (
                    <img src={officerProfile.photoUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : officerProfile?.name ? (
                    officerProfile.name.split(" ").filter(n => n.length > 0 && /^[a-zA-Z]/.test(n)).map(n => n[0]).join("").substring(0, 3).toUpperCase()
                  ) : "RKS"}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                <span>AWAITING INGRESS</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* VPN / UNTRUSTED NETWORK SECURITY WARNING BANNER */}
      {vpnDetected && (
        <div style={{
          background: "#990000",
          color: "#ffffff",
          borderBottom: "2px solid #ef4444",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(153,0,0,0.3)",
          animation: "fadeIn 0.3s ease",
          zIndex: 49
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ color: "#fef08a", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.02em", fontSize: 12.5 }}>
                  SECURITY ALERT: UNTRUSTED PROXY / VPN NETWORK DETECTED [{clientIp} | {ispName}]
                </strong>
                <span style={{
                  background: "#fef08a",
                  color: "#990000",
                  fontWeight: 900,
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: "0.05em",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                }}>
                  🚨 LOCKDOWN IN {String(vpnCountdown).padStart(2, "0")}s
                </span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 3 }}>
                Operational session is routing through external VPN/Proxy provider (<strong>{ispName}</strong>). Disconnect external VPN immediately or system will forcibly lock down and terminate session in <strong>{vpnCountdown} seconds</strong>. Security violation alert dispatched directly to State Command Administrators.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#fef08a", fontFamily: "JetBrains Mono, monospace", fontStyle: "italic" }}>
              DISCONNECT VPN TO CANCEL
            </span>
          </div>
        </div>
      )}

      {/* SPOTLIGHT TOUR */}
      {tutorialOpen && (
        <>
          {/* SVG mask overlay with cutout hole */}
          <svg
            style={{
              position: "fixed", inset: 0,
              width: "100vw", height: "100vh",
              zIndex: 9998, pointerEvents: "none"
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="orca-spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                {hl && (
                  <rect x={hl.x} y={hl.y} width={hl.w} height={hl.h} rx={6} ry={6} fill="black" />
                )}
              </mask>
            </defs>
            <rect
              width="100%" height="100%"
              fill="rgba(8,15,30,0.72)"
              mask="url(#orca-spotlight-mask)"
            />
            {hl && (
              <rect
                x={hl.x} y={hl.y} width={hl.w} height={hl.h}
                rx={6} ry={6}
                fill="none" stroke="#FF9933" strokeWidth="1.5" opacity="0.85"
              />
            )}
          </svg>

          {/* Click-to-close backdrop (above SVG, below card) */}
          <div
            onClick={closeTutorial}
            style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: "default" }}
          />

          {/* White floating card */}
          {cardPos && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: "fixed",
                top: cardPos.top,
                left: cardPos.left,
                width: CARD_WIDTH,
                zIndex: 10000,
                background: "#ffffff",
                borderRadius: 12,
                padding: "22px 22px 18px",
                boxShadow: "0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.10)",
                fontFamily: "Inter, sans-serif",
                animation: "orcaFadeIn 0.2s cubic-bezier(0.2,0.8,0.2,1)"
              }}
            >
              <style>{`
                @keyframes orcaFadeIn {
                  from { opacity:0; transform:translateY(6px) scale(0.97); }
                  to   { opacity:1; transform:translateY(0) scale(1); }
                }
              `}</style>

              <p style={{
                fontSize: 10.5, fontWeight: 700, color: "#FF9933",
                letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 7
              }}>
                {step.eyebrow}
              </p>

              <h3 style={{
                fontSize: 16.5, fontWeight: 700, color: "#0D1B2A",
                marginBottom: 9, lineHeight: 1.3
              }}>
                {step.title}
              </h3>

              <p style={{
                fontSize: 13, color: "#3D5068",
                lineHeight: "1.65", marginBottom: 18
              }}>
                {step.description}
              </p>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  onClick={closeTutorial}
                  style={{
                    background: "transparent", border: "none",
                    color: "#6B7E94", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", padding: 0
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#0D1B2A")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6B7E94")}
                >
                  Skip tour
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {TOUR_STEPS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setTutorialStep(i)}
                        style={{
                          width: i === tutorialStep ? 16 : 6,
                          height: 6, borderRadius: 4,
                          background: i === tutorialStep ? "#002855" : "#D4DCE6",
                          border: "none", cursor: "pointer", padding: 0,
                          transition: "all 0.2s ease"
                        }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={nextStep}
                    style={{
                      background: "#002855", color: "white",
                      border: "none", borderRadius: 7,
                      padding: "8px 15px", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#003a75")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#002855")}
                  >
                    {step.nextLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
