import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOfficerPhoto } from "@/lib/useOfficerPhoto";
import { useAuth } from "@/context/AuthContext";
import { OrcaBrand } from "./OrcaBrand";
import { useIntelligence } from "@/context/IntelligenceContext";
import { Command } from "lucide-react";
import { VoiceCommandPalette } from "@/components/dynamic/VoiceCommandPalette";

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
  const [commandOpen, setCommandOpen] = useState(false);

  // Ctrl/Cmd+K opens the voice command palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const officerPhoto = useOfficerPhoto();
  const [mounted, setMounted] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  /**
   * NETWORK TRUST / VPN LOCKDOWN
   *
   * Three bugs fixed here, all of which meant the lockout could fail to fire:
   *
   * 1. The countdown effect listed `officerProfile` in its dependencies and
   *    reset the timer to 30 on every run. `officerProfile` is a new object on
   *    each auth refresh, so the timer restarted and could reach zero only if
   *    nothing re-rendered for the full period. The forced sign-out was
   *    therefore unreliable in exactly the situation it exists for.
   *
   * 2. The poll effect depended on `vpnDetected`, so it tore down and rebuilt
   *    its 5-second interval every time the flag changed, and read a STALE
   *    `wasVpnDetected` out of the closure to decide whether to report.
   *
   * 3. The 30-second period was a literal. It is a setting now, returned by the
   *    route, so the department chooses it.
   *
   * A ref holds the deadline so re-renders cannot move it.
   */
  const [vpnDetected, setVpnDetected] = useState(false);
  const [vpnMessage, setVpnMessage] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string>("");
  const [ispName, setIspName] = useState<string>("");
  const [vpnEnforce, setVpnEnforce] = useState(true);
  const [vpnCountdown, setVpnCountdown] = useState<number | null>(null);
  const lockoutAtRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  const sessionRowId = () =>
    typeof window !== "undefined" ? sessionStorage.getItem("orca_session_rowid") || "" : "";

  /** Tell the server. Identity comes from the session there, never from here. */
  const reportUntrustedNetwork = useCallback(async (outcome: "WARNED" | "LOCKED_OUT") => {
    try {
      await fetch("/api/security/vpn-check", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, sessionRowId: sessionRowId() }),
      });
    } catch {
      // A recording failure must not stop the lockout itself.
    }
  }, []);

  // Poll. One interval for the life of the component — no dependency on the
  // flag it sets, so it is never rebuilt mid-countdown.
  useEffect(() => {
    if (!officerProfile) return;
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/security/vpn-check");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.success) return;

        setClientIp(data.clientIp || "");
        setIspName(data.networkName || "");
        setVpnEnforce(Boolean(data.enforce));

        if (data.vpnDetected) {
          setVpnMessage(data.message || null);
          setVpnDetected(true);
          // Start the clock once per episode, from the server's grace period.
          if (lockoutAtRef.current === null) {
            const grace = Number(data.graceSeconds) || 30;
            lockoutAtRef.current = Date.now() + grace * 1000;
            setVpnCountdown(grace);
          }
          // Reported once per episode, not once per poll.
          if (!reportedRef.current) {
            reportedRef.current = true;
            void reportUntrustedNetwork("WARNED");
          }
        } else {
          // Disconnecting the VPN clears the episode and the clock.
          setVpnDetected(false);
          setVpnMessage(null);
          lockoutAtRef.current = null;
          reportedRef.current = false;
          setVpnCountdown(null);
        }
      } catch {
        // Network blip: leave any running countdown alone rather than
        // cancelling a lockout because one poll failed.
      }
    }

    void check();
    /**
     * 60 seconds, not 5.
     *
     * The poll drove a geo lookup on the server, and ip-api's free tier allows
     * 45 requests a MINUTE for the whole deployment. At 5s each, twelve
     * officers signed in exhausted the quota permanently — after which every
     * lookup failed, and a failed lookup is trusted, so the check silently
     * stopped checking while still reporting "secure".
     *
     * The server now caches per address for ten minutes, so this interval no
     * longer costs a lookup each time; 60s keeps detection prompt (the grace
     * countdown is 30s by default and starts on the first positive) without
     * the poll itself being the thing that breaks the check.
     */
    const id = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officerProfile?.uid]);

  // The countdown itself, driven off the deadline in the ref.
  useEffect(() => {
    if (!vpnDetected || !vpnEnforce) return;
    const tick = setInterval(() => {
      const deadline = lockoutAtRef.current;
      if (deadline === null) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setVpnCountdown(left);
      if (left > 0) return;

      clearInterval(tick);
      // Record the escalation, close the session row, then sign out.
      void reportUntrustedNetwork("LOCKED_OUT");
      fetch("/api/auth/session-log", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "x-login-time":
            typeof window !== "undefined" ? sessionStorage.getItem("orca_login_time") || "" : "",
        },
        body: JSON.stringify({
          action: "END",
          sessionId: typeof window !== "undefined" ? sessionStorage.getItem("orca_session_id") || null : null,
          rowId: sessionRowId() || null,
          reason: "VPN_LOCKDOWN",
        }),
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent("orca_initiate_logout"));
    }, 1000);
    return () => clearInterval(tick);
  }, [vpnDetected, vpnEnforce, reportUntrustedNetwork]);

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
            {/* "SECURE LINK" used to show for ANY network that failed to match
                a keyword — asserting a verified departmental connection about an
                address nothing had checked. It now reports the clearance, which
                is a fact we hold, rather than a claim about the network. */}
            {vpnDetected
              ? "⚠️ UNTRUSTED NETWORK DETECTED"
              : activeLoggedIn
                ? `LINK OK // ${officerProfile?.clearanceLevel || "NO CLEARANCE"}`
                : "INGRESS PENDING"}
          </div>

          {activeLoggedIn && (
            <button
              id="orca-voice-command"
              onClick={() => setCommandOpen(true)}
              title="Voice command (Ctrl+K)"
              aria-label="Open voice command"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: commandOpen ? "1.5px solid #FF9933" : "1.5px solid rgba(255,255,255,0.35)",
                background: commandOpen ? "rgba(255,153,51,0.12)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                color: commandOpen ? "#FF9933" : "rgba(255,255,255,0.75)",
                transition: "all 0.2s ease", flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#FF9933";
                (e.currentTarget as HTMLElement).style.color = "#FF9933";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,153,51,0.1)";
              }}
              onMouseLeave={e => {
                if (!commandOpen) {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.35)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              <Command style={{ width: 14, height: 14 }} />
            </button>
          )}

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
                      if (r === "admin_full" || r === "command_admin" || r === "ADMIN") return `${rank} • Full Command Admin`;
                      if (r === "scrb_officer" || r === "admin_scrb") return `${rank} • SCRB`;
                      if (r === "admin_verification" || r === "verification_admin") return `${rank} • Verification Admin`;
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
                  {/* The capture stored in Catalyst, not a base64 blob carried on the
                      Firestore profile. Falls back to initials — never to "RKS",
                      which looked like a real officer's initials. */}
                  {officerPhoto ? (
                    <img src={officerPhoto} alt="Officer profile photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : officerProfile?.name ? (
                    officerProfile.name.split(" ").filter(n => n.length > 0 && /^[a-zA-Z]/.test(n)).map(n => n[0]).join("").substring(0, 3).toUpperCase()
                  ) : "—"}
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

      {/* Voice command palette — blurs the screen, listens, and switches tabs. */}
      {commandOpen && <VoiceCommandPalette onClose={() => setCommandOpen(false)} />}

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
                {/* Only shown when enforcement is ON. Announcing a lockdown
                    that will not happen is the kind of empty threat that
                    teaches officers to ignore the banner. */}
                {vpnEnforce && vpnCountdown !== null && (
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
                    🚨 SIGN-OUT IN {String(vpnCountdown).padStart(2, "0")}s
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", marginTop: 3 }}>
                {vpnMessage || `This session is routing through ${ispName || "an untrusted network"}.`}{" "}
                {vpnEnforce
                  ? <>Disconnect the VPN to cancel. Otherwise this session will be closed in <strong>{vpnCountdown ?? 0} seconds</strong>.</>
                  : <>Enforcement is off, so you will not be signed out — but this has been recorded.</>}{" "}
                A warning has been recorded for administrative review.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#fef08a", fontFamily: "JetBrains Mono, monospace", fontStyle: "italic" }}>
              {vpnEnforce ? "DISCONNECT VPN TO CANCEL" : "RECORDED — NOT ENFORCED"}
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
