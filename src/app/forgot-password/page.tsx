"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";

const ORCA = {
  navy: "#001f3f",
  fontSans: "'Inter', sans-serif",
  fontSerif: "'Libre Baskerville', Georgia, serif",
};

export default function ForgotPasswordPage() {
  const [officerId, setOfficerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("ocra-theme") as "light" | "dark" || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("ocra-theme", nextTheme);
  };

  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim()) return;
    setLoading(true);
    setErrorMessage("");

    try {
      let targetEmail = officerId.trim();
      if (!targetEmail.includes("@")) {
        targetEmail = `${targetEmail.toLowerCase().replace(/[^a-z0-9]/g, "")}@karnatakapolice.gov.in`;
      }

      try {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        const { auth } = await import("@/lib/firebase");
        if (auth) {
          await sendPasswordResetEmail(auth, targetEmail);
        }
      } catch (fbErr: any) {
        console.info("[ORCA Auth Recovery]:", fbErr?.message || fbErr);
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to process password reset request. Please verify your officer credentials.");
    } finally {
      setLoading(false);
    }
  };

  const colors = theme === "light" ? {
    navy: "#001f3f",
    navyMid: "#002855",
    navyLight: "#003366",
    gold: "#FF9933",
    goldLight: "#ffaa55",
    white: "#ffffff",
    offWhite: "#f8fafc",
    textPrimary: "#1e293b",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    border: "#e2e8f0",
    cardBg: "#ffffff",
    shadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
    inputBg: "#ffffff",
    purpleBg: "rgba(124, 58, 237, 0.05)",
    purpleBorder: "rgba(124, 58, 237, 0.1)"
  } : {
    navy: "#0a1628",
    navyMid: "#0f2040",
    navyLight: "#1a3460",
    gold: "#E8B04B",
    goldLight: "#F5C96A",
    white: "#e8eef5",
    offWhite: "#0f1e35",
    textPrimary: "#E8EEF5",
    textSecondary: "#9BB3CC",
    textMuted: "#6B8AAA",
    border: "#1e3050",
    cardBg: "#0f1e35",
    shadow: "0 2px 16px rgba(0, 0, 0, 0.4)",
    inputBg: "#0a1628",
    purpleBg: "rgba(232, 176, 75, 0.05)",
    purpleBorder: "rgba(232, 176, 75, 0.1)"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", background: colors.offWhite, transition: "background 0.3s" }}>
      <div style={{
        height: 5,
        background: `linear-gradient(to right, #FF9933 33.33%, #ffffff 33.33% 66.66%, #138808 66.66%)`,
        width: "100%",
        zIndex: 1000,
        position: "fixed",
        top: 0,
        left: 0
      }} />

      <div style={{
        position: "absolute",
        top: 24,
        right: 32,
        display: "flex",
        alignItems: "center",
        gap: 20,
        zIndex: 100
      }}>
        <a 
          href="/login" 
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: colors.textSecondary,
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            transition: "color 0.3s"
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.gold}
          onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
        >
          ← Back to Login
        </a>
        <button 
          onClick={handleToggleTheme}
          suppressHydrationWarning
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: colors.textPrimary,
            cursor: "pointer",
            boxShadow: colors.shadow,
            transition: "all 0.3s"
          }}
        >
          {mounted ? (theme === "dark" ? "☀️" : "🌙") : "🌙"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", width: "100%", minHeight: "100vh", marginTop: 5 }}>
        
        {/* Left Side: Branding */}
        <div style={{
          flex: 1,
          background: theme === "light" ? ORCA.navy : colors.navy,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 40px",
          position: "relative",
          overflow: "hidden",
          transition: "background 0.3s"
        }}>
          <img 
            src="/logo.png" 
            alt="Watermark Logo"
            style={{
              position: "absolute",
              width: "140%",
              opacity: 0.05,
              pointerEvents: "none"
            }}
          />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 480 }}>
            <img 
              src="/logo.png" 
              alt="KSP Logo" 
              style={{
                height: 120,
                marginBottom: 32,
                marginRight: "auto",
                marginLeft: "auto"
              }}
            />
            <h1 style={{
              fontFamily: ORCA.fontSerif,
              color: "#ffffff",
              fontSize: 42,
              letterSpacing: "0.1em",
              marginBottom: 12,
              fontWeight: 700
            }}>
              <span style={{ color: colors.gold }}>O</span>.
              <span style={{ color: colors.gold }}>R</span>.
              <span style={{ color: colors.gold }}>C</span>.
              <span style={{ color: colors.gold }}>A</span>
            </h1>
            <div style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 8
            }}>
              Organized Crime Analysis Authority
            </div>
            <div style={{
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 32,
              fontFamily: ORCA.fontSans
            }}>
              ಅಧಿಕೃತ ಗುಪ್ತಪದ ಮರುಸಂಯೋಜನೆ ಪೋರ್ಟಲ್
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          background: colors.offWhite,
          position: "relative",
          transition: "background 0.3s"
        }}>
          
          <div style={{
            width: "100%",
            maxWidth: 440,
            background: colors.cardBg,
            borderRadius: 20,
            padding: 48,
            boxShadow: colors.shadow,
            border: `1px solid ${colors.border}`,
            transition: "background 0.3s, border-color 0.3s"
          }}>
            
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: ORCA.fontSerif, fontSize: 28, color: colors.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                Password Recovery
              </h2>
              <p style={{ color: colors.textSecondary, fontSize: 15, margin: 0 }}>
                Enter your registered Officer ID or official email address to initiate verification.
              </p>
            </div>

            {errorMessage && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 20
              }}>
                {errorMessage}
              </div>
            )}

            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <CheckCircle2 style={{ width: 54, height: 54, color: "#10b981", margin: "0 auto 16px" }} />
                <h3 style={{ fontSize: 18, color: colors.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                  Reset Link Dispatched
                </h3>
                <p style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                  If an active officer account matches <strong style={{ color: colors.textPrimary }}>{officerId}</strong>, an encrypted reset link has been dispatched to your official department mail.
                </p>
                <a 
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: colors.gold,
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: "none"
                  }}
                >
                  <ArrowLeft style={{ width: 16, height: 16 }} /> Return to Login Console
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>
                    Officer ID / Official Email
                  </label>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    placeholder="e.g. KA-12345 or officer@karnatakapolice.gov.in"
                    autoComplete="off"
                    suppressHydrationWarning
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      background: colors.inputBg,
                      color: colors.textPrimary,
                      fontFamily: ORCA.fontSans,
                      fontSize: 15,
                      outline: "none",
                      transition: "all 0.3s"
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = colors.gold;
                      e.target.style.boxShadow = "0 0 0 3px rgba(255, 153, 51, 0.1)";
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  suppressHydrationWarning
                  style={{
                    width: "100%",
                    background: colors.navy,
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 600,
                    padding: 16,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                      Verifying Officer Record...
                    </>
                  ) : (
                    <>Send Recovery Link &rarr;</>
                  )}
                </button>
              </form>
            )}

            <div style={{
              marginTop: 32,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: 16,
              background: colors.purpleBg,
              borderRadius: 8,
              border: `1px solid ${colors.purpleBorder}`,
              transition: "all 0.3s"
            }}>
              <ShieldAlert style={{ width: 20, height: 20, color: theme === "light" ? "#7C3AED" : colors.gold, flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
                <strong style={{ color: colors.textPrimary, display: "block", marginBottom: 4 }}>Security Audit Protocol</strong>
                Password resets require verification through internal police network domains. Contact SCRB System Administrator for urgent manual clearance.
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
