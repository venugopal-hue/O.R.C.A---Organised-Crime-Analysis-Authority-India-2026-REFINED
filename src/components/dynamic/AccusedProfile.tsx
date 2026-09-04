"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, Loader2, User, AlertTriangle, ChevronRight, ShieldAlert, Scale, Users, FileText } from "lucide-react";

const NAVY    = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER  = "#e2e8f0";
const GRAY    = "#475569";
const MUTED   = "#94a3b8";
const WHITE   = "#ffffff";
const RED     = "#dc2626";
const AMBER   = "#d97706";
const GREEN   = "#16a34a";
const BLUE    = "#0369a1";
const MONO    = "JetBrains Mono, monospace";

type Tab = "overview" | "cases" | "arrests" | "bail" | "associates";

interface Case { caseMasterId: string; crimeNo: string; gravity: string; status: string; registeredDate: string; station: string; district: string; actSections: string; }
interface Arrest { arrestNo: string; linkedCrimeNo: string; arrestDate: string; arrestLocation: string; sectionsInvoked: string; status: string; groundsOfArrest: string; custodyLocation: string; }
interface BailOrder { orderNo: string; linkedCrimeNo: string; orderType: string; orderDate: string; courtName: string; remarks: string; }
interface Associate { name: string; caseCount: number; cases: string[]; }

interface Profile {
  found: boolean; name: string; gender: string; age: string;
  fatherName: string; address: string;
  totalCases: number; activeCases: number;
  cases: Case[]; arrests: Arrest[]; bail: BailOrder[]; associates: Associate[];
}

const GRAVITY_COLOR: Record<string, string> = { Heinous: RED, Serious: AMBER, Minor: GREEN };

const AVATAR_PALETTES = [
  ["#1e3a5f", "#60a5fa"], ["#3b1f5e", "#a78bfa"], ["#1f3d2a", "#4ade80"],
  ["#3d2010", "#fb923c"], ["#1f2d3d", "#38bdf8"], ["#3d1515", "#f87171"],
];
function avatarColors(name: string) {
  const i = name.charCodeAt(0) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[i];
}

function fmtDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function GravityPill({ g }: { g: string }) {
  const c = GRAVITY_COLOR[g] ?? MUTED;
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
      background: `${c}18`, color: c, border: `1px solid ${c}30`, letterSpacing: "0.05em" }}>
      {g || "Unknown"}
    </span>
  );
}

function Pill({ label, color = BLUE }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 10,
      background: `${color}15`, color, border: `1px solid ${color}28` }}>
      {label}
    </span>
  );
}

