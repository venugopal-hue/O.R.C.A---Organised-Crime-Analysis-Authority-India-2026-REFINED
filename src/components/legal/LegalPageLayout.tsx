"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── ORCA Design Tokens ──────────────────────────────────────────────────────
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
  orange:    "#f97316",
  shadow:    "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd:  "0 4px 12px rgba(0,0,0,0.08)",
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface TocEntry { id: string; label: string; level: 1 | 2; }

export interface LegalPageMeta {
  title:       string;
  subtitle:    string;
  version:     string;
  lastUpdated: string;
  approvedBy:  string;
  applicableSince: string;
  authority:   string;
  badge:       string; // e.g. "PRIVACY POLICY" | "TERMS OF USE" | "RTI"
}

interface Props {
  meta: LegalPageMeta;
  toc:  TocEntry[];
  children: React.ReactNode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const esc = query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: "#fde047", color: "#000", borderRadius: 2, padding: "0 2px" }}>{p}</mark>
          : p
      )}
    </>
  );
}

const chromeTranslations: Record<string, Record<string, string>> = {
  en: {
    home: "← Home",
    version: "VERSION",
    updated: "UPDATED",
    approved: "APPROVED",
    since: "SINCE",
    authority: "AUTHORITY",
    searchPlaceholder: "Search within document…",
    clear: "Clear",
    contents: "CONTENTS",
    copyright: "© 2026 Government of Karnataka. All rights reserved.",
    dept: "Karnataka State Police · Internal Security Division",
    title: "O.R.C.A — Organized Crime Analysis Authority"
  },
  kn: {
    home: "← ಮನೆ",
    version: "ಆವೃತ್ತಿ",
    updated: "ನವೀಕರಿಸಲಾಗಿದೆ",
    approved: "ಅನುಮೋದಿಸಲಾಗಿದೆ",
    since: "ಪ್ರಾರಂಭ",
    authority: "ಪ್ರಾಧಿಕಾರ",
    searchPlaceholder: "ಡಾಕ್ಯುಮೆಂಟ್ ಒಳಗೆ ಹುಡುಕಿ…",
    clear: "ಅಳಿಸಿ",
    contents: "ವಿಷಯಗಳು",
    copyright: "© 2026 ಕರ್ನಾಟಕ ಸರ್ಕಾರ. ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
    dept: "ಕರ್ನಾಟಕ ರಾಜ್ಯ ಪೊಲೀಸ್ · ಆಂತರಿಕ ಭದ್ರತಾ ವಿಭಾಗ",
    title: "ಒ.ಸಿ.ಆರ್.ಎ — ಸಂಘಟಿತ ಅಪರಾಧ ವಿಶ್ಲೇಷಣಾ ಪ್ರಾಧಿಕಾರ"
  },
  hi: {
    home: "← होम",
    version: "संस्करण",
    updated: "अद्यतित",
    approved: "स्वीकृत",
    since: "प्रारंभ",
    authority: "प्राधिकरण",
    searchPlaceholder: "दस्तावेज़ में खोजें…",
    clear: "साफ़ करें",
    contents: "विषय सूची",
    copyright: "© 2026 कर्नाटक सरकार। सर्वाधिकार सुरक्षित।",
    dept: "कर्नाटक राज्य पुलिस · आंतरिक सुरक्षा विभाग",
    title: "ओ.आर.सी.ए — संगठित अपराध विश्लेषण प्राधिकरण"
  }
};

