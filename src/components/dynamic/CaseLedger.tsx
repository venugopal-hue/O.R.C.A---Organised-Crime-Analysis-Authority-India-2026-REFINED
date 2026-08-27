"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LinkedTasks } from "@/components/dynamic/LinkedTasks";
import { Loader2, AlertTriangle, Printer, RefreshCw, Search, FolderOpen, Inbox } from "lucide-react";
import { FIRLetterhead, FIRDocumentData } from "@/components/dynamic/FIRLetterhead";

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const MONO = "JetBrains Mono, monospace";

interface Option {
  id: string;
  label: string;
  extra?: any;
}

interface Props {
  /** Resolves a master-table id to its display label, supplied by the parent. */
  labelFor: (table: string, id: string) => string;
  /** Full option rows for a master table, so the letterhead can reach columns
   *  the label alone does not carry (a station's district, a section's act). */
  opts: (table: string) => Option[];
}

const genderLabel = (g: string) =>
  ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" } as Record<string, string>)[g] ||
  g ||
  "";

export const CaseLedger: React.FC<Props> = ({ labelFor, opts }) => {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fir/cases");
      const data = await res.json();
      if (!data.success) setError(data.error || "Could not load registered cases.");
      setCases(data.cases || []);
    } catch (e: any) {
      setError(e.message || "Could not reach the case ledger.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCase = async (id: string) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/fir/cases?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success) setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const shown = cases.filter((c) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return [c.CrimeNo, c.CaseNo, c.BriefFacts].some((v) => String(v || "").toLowerCase().includes(q));
  });

  /**
   * Build the letterhead payload for the open case.
   *
   * The ledger used to print through a plain HTML popup, which carried no
   * barcode — a case printed from here could never be verified. It now renders
   * the same FIRLetterhead the registration screen produces, so every printed
   * copy of a case is scannable regardless of where it was printed from.
   */
  const firDocument = (): FIRDocumentData | null => {
    if (!detail?.case) return null;
    const c = detail.case;
    // CaseMaster has no DistrictID of its own; the district comes off the
    // station's Unit row, exactly as the verification portal resolves it.
    const station = opts("Unit").find((o) => o.id === String(c.PoliceStationID));
    return {
      crimeNo: c.CrimeNo,
      caseNo: c.CaseNo,
      caseCategory: labelFor("CaseCategory", c.CaseCategoryID),
      registeredDate: c.CrimeRegisteredDate,
      policeStation: labelFor("Unit", c.PoliceStationID),
      district: labelFor("District", String(station?.extra?.DistrictID ?? "")),
      gravity: labelFor("GravityOffence", c.GravityOffenceID),
      caseStatus: labelFor("CaseStatusMaster", c.CaseStatusID),
      court: labelFor("Court", c.CourtID),
      registeringOfficer: labelFor("Employee", c.PolicePersonID),
      incidentFrom: c.IncidentFromDate,
      incidentTo: c.IncidentToDate,
      infoReceived: c.InfoReceivedPSDate,
      latitude: c.latitude == null ? "" : String(c.latitude),
      longitude: c.longitude == null ? "" : String(c.longitude),
      briefFacts: c.BriefFacts || "",
      actSections: (detail.actSections || []).map((sec: any) => {
        const match = opts("Section").find(
          (o) => o.id === String(sec.SectionID) && String(o.extra?.ActCode ?? "") === String(sec.ActID)
        );
        return {
          act: labelFor("Act", sec.ActID) || sec.ActID,
          actCode: sec.ActID,
          section: sec.SectionID,
          sectionDesc: match?.label || "",
        };
      }),
      complainants: (detail.complainants || []).map((x: any) => ({
        name: x.ComplainantName, age: String(x.AgeYear ?? ""), gender: genderLabel(String(x.GenderID ?? "")),
      })),
      victims: (detail.victims || []).map((x: any) => ({
        name: x.VictimName, age: String(x.AgeYear ?? ""), gender: genderLabel(String(x.GenderID ?? "")),
      })),
      accused: (detail.accused || []).map((x: any, i: number) => ({
        ref: x.PersonID || `A${i + 1}`,
        name: x.AccusedName,
        age: String(x.AgeYear ?? ""),
        gender: genderLabel(String(x.GenderID ?? "")),
      })),
    };
  };

  const printCase = () => window.print();

  const th: React.CSSProperties = {
    textAlign: "left", padding: "9px 12px", fontSize: 10, fontWeight: 700,
    color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em",
    fontFamily: MONO, borderBottom: `1px solid ${BORDER}`, background: OFFWHITE,
  };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, borderBottom: `1px solid #e2e8f0`, color: TEXT };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search style={{ width: 14, height: 14, color: MUTED, position: "absolute", left: 11, top: 11 }} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by Crime Number, Case Number or facts…"
            style={{
              width: "100%", padding: "9px 11px 9px 32px", border: `1px solid ${BORDER}`,
              borderRadius: 4, fontSize: 13, outline: "none",
            }}
          />
        </div>
        <button onClick={load} style={{
          display: "flex", alignItems: "center", gap: 7, background: "#fff", color: NAVY,
          border: `1px solid ${BORDER}`, borderRadius: 4, padding: "9px 15px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", display: "flex", gap: 10 }}>
          <AlertTriangle style={{ width: 17, height: 17, color: "#ef4444", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "#991b1b" }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: MUTED, padding: 20 }}>
          <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Loading registered cases…
        </div>
      ) : shown.length === 0 ? (
        <div style={{
          border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "44px 20px",
          textAlign: "center", background: OFFWHITE,
        }}>
          <Inbox style={{ width: 34, height: 34, color: "#94a3b8", margin: "0 auto 10px" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>
            {cases.length === 0 ? "No cases registered yet" : "No cases match that search"}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
            {cases.length === 0
              ? "Registered cases will appear here once the first FIR is filed."
              : "Try a different Crime Number or keyword."}
          </div>
        </div>
      ) : (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Crime Number</th>
                  <th style={th}>Case No</th>
                  <th style={th}>Category</th>
                  <th style={th}>Registered</th>
                  <th style={th}>Police Station</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <React.Fragment key={String(c.CaseMasterID)}>
                    <tr
                      onClick={() => openCase(String(c.CaseMasterID))}
                      style={{ cursor: "pointer", background: openId === String(c.CaseMasterID) ? "rgba(255,153,51,0.06)" : "#fff" }}
                    >
                      <td style={{ ...td, fontFamily: MONO, fontWeight: 700, color: NAVY }}>{c.CrimeNo}</td>
                      <td style={{ ...td, fontFamily: MONO }}>{c.CaseNo}</td>
                      <td style={td}>{labelFor("CaseCategory", c.CaseCategoryID) || c.CaseCategoryID}</td>
                      <td style={td}>{c.CrimeRegisteredDate}</td>
                      <td style={td}>{labelFor("Unit", c.PoliceStationID) || c.PoliceStationID}</td>
                      <td style={td}>{labelFor("CaseStatusMaster", c.CaseStatusID) || "—"}</td>
                    </tr>
                    {openId === String(c.CaseMasterID) && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: OFFWHITE, borderBottom: `1px solid ${BORDER}` }}>
                          <div style={{ padding: 16 }}>
                            {detailLoading ? (
                              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: MUTED }}>
                                <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Loading case file…
                              </div>
                            ) : detail ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                                  {[
                                    ["Complainants", detail.complainants?.length ?? 0],
                                    ["Victims", detail.victims?.length ?? 0],
                                    ["Accused", detail.accused?.length ?? 0],
                                    ["Acts & Sections", detail.actSections?.length ?? 0],
                                  ].map(([k, v]) => (
                                    <div key={String(k)} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "9px 12px" }}>
                                      <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, letterSpacing: "0.07em" }}>{String(k).toUpperCase()}</div>
                                      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, fontFamily: MONO }}>{String(v)}</div>
                                    </div>
                                  ))}
                                </div>
                                {c.BriefFacts && (
                                  <div>
                                    <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, letterSpacing: "0.07em", marginBottom: 5 }}>BRIEF FACTS</div>
                                    <div style={{ fontSize: 12.5, color: TEXT, lineHeight: 1.6, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 6, padding: 12, whiteSpace: "pre-wrap" }}>
                                      {c.BriefFacts}
                                    </div>
                                  </div>
                                )}
                                {/* What is outstanding on this case, without leaving the record. */}
                                <div className="no-print">
                                  <LinkedTasks caseMasterId={Number(c.CaseMasterID)} contextLabel={String(c.CrimeNo || "")} />
                                </div>

                                <button className="no-print" onClick={printCase} style={{
                                  alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7,
                                  background: NAVY, color: "#fff", border: "none", borderRadius: 4,
                                  padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                                }}>
                                  <Printer style={{ width: 14, height: 14, color: SAFFRON }} /> Print / Save FIR
                                </button>

                                {/* The printable FIR. globals.css prints .report-frame alone. */}
                                {firDocument() && (
                                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                                    <FIRLetterhead data={firDocument() as FIRDocumentData} />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12.5, color: MUTED }}>Could not load this case file.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "9px 14px", borderTop: `1px solid ${BORDER}`, fontSize: 11, color: MUTED, display: "flex", alignItems: "center", gap: 7 }}>
            <FolderOpen style={{ width: 13, height: 13 }} />
            {shown.length} of {cases.length} registered case{cases.length === 1 ? "" : "s"} · click a row to open the case file
          </div>
        </div>
      )}
    </div>
  );
};
