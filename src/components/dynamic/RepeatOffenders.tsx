"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ORCA_TOKENS } from "@/lib/theme";
import { AlertTriangle, Loader2, RefreshCw, Inbox, X, ArrowLeft } from "lucide-react";
import { OrcaLoader } from "@/components/dynamic/OrcaLoader";
import type { RepeatAccused } from "@/app/api/accused/repeat/route";

const NAVY   = ORCA_TOKENS.navy;
const BORDER = ORCA_TOKENS.border;
const WHITE  = ORCA_TOKENS.white;
const GRAY   = ORCA_TOKENS.textGray;
const MUTED  = ORCA_TOKENS.textMuted;
const SAFFRON = "#FF9933";

const THRESHOLDS = [2, 3, 5, 10] as const;

type Case = RepeatAccused["cases"][number];

function GravityChip({ isHeinous, label }: { isHeinous: boolean; label: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
      background: isHeinous ? "#fef2f2" : "#f1f5f9",
      color: isHeinous ? "#991b1b" : GRAY,
    }}>{label}</span>
  );
}

function StatusPill({ statusId }: { statusId: number }) {
  const colour = statusId === 3 ? "#15803d" : statusId === 2 ? "#1d4ed8" : "#dc2626";
  const bg     = statusId === 3 ? "#f0fdf4" : statusId === 2 ? "#eff6ff" : "#fef2f2";
  const label  = statusId === 3 ? "Closed" : statusId === 2 ? "Charge-sheeted" : "Active";
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: bg, color: colour }}>
      {label}
    </span>
  );
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

function riskLevel(a: RepeatAccused): RiskLevel {
  let score = Math.min(a.caseCount * 2, 10);
  score += a.heinousCount * 3;
  score += a.activeCount * 2;
  const mostRecent = a.cases.reduce((best, c) => {
    if (!c.registeredDate) return best;
    const t = new Date(c.registeredDate).getTime();
    return t > best ? t : best;
  }, 0);
  if (mostRecent) {
    const days = (Date.now() - mostRecent) / 86_400_000;
    if (days < 365) score += 5;
    else if (days < 730) score += 2;
  }
  if (score >= 15) return "HIGH";
  if (score >= 7)  return "MEDIUM";
  return "LOW";
}