export default function LegalPageLayout({ meta, toc, children }: Props) {
  const [search, setSearch]             = useState("");
  const [activeSection, setActive]      = useState(toc[0]?.id ?? "");
  const [showBackTop, setShowBackTop]   = useState(false);
  const [tocOpen, setTocOpen]           = useState(true);
  const [lang, setLang]                 = useState("en");
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync language from localStorage and manage Google Translate cookie & elements
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("ocra-lang") || "en";
      setLang(savedLang);

      // Load Google Translate widget if user language is kn or hi
      if (savedLang !== "en") {
        document.cookie = `googtrans=/en/${savedLang}; path=/;`;
        document.cookie = `googtrans=/en/${savedLang}; path=/; domain=${window.location.hostname};`;

        const scriptId = "google-translate-script";
        if (!document.getElementById(scriptId)) {
          const script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
          script.async = true;
          document.body.appendChild(script);

          (window as any).googleTranslateElementInit = () => {
            new (window as any).google.translate.TranslateElement({
              pageLanguage: 'en',
              layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false
            }, 'google_translate_element');
          };
        }
      }
    }
  }, []);

  const handleLanguageChange = (newLang: string) => {
    localStorage.setItem("ocra-lang", newLang);
    setLang(newLang);
    if (newLang === "en") {
      // Clear cookies for translation
      document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
      document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
    } else {
      document.cookie = `googtrans=/en/${newLang}; path=/;`;
      document.cookie = `googtrans=/en/${newLang}; path=/; domain=${window.location.hostname};`;
    }
    window.location.reload();
  };

  const currentTranslation = chromeTranslations[lang] || chromeTranslations.en;

  // Scroll-spy
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowBackTop(el.scrollTop > 300);
      let currentSection = toc[0]?.id || "";
      for (const entry of toc) {
        const node = el.querySelector(`[id="${entry.id}"]`);
        if (node) {
          const nodeRect = node.getBoundingClientRect();
          const containerRect = el.getBoundingClientRect();
          const relativeTop = nodeRect.top - containerRect.top + el.scrollTop;
          if (el.scrollTop >= relativeTop - 120) {
            currentSection = entry.id;
          }
        }
      }
      setActive(currentSection);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [toc]);

  const scrollTo = (id: string) => {
    const el = contentRef.current;
    if (!el) return;
    const node = el.querySelector(`[id="${id}"]`);
    if (node) {
      const nodeRect = node.getBoundingClientRect();
      const containerRect = el.getBoundingClientRect();
      const relativeTop = nodeRect.top - containerRect.top + el.scrollTop;
      el.scrollTo({ top: relativeTop - 20, behavior: "smooth" });
    }
    setActive(id);
  };

  // Inject search query into context so child sections can use it
  return (
    <SearchContext.Provider value={search}>
      {/* Google Translate target element */}
      <div id="google_translate_element" style={{ display: "none" }} />
      
      {/* ── Print-only mirror (outside overflow container) ── */}
      <div className="print-only" style={{ display: "none" }}>
        <div style={{ padding: "12mm 16mm", fontFamily: "'Inter', sans-serif", color: "#000" }}>
          <div style={{ borderBottom: "1pt solid #ccc", paddingBottom: 8, marginBottom: 20, display: "flex", justifyContent: "space-between", fontSize: 9 }}>
            <span style={{ fontWeight: 700, color: "#002855", letterSpacing: "0.05em" }}>{currentTranslation.title}</span>
            <span style={{ color: "#666" }}>Karnataka State Police · {meta.version} · {meta.lastUpdated}</span>
          </div>
          <div style={{ marginBottom: 8, display: "inline-block", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", color: "#FF9933", border: "1px solid #FF9933", padding: "2px 8px", borderRadius: 3 }}>{meta.badge}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#001f3f", margin: "6px 0 4px" }}>{meta.title}</h1>
          <p style={{ fontSize: 11, color: "#475569", marginBottom: 24 }}>{meta.subtitle}</p>
          {children}
        </div>
      </div>

      {/* ── Screen UI ── */}
      <div className="screen-ui" style={{
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
        }} className="no-print">
          <a href="/dashboard" style={{
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

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Language Selector Bar */}
            <div style={{ display: "flex", gap: 6 }} className="no-print">
              {(["en", "kn", "hi"] as const).map(l => (
                <button
                  key={l}
                  onClick={() => handleLanguageChange(l)}
                  style={{
                    background: lang === l ? "#FF9933" : "rgba(255,255,255,0.06)",
                    color: lang === l ? "#001f3f" : "#ffffff",
                    border: lang === l ? "none" : "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {l === "en" ? "EN" : l === "kn" ? "ಕನ್ನಡ" : "हिंदी"}
                </button>
              ))}
            </div>

            <a href="/index.html" style={{ ...btnStyle, textDecoration: "none", color: "inherit" }}>
              {currentTranslation.home}
            </a>
          </div>
        </header>

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div style={{
          background: ORCA.navyMid, color: ORCA.white,
          padding: "28px 32px 24px", flexShrink: 0,
          borderBottom: `3px solid ${ORCA.gold}`,
        }} className="no-print">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <span style={{
                display: "inline-block", fontSize: 9, fontWeight: 800,
                letterSpacing: "0.12em", color: ORCA.gold,
                fontFamily: "JetBrains Mono, monospace",
                background: "rgba(255,153,51,0.15)", padding: "3px 10px",
                borderRadius: 4, marginBottom: 10, border: "1px solid rgba(255,153,51,0.3)",
              }}>
                {meta.badge}
              </span>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>
                {meta.title}
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: 0 }}>{meta.subtitle}</p>
            </div>

            {/* Version metadata box */}
            <div style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6, padding: "12px 16px", fontSize: 11, lineHeight: 1.7,
              fontFamily: "JetBrains Mono, monospace", color: "rgba(255,255,255,0.7)",
              minWidth: 240,
            }}>
              <div><span style={{ color: ORCA.gold }}>{currentTranslation.version}</span> &nbsp;{meta.version}</div>
              <div><span style={{ color: ORCA.gold }}>{currentTranslation.updated}</span> &nbsp;{meta.lastUpdated}</div>
              <div><span style={{ color: ORCA.gold }}>{currentTranslation.approved}</span> &nbsp;{meta.approvedBy}</div>
              <div><span style={{ color: ORCA.gold }}>{currentTranslation.since}</span> &emsp;&nbsp;{meta.applicableSince}</div>
              <div><span style={{ color: ORCA.gold }}>{currentTranslation.authority}</span> {meta.authority}</div>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10, maxWidth: 500 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>🔍</span>
              <input
                type="search"
                placeholder={currentTranslation.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px 8px 34px", fontSize: 13,
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 6, color: ORCA.white, outline: "none",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>
            {search && (
              <button onClick={() => setSearch("")} style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                color: ORCA.white, borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 12,
              }}>{currentTranslation.clear}</button>
            )}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sticky TOC sidebar */}
          <aside style={{
            width: tocOpen ? 260 : 40, flexShrink: 0,
            background: ORCA.white, borderRight: `1px solid ${ORCA.border}`,
            display: "flex", flexDirection: "column",
            transition: "width 0.25s ease", overflow: "hidden",
          }} className="no-print">
            <div style={{
              padding: "12px 10px", borderBottom: `1px solid ${ORCA.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              {tocOpen && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace" }}>
                  {currentTranslation.contents}
                </span>
              )}
              <button
                onClick={() => setTocOpen(p => !p)}
                style={{ background: "none", border: "none", cursor: "pointer", color: ORCA.textMuted, fontSize: 16, padding: 0 }}
                title={tocOpen ? "Collapse" : "Expand"}
              >
                {tocOpen ? "‹" : "›"}
              </button>
            </div>

            {tocOpen && (
              <nav style={{ overflow: "auto", flex: 1, padding: "8px 0" }}>
                {toc.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => scrollTo(entry.id)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: entry.level === 1 ? "7px 14px" : "5px 14px 5px 24px",
                      fontSize: entry.level === 1 ? 12 : 11,
                      fontWeight: entry.level === 1 ? 700 : 400,
                      color: activeSection === entry.id ? ORCA.navy : ORCA.textGray,
                      background: activeSection === entry.id ? "rgba(0,31,63,0.06)" : "transparent",
                      border: "none", borderLeft: activeSection === entry.id ? `3px solid ${ORCA.gold}` : "3px solid transparent",
                      cursor: "pointer", lineHeight: 1.4,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>
            )}
          </aside>

          {/* Main content scroll area */}
          <main
            ref={contentRef}
            style={{
              flex: 1, overflowY: "auto", padding: "32px 40px",
              position: "relative",
            }}
          >
            <article style={{ maxWidth: 820, margin: "0 auto" }}>
              {children}
            </article>

            {/* Footer */}
            <footer style={{
              maxWidth: 820, margin: "48px auto 0",
              borderTop: `1px solid ${ORCA.border}`, paddingTop: 24,
              fontSize: 11, color: ORCA.textMuted, lineHeight: 1.6,
              display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <strong style={{ color: ORCA.textGray }}>{currentTranslation.title}</strong><br />
                {currentTranslation.dept}<br />
                {currentTranslation.copyright}
              </div>
              <div style={{ textAlign: "right" }}>
                Document: {meta.version} · {meta.lastUpdated}<br />
                Jurisdiction: State of Karnataka, India<br />
                <a href="/privacy" style={{ color: ORCA.textMuted, textDecoration: "none" }}>Privacy</a>
                {" · "}
                <a href="/terms" style={{ color: ORCA.textMuted, textDecoration: "none" }}>Terms</a>
                {" · "}
                <a href="/accessibility" style={{ color: ORCA.textMuted, textDecoration: "none" }}>Accessibility</a>
                {" · "}
                <a href="/rti" style={{ color: ORCA.textMuted, textDecoration: "none" }}>RTI</a>
                {" · "}
                <a href="/support" style={{ color: ORCA.textMuted, textDecoration: "none" }}>Support</a>
                {" · "}
                <a href="/report-issue" style={{ color: ORCA.textMuted, textDecoration: "none" }}>Report Issue</a>
              </div>
            </footer>
          </main>
        </div>

        {/* Back to top */}
        {showBackTop && (
          <button
            onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="no-print"
            style={{
              position: "fixed", bottom: 28, right: 28, zIndex: 500,
              background: ORCA.navy, color: ORCA.white,
              border: "none", borderRadius: "50%",
              width: 44, height: 44, fontSize: 18, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,31,63,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s",
            }}
            title="Back to top"
          >
            ↑
          </button>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        /* Screen: hide print-only div */
        .print-only { display: none !important; }

        @media print {
          /* Show print-only, hide screen UI */
          .print-only { display: block !important; }
          .screen-ui  { display: none !important; }

          /* Full page reset */
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: #000 !important;
          }

          /* Typography */
          h1 { font-size: 20pt; font-weight: 800; color: #001f3f; }
          h2 { font-size: 13pt; font-weight: 700; color: #001f3f; page-break-after: avoid; margin-top: 18pt; border-bottom: 0.5pt solid #ccc; padding-bottom: 4pt; }
          h3 { font-size: 11pt; font-weight: 600; color: #002855; page-break-after: avoid; }
          p, li { font-size: 10pt; line-height: 1.7; color: #222; }
          section { page-break-inside: avoid; margin-bottom: 18pt; }
          ul { padding-left: 18pt; margin-bottom: 10pt; }

          /* Cards / grids — stack vertically */
          div[style*="display: grid"], div[style*="display:grid"] {
            display: block !important;
          }

          /* Alert boxes */
          div[style*="border-left"] {
            border-left: 2pt solid #999 !important;
            background: #f5f5f5 !important;
            page-break-inside: avoid;
            margin-bottom: 10pt;
          }

          /* Page setup */
          @page {
            margin: 18mm 20mm 16mm 20mm;
            size: A4 portrait;
          }
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        input[type=search]::-webkit-search-cancel-button { display: none; }
        input[type=search]::placeholder { color: rgba(255,255,255,0.4); }

        /* Google Translate Chrome Header Hiding */
        iframe.goog-te-banner-frame {
          display: none !important;
        }
        body {
          top: 0px !important;
        }
        .goog-te-gadget {
          display: none !important;
        }
        #goog-gt-tt {
          display: none !important;
        }
        .goog-te-balloon-frame {
          display: none !important;
        }
      `}</style>
    </SearchContext.Provider>
  );
}