export function AccusedProfile() {
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Browse grid — all accused persons loaded on mount
  const [browsePersons, setBrowsePersons] = useState<{ name: string; cases: number }[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseFilter, setBrowseFilter]   = useState("");

  useEffect(() => {
    fetch("/api/accused/browse", { credentials: "include" })
      .then(r => r.json())
      .then(d => setBrowsePersons(d.persons ?? []))
      .catch(() => {})
      .finally(() => setBrowseLoading(false));
  }, []);

  const search = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setProfile(null);
    setActiveTab("overview");
    try {
      const res = await fetch(`/api/accused/profile?name=${encodeURIComponent(name.trim())}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (!data.found) setError(`No records found for "${name.trim()}". Verify the name matches the registered FIR.`);
      else setProfile(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCard = (name: string) => { setQuery(name); search(name); };

  const tabs: { id: Tab; label: string; icon: React.FC<any>; count?: number }[] = [
    { id: "overview",   label: "Overview",    icon: User,       },
    { id: "cases",      label: "Cases",       icon: FileText,   count: profile?.totalCases },
    { id: "arrests",    label: "Arrests",     icon: ShieldAlert,count: profile?.arrests.length },
    { id: "bail",       label: "Bail/Remand", icon: Scale,      count: profile?.bail.length },
    { id: "associates", label: "Associates",  icon: Users,      count: profile?.associates.length },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#1e293b" }}>

      {/* ── Search bar ── */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 24,
        border: `1.5px solid ${BORDER}`, borderRadius: 10, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)", background: WHITE,
      }}>
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 14 }}>
          <Search size={15} color={MUTED} />
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search(query)}
          placeholder="Search accused by name — e.g. Santhosh Reddy"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#1e293b",
            background: "transparent", padding: "12px 10px", fontFamily: "'Inter', sans-serif" }}
        />
        <button
          onClick={() => search(query)}
          disabled={loading || !query.trim()}
          style={{
            padding: "0 22px", background: loading || !query.trim() ? "#94a3b8" : NAVY,
            color: WHITE, border: "none", fontSize: 12.5, fontWeight: 700,
            cursor: loading || !query.trim() ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.03em",
          }}
        >
          {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* ── Loading spinner (content area) ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "60px 20px", color: MUTED }}>
          <Loader2 size={32} color={NAVY} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Reconstructing profile…</span>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start",
          background: "#fff5f5", border: `1px solid #fca5a5`, borderLeft: `4px solid ${RED}`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <AlertTriangle size={15} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: RED }}>{error}</span>
        </div>
      )}

      {/* ── Profile ── */}
      {!loading && profile && (
        <>
          {/* Identity header */}
          <div style={{
            background: NAVY, borderRadius: 12, padding: "20px 24px",
            marginBottom: 20, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
          }}>
            {/* Avatar */}
            {(() => { const [bg, fg] = avatarColors(profile.name); return (
              <div style={{ width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 800, color: fg, border: "2px solid rgba(255,255,255,0.15)" }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            ); })()}
            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: WHITE }}>{profile.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                {[profile.gender, profile.age ? `Age ${profile.age}` : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            {/* Stats chips */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "Total Cases", val: profile.totalCases, color: "#60a5fa" },
                { label: "Active",      val: profile.activeCases, color: "#f87171" },
                { label: "Arrests",     val: profile.arrests.length, color: "#fb923c" },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 18px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: MONO }}>{s.val}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 16,
            borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "9px 14px", border: "none", background: "transparent",
                borderBottom: `3px solid ${activeTab === t.id ? SAFFRON : "transparent"}`,
                color: activeTab === t.id ? NAVY : GRAY, fontWeight: activeTab === t.id ? 700 : 500,
                fontSize: 12.5, cursor: "pointer", marginBottom: -1,
              }}>
                <t.icon size={13} />
                {t.label}
                {t.count !== undefined && (
                  <span style={{ background: activeTab === t.id ? SAFFRON : BORDER,
                    color: activeTab === t.id ? WHITE : GRAY,
                    borderRadius: 10, padding: "1px 7px", fontSize: 10.5, fontWeight: 700 }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: "20px 22px" }}>

            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
                {profile.cases[0] && (
                  <MiniCard title="Most Recent Case" accent={GRAVITY_COLOR[profile.cases[0].gravity] ?? BLUE}>
                    <KV label="Crime No." value={<span style={{ fontFamily: MONO, fontSize: 12 }}>{profile.cases[0].crimeNo || "—"}</span>} />
                    <KV label="Station"   value={profile.cases[0].station} />
                    <KV label="District"  value={profile.cases[0].district} />
                    <KV label="Gravity"   value={<GravityPill g={profile.cases[0].gravity} />} />
                    <KV label="Status"    value={<Pill label={profile.cases[0].status} />} />
                    <KV label="Filed"     value={fmtDate(profile.cases[0].registeredDate)} />
                  </MiniCard>
                )}
                {profile.arrests[0] && (
                  <MiniCard title="Latest Arrest" accent={RED}>
                    <KV label="Arrest No." value={profile.arrests[0].arrestNo || "—"} />
                    <KV label="Crime No."  value={<span style={{ fontFamily: MONO, fontSize: 12 }}>{profile.arrests[0].linkedCrimeNo}</span>} />
                    <KV label="Date"       value={fmtDate(profile.arrests[0].arrestDate)} />
                    <KV label="Location"   value={profile.arrests[0].arrestLocation} />
                    <KV label="Status"     value={<Pill label={profile.arrests[0].status || "Unknown"} color={RED} />} />
                  </MiniCard>
                )}
                {profile.bail[0] && (
                  <MiniCard title="Latest Bail / Remand" accent={AMBER}>
                    <KV label="Order No." value={profile.bail[0].orderNo || "—"} />
                    <KV label="Type"      value={<Pill label={profile.bail[0].orderType} color={profile.bail[0].orderType === "Bail" ? GREEN : AMBER} />} />
                    <KV label="Court"     value={profile.bail[0].courtName} />
                    <KV label="Date"      value={fmtDate(profile.bail[0].orderDate)} />
                  </MiniCard>
                )}
                {profile.associates[0] && (
                  <MiniCard title="Top Associate" accent={NAVY}>
                    <KV label="Name"         value={
                      <button onClick={() => handleCard(profile.associates[0].name)}
                        style={{ background: "none", border: "none", color: NAVY,
                          fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>
                        {profile.associates[0].name}
                      </button>} />
                    <KV label="Shared Cases" value={String(profile.associates[0].caseCount)} />
                  </MiniCard>
                )}
                {!profile.cases[0] && !profile.arrests[0] && !profile.bail[0] && (
                  <div style={{ color: MUTED, fontSize: 13 }}>No linked records available.</div>
                )}
              </div>
            )}

            {activeTab === "cases" && (
              profile.cases.length === 0
                ? <Empty msg="No cases linked to this person." />
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {profile.cases.map(c => (
                      <div key={c.caseMasterId} style={{ display: "flex", alignItems: "center", gap: 14,
                        border: `1px solid ${BORDER}`, borderLeft: `4px solid ${GRAVITY_COLOR[c.gravity] ?? MUTED}`,
                        borderRadius: "0 8px 8px 0", padding: "12px 16px", background: "#fafcff" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: NAVY }}>{c.crimeNo || "—"}</div>
                          <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>{c.station}{c.district ? ` · ${c.district}` : ""}</div>
                        </div>
                        <GravityPill g={c.gravity} />
                        <Pill label={c.status} />
                        <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{fmtDate(c.registeredDate)}</div>
                      </div>
                    ))}
                  </div>
            )}

            {activeTab === "arrests" && (
              profile.arrests.length === 0
                ? <Empty msg="No arrest records on file." />
                : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {profile.arrests.map((a, i) => (
                      <div key={i} style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${RED}`,
                        borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>Arrest {a.arrestNo || `#${i+1}`}</span>
                          <Pill label={a.status || "Unknown"} color={RED} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 6 }}>
                          <KV label="Crime No."  value={<span style={{ fontFamily: MONO, fontSize: 12 }}>{a.linkedCrimeNo}</span>} />
                          <KV label="Date"       value={fmtDate(a.arrestDate)} />
                          <KV label="Location"   value={a.arrestLocation} />
                          <KV label="Custody"    value={a.custodyLocation} />
                          <KV label="Sections"   value={a.sectionsInvoked} />
                          <KV label="Grounds"    value={a.groundsOfArrest} />
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {activeTab === "bail" && (
              profile.bail.length === 0
                ? <Empty msg="No bail or remand orders on file." />
                : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {profile.bail.map((b, i) => (
                      <div key={i} style={{ border: `1px solid ${BORDER}`, borderLeft: `4px solid ${AMBER}`,
                        borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>Order {b.orderNo || `#${i+1}`}</span>
                          <Pill label={b.orderType || "Unknown"} color={b.orderType === "Bail" ? GREEN : AMBER} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 6 }}>
                          <KV label="Crime No." value={<span style={{ fontFamily: MONO, fontSize: 12 }}>{b.linkedCrimeNo}</span>} />
                          <KV label="Date"      value={fmtDate(b.orderDate)} />
                          <KV label="Court"     value={b.courtName} />
                          <KV label="Remarks"   value={b.remarks} />
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {activeTab === "associates" && (
              profile.associates.length === 0
                ? <Empty msg="No known associates found in linked cases." />
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {profile.associates.map((a, i) => {
                      const [bg, fg] = avatarColors(a.name);
                      return (
                        <div key={i} onClick={() => handleCard(a.name)}
                          style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
                            border: `1px solid ${BORDER}`, borderRadius: 8, padding: "11px 16px",
                            background: "#fafcff", transition: "border 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = NAVY)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                            background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 800, color: fg }}>
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>{a.name}</div>
                            <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>
                              {a.caseCount} shared case{a.caseCount !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <ChevronRight size={14} color={MUTED} />
                        </div>
                      );
                    })}
                  </div>
            )}
          </div>
        </>
      )}

      {/* ── Browse cards (initial state) ── */}
      {!loading && !profile && !error && (
        <div>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8,
              border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px",
              background: WHITE, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <Search size={13} color={MUTED} />
              <input
                value={browseFilter}
                onChange={e => setBrowseFilter(e.target.value)}
                placeholder="Filter by name…"
                style={{ border: "none", outline: "none", fontSize: 12.5, color: "#1e293b",
                  background: "transparent", width: "100%", fontFamily: "'Inter', sans-serif" }}
              />
            </div>
            {!browseLoading && (
              <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, whiteSpace: "nowrap",
                background: "rgba(0,31,63,0.05)", border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: "5px 10px" }}>
                {browsePersons.filter(p => !browseFilter || p.name.toLowerCase().includes(browseFilter.toLowerCase())).length} / {browsePersons.length}
              </div>
            )}
          </div>

          {browseLoading ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "48px 20px",
              justifyContent: "center", color: MUTED }}>
              <Loader2 size={22} color={NAVY} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Loading records…</span>
            </div>
          ) : browsePersons.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px", border: `1px dashed ${BORDER}`,
              borderRadius: 10, color: MUTED }}>
              <User size={28} color={BORDER} style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>No accused records on file yet.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Records are created when accused are added during case registration.</div>
            </div>
          ) : (() => {
            const filtered = browsePersons.filter(p =>
              !browseFilter || p.name.toLowerCase().includes(browseFilter.toLowerCase())
            );
            return filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: MUTED, fontSize: 13 }}>
                No records match "{browseFilter}".
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {filtered.map(person => {
                  const [bg, fg] = avatarColors(person.name);
                  const isRepeat = person.cases > 1;
                  return (
                    <button key={person.name} onClick={() => handleCard(person.name)}
                      style={{
                        display: "flex", flexDirection: "column", textAlign: "left",
                        border: `1px solid ${isRepeat ? `${RED}40` : BORDER}`,
                        borderTop: `3px solid ${isRepeat ? RED : NAVY}`,
                        borderRadius: "0 0 10px 10px",
                        padding: 0, background: WHITE, cursor: "pointer",
                        transition: "all 0.15s", overflow: "hidden",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,31,63,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      {/* Card body */}
                      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 12, alignItems: "flex-start", width: "100%", boxSizing: "border-box" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                          background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, fontWeight: 800, color: fg }}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: NAVY, lineHeight: 1.3,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {person.name}
                          </div>
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 8,
                              background: isRepeat ? `${RED}15` : "rgba(0,31,63,0.07)",
                              color: isRepeat ? RED : NAVY,
                              border: `1px solid ${isRepeat ? `${RED}30` : "rgba(0,31,63,0.15)"}`,
                              letterSpacing: "0.04em",
                            }}>
                              {person.cases} {person.cases === 1 ? "CASE" : "CASES"}
                            </span>
                            {isRepeat && (
                              <span style={{ fontSize: 9.5, fontWeight: 800, color: RED,
                                background: `${RED}10`, border: `1px solid ${RED}25`,
                                borderRadius: 6, padding: "2px 6px", letterSpacing: "0.06em" }}>
                                REPEAT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Footer */}
                      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "7px 16px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: "rgba(0,31,63,0.02)" }}>
                        <span style={{ fontSize: 10.5, color: MUTED }}>View full profile</span>
                        <ChevronRight size={12} color={MUTED} />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MiniCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderTop: `3px solid ${accent}`,
      borderRadius: "0 0 8px 8px", padding: "14px 16px", background: "#fafcff" }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—" || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "baseline" }}>
      <span style={{ color: MUTED, minWidth: 80, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px", color: MUTED, fontSize: 13 }}>{msg}</div>
  );
}