const RISK_STYLE: Record<RiskLevel, { bg: string; color: string; border: string }> = {
  HIGH:   { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  MEDIUM: { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
  LOW:    { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
};

function lastArrested(a: RepeatAccused): string {
  const dates = a.cases
    .filter(c => c.registeredDate)
    .map(c => new Date(c.registeredDate!).getTime());
  if (!dates.length) return "—";
  return fmtDate(new Date(Math.max(...dates)).toISOString().slice(0, 10));
}

function latestActiveCase(a: RepeatAccused): Case | null {
  const actives = a.cases.filter(c => c.statusId === 1 && c.registeredDate);
  if (!actives.length) return null;
  return actives.sort((x, y) =>
    new Date(y.registeredDate!).getTime() - new Date(x.registeredDate!).getTime()
  )[0];
}

/* ── Detail modal ── */
function DetailModal({ accused, onClose }: { accused: RepeatAccused; onClose: () => void }) {
  const [selected, setSelected] = useState<Case | null>(
    accused.cases.length === 1 ? accused.cases[0] : null
  );
  const hasHeinous = accused.heinousCount > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(10,20,40,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: WHITE, borderRadius: 14, width: "100%", maxWidth: 640,
          maxHeight: "88vh", overflowY: "auto",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
        }}
      >
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "22px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{accused.name}</span>
              {accused.gender !== "Unknown" && (
                <span style={{ fontSize: 12, color: GRAY }}>{accused.gender}{accused.age ? `, ${accused.age}y` : ""}</span>
              )}
              {hasHeinous && (
                <span style={{ fontSize: 10, fontWeight: 800, color: "#991b1b", background: "#fef2f2", padding: "2px 8px", borderRadius: 6 }}>
                  HEINOUS
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: GRAY }}><strong style={{ color: NAVY }}>{accused.caseCount}</strong> cases</span>
              {accused.heinousCount > 0 && <span style={{ fontSize: 12, color: "#991b1b" }}>{accused.heinousCount} heinous</span>}
              {accused.activeCount > 0  && <span style={{ fontSize: 12, color: "#dc2626" }}>{accused.activeCount} active</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: GRAY, marginTop: -2 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Case selector — shown when multiple cases and none selected */}
          {!selected && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                Select a case to view details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {accused.cases.map((c) => (
                  <button
                    key={c.caseMasterId}
                    onClick={() => setSelected(c)}
                    style={{
                      textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: "none",
                      background: c.isHeinous ? "#fff5f5" : c.statusId === 1 ? "#fffbf0" : "#f8fafc",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      transition: "transform 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace", marginBottom: 6 }}>
                      {c.crimeNo}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <GravityChip isHeinous={c.isHeinous} label={c.gravity} />
                      <StatusPill statusId={c.statusId} />
                    </div>
                    {c.district && (
                      <div style={{ fontSize: 11, color: GRAY, marginTop: 6 }}>{c.district}</div>
                    )}
                    {c.registeredDate && (
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
                        {fmtDate(c.registeredDate)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Case detail view */}
          {selected && (
            <>
              {accused.cases.length > 1 && (
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 16,
                    background: "none", border: "none", cursor: "pointer", fontSize: 12, color: NAVY, fontWeight: 600, padding: 0,
                  }}
                >
                  <ArrowLeft size={14} /> All cases
                </button>
              )}

              <div style={{
                background: selected.isHeinous ? "#fff5f5" : selected.statusId === 1 ? "#fffbf0" : "#f8fafc",
                borderRadius: 12, padding: "20px 22px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>
                    {selected.crimeNo}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <GravityChip isHeinous={selected.isHeinous} label={selected.gravity} />
                    <StatusPill statusId={selected.statusId} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>
                  <Field label="District" value={selected.district || "—"} />
                  <Field label="Registered" value={selected.registeredDate ? fmtDate(selected.registeredDate) : "—"} />
                  <Field label="Gravity" value={selected.gravity} />
                  <Field label="Status" value={selected.statusId === 3 ? "Closed" : selected.statusId === 2 ? "Charge-sheeted" : "Active"} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{value}</div>
    </div>
  );
}

/* ── Main component ── */
export const RepeatOffenders: React.FC = () => {
  const [accused, setAccused]       = useState<RepeatAccused[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [threshold, setThreshold]   = useState<2|3|5|10>(3);
  const [search, setSearch]         = useState("");
  const [modal, setModal]           = useState<RepeatAccused | null>(null);

  const load = useCallback(async (t: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/accused/repeat?threshold=${t}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.configured) { setError("Records store not connected."); return; }
      setAccused(data.accused ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(threshold); }, [load, threshold]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accused;
    return accused.filter((a) => a.name.toLowerCase().includes(q));
  }, [accused, search]);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>

      {/* Controls */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
        background: "#f8fafc", borderRadius: 8,
        padding: "12px 16px", marginBottom: 20,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GRAY }}>Min. cases:</span>
        {THRESHOLDS.map((t) => (
          <button key={t}
            onClick={() => setThreshold(t as any)}
            style={{
              padding: "4px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: threshold === t ? NAVY : "transparent",
              color: threshold === t ? WHITE : GRAY,
              border: `1px solid ${threshold === t ? NAVY : BORDER}`,
            }}
          >{t}+</button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name…"
          style={{
            marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12,
            border: `1px solid ${BORDER}`, outline: "none", width: 200,
          }}
        />
        <button onClick={() => load(threshold)} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${BORDER}`, background: WHITE, color: GRAY, cursor: "pointer" }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {!loading && accused.length > 0 && (
        <div style={{
          display: "flex", gap: 20, marginBottom: 20,
          padding: "10px 16px", background: "#f8fafc",
          borderRadius: 8, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
            {filtered.length} <span style={{ fontWeight: 400, color: GRAY }}>repeat accused</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>
            {filtered.filter((a) => a.heinousCount > 0).length} <span style={{ fontWeight: 400, color: GRAY }}>with heinous cases</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
            {filtered.filter((a) => a.activeCount > 0).length} <span style={{ fontWeight: 400, color: GRAY }}>with active cases</span>
          </span>
        </div>
      )}

      {loading && <OrcaLoader />}
      {error && !loading && (
        <div style={{ display: "flex", gap: 10, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px" }}>
          <AlertTriangle size={15} color="#991b1b" style={{ marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#991b1b" }}>{error}</span>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`, borderRadius: 8, color: GRAY }}>
          <Inbox size={32} color={BORDER} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>
            {accused.length === 0 ? `No accused found on ${threshold}+ cases` : "No results for that name"}
          </div>
        </div>
      )}

      {/* List */}
      {!loading && !error && filtered.map((a, i) => {
        const hasHeinous = a.heinousCount > 0;
        const risk       = riskLevel(a);
        const rs         = RISK_STYLE[risk];
        const lastDate   = lastArrested(a);
        const activeCase = latestActiveCase(a);
        return (
          <div key={a.normalisedKey} style={{
            background: hasHeinous ? "#fff5f5" : a.activeCount > 0 ? "#fffbf0" : WHITE,
            borderRadius: 10, marginBottom: 8,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px",
          }}>
            {/* Rank circle */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: hasHeinous ? "#fef2f2" : "#f8fafc",
              border: `2px solid ${hasHeinous ? "#fca5a5" : BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: hasHeinous ? "#991b1b" : NAVY,
            }}>
              {i + 1}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{a.name}</span>
                {a.gender !== "Unknown" && <span style={{ fontSize: 11, color: GRAY }}>{a.gender}{a.age ? `, ${a.age}y` : ""}</span>}
                {hasHeinous && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#991b1b", background: "#fef2f2", padding: "1px 6px", borderRadius: 6, border: "1px solid #fca5a5" }}>
                    HEINOUS
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: GRAY }}><strong style={{ color: NAVY }}>{a.caseCount}</strong> cases</span>
                {a.heinousCount > 0 && <span style={{ fontSize: 11, color: "#991b1b" }}>{a.heinousCount} heinous</span>}
                {/* Last arrested */}
                <span style={{ fontSize: 11, color: MUTED }}>
                  Last arrested: <strong style={{ color: NAVY, fontFamily: "JetBrains Mono, monospace" }}>{lastDate}</strong>
                </span>
                {/* Active case link */}
                {activeCase && (
                  <span
                    onClick={() => setModal(a)}
                    style={{
                      fontSize: 10, fontWeight: 700, fontFamily: "JetBrains Mono, monospace",
                      color: "#dc2626", background: "#fef2f2", border: "1px solid #fca5a5",
                      padding: "1px 7px", borderRadius: 6, cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ● ACTIVE · {activeCase.crimeNo}
                  </span>
                )}
              </div>
            </div>

            {/* Risk badge */}
            <div style={{
              flexShrink: 0, textAlign: "center",
              background: rs.bg, border: `1px solid ${rs.border}`,
              borderRadius: 8, padding: "5px 12px",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: rs.color, letterSpacing: "0.08em", fontFamily: "JetBrains Mono, monospace" }}>RISK</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: rs.color }}>{risk}</div>
            </div>

            <button
              onClick={() => setModal(a)}
              style={{
                flexShrink: 0, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: `1px solid ${NAVY}`, background: "transparent", color: NAVY, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              View Details
            </button>
          </div>
        );
      })}

      {modal && <DetailModal accused={modal} onClose={() => setModal(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