// ─── Shared sub-components exported for pages ─────────────────────────────────
export const SearchContext = React.createContext<string>("");

export function Section({ id, title, children, level = 1 }: {
  id: string; title: string; children: React.ReactNode; level?: 1 | 2;
}) {
  const q = React.useContext(SearchContext);
  return (
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 80 }}>
      {level === 1
        ? <h2 style={{
            fontSize: 17, fontWeight: 800, color: ORCA.navy, margin: "0 0 14px 0",
            paddingBottom: 10, borderBottom: `2px solid ${ORCA.border}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ display: "inline-block", width: 4, height: 18, background: ORCA.gold, borderRadius: 2, flexShrink: 0 }} />
            {highlight(title, q)}
          </h2>
        : <h3 style={{
            fontSize: 14, fontWeight: 700, color: ORCA.navyMid,
            margin: "20px 0 10px 0",
          }}>
            {highlight(title, q)}
          </h3>
      }
      {children}
    </section>
  );
}

export function Para({ children }: { children: React.ReactNode }) {
  const q = React.useContext(SearchContext);
  const text = typeof children === "string" ? highlight(children, q) : children;
  return <p style={{ fontSize: 13.5, color: ORCA.textGray, lineHeight: 1.75, margin: "0 0 12px 0" }}>{text}</p>;
}

export function Ul({ items }: { items: string[] }) {
  const q = React.useContext(SearchContext);
  return (
    <ul style={{ margin: "0 0 14px 0", paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 13.5, color: ORCA.textGray, lineHeight: 1.75, marginBottom: 4 }}>
          {highlight(item, q)}
        </li>
      ))}
    </ul>
  );
}

export function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const q = React.useContext(SearchContext);
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "10px 14px", borderRadius: 6,
      background: accent ? "rgba(0,31,63,0.04)" : ORCA.white,
      border: `1px solid ${ORCA.border}`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: ORCA.navy }}>{highlight(value, q)}</span>
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function AlertBox({ type, children }: { type: "note" | "warning" | "important"; children: React.ReactNode }) {
  const colors = {
    note:      { bg: "rgba(59,130,246,0.06)",  border: "#93c5fd", icon: "ℹ", text: "#1d4ed8" },
    warning:   { bg: "rgba(245,158,11,0.07)",  border: "#fcd34d", icon: "⚠", text: "#b45309" },
    important: { bg: "rgba(239,68,68,0.06)",   border: "#fca5a5", icon: "⚡", text: "#b91c1c" },
  }[type];
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`,
      borderLeft: `4px solid ${colors.border}`,
      borderRadius: 6, padding: "12px 14px",
      fontSize: 13, color: colors.text, marginBottom: 16, lineHeight: 1.6,
      display: "flex", gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{colors.icon}</span>
      <div>{children}</div>
    </div>
  );
}

// Button style for header
const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#fff", borderRadius: 6, padding: "6px 12px",
  cursor: "pointer", fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  display: "flex", alignItems: "center", gap: 4,
};
