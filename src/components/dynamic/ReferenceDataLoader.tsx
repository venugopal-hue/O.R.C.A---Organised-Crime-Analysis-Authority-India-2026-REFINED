"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, AlertTriangle, CheckCircle2, Upload, Database, RefreshCw, Table2 } from "lucide-react";

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const MONO = "JetBrains Mono, monospace";

interface RefTable { name: string; idColumn: string; columns: string[]; count: number; error?: string }

/** Minimal CSV parser handling quoted fields and embedded commas. */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; error?: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [], error: "Need a header row and at least one data row." };

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

export const ReferenceDataLoader: React.FC<{ onLoaded?: () => void }> = ({ onLoaded }) => {
  const [tables, setTables] = useState<RefTable[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fir/reference");
      const data = await res.json();
      setTables(data.tables || []);
      setCanEdit(Boolean(data.canEdit));
      if (!data.success && data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const def = tables.find((t) => t.name === selected);
  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : null), [csv]);

  const unknownCols = useMemo(() => {
    if (!parsed || !def) return [];
    return parsed.headers.filter((h) => !def.columns.includes(h));
  }, [parsed, def]);

  const handleImport = async () => {
    if (!def || !parsed || parsed.rows.length === 0) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/fir/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: def.name, rows: parsed.rows }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error || "Import failed.");
      else { setResult(data); setCsv(""); await load(); onLoaded?.(); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`,
    borderRadius: 4, fontSize: 13, color: TEXT, background: "#fff", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, maxWidth: "72ch" }}>
        Load the official reference lists the registration form depends on — districts, police
        stations, courts, acts and sections. Paste CSV with a header row whose column names match
        the schema exactly. Rows whose ID already exists are skipped, so re-importing tops up
        rather than duplicating.
      </div>

      {!loading && !canEdit && (
        <div style={{ background: "rgba(249,115,22,0.07)", border: "1px solid #fdba74", borderRadius: 6, padding: "12px 16px", display: "flex", gap: 10 }}>
          <AlertTriangle style={{ width: 17, height: 17, color: "#f97316", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: TEXT }}>
            You can view current row counts, but only administrators may load reference data.
          </span>
        </div>
      )}

      {/* Current state of every reference table */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: MONO }}>
            Reference tables
          </span>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: NAVY, cursor: "pointer" }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
        {loading ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: MUTED }}>
            <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Reading table counts…
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 9 }}>
            {tables.map((t) => (
              <div key={t.name} style={{
                background: t.count > 0 ? "rgba(16,185,129,0.05)" : "#fff",
                border: `1px solid ${t.count > 0 ? "#6ee7b7" : BORDER}`,
                borderRadius: 6, padding: "9px 12px",
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: NAVY, fontFamily: MONO }}>{t.name}</div>
                <div style={{ fontSize: 11, color: t.count > 0 ? "#065f46" : MUTED, marginTop: 2 }}>
                  {t.count < 0 ? "unreadable" : `${t.count} row${t.count === 1 ? "" : "s"}`}
                  {t.count === 0 && " — empty"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, fontFamily: MONO }}>
                Target table
              </label>
              <select value={selected} onChange={(e) => { setSelected(e.target.value); setResult(null); setError(""); }} style={inputStyle}>
                <option value="">— Select a reference table —</option>
                {tables.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count} rows)</option>)}
              </select>
            </div>
          </div>

          {def && (
            <div style={{ background: OFFWHITE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "11px 14px" }}>
              <div style={{ fontSize: 10.5, color: MUTED, fontFamily: MONO, letterSpacing: "0.06em", marginBottom: 5 }}>
                EXPECTED HEADER ROW · REQUIRED ID: {def.idColumn}
              </div>
              <code style={{ fontSize: 12, color: NAVY, fontFamily: MONO, wordBreak: "break-all" }}>
                {def.columns.join(",")}
              </code>
            </div>
          )}

          {def && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, fontFamily: MONO }}>
                CSV data
              </label>
              <textarea
                value={csv}
                onChange={(e) => { setCsv(e.target.value); setResult(null); setError(""); }}
                placeholder={def ? `${def.columns.join(",")}\n…one row per line…` : ""}
                style={{ ...inputStyle, minHeight: 170, fontFamily: MONO, fontSize: 12, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>
          )}

          {parsed && def && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {parsed.error && (
                <span style={{ fontSize: 12.5, color: "#b45309" }}>{parsed.error}</span>
              )}
              {unknownCols.length > 0 && (
                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid #fca5a5", borderRadius: 6, padding: "11px 14px", fontSize: 12.5, color: "#991b1b" }}>
                  Unrecognised column{unknownCols.length === 1 ? "" : "s"}: <strong>{unknownCols.join(", ")}</strong>.
                  Fix the header row — the import will be rejected otherwise.
                </div>
              )}
              {!parsed.error && unknownCols.length === 0 && parsed.rows.length > 0 && (
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                  <div style={{ padding: "7px 12px", background: OFFWHITE, borderBottom: `1px solid ${BORDER}`, fontSize: 10.5, color: MUTED, fontFamily: MONO, letterSpacing: "0.06em" }}>
                    PREVIEW · {parsed.rows.length} ROW{parsed.rows.length === 1 ? "" : "S"} · SHOWING FIRST 5
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>{parsed.headers.map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "7px 11px", fontSize: 10, fontWeight: 700, color: MUTED, fontFamily: MONO, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>{parsed.headers.map((h) => (
                            <td key={h} style={{ padding: "7px 11px", borderBottom: "1px solid #e2e8f0", color: TEXT }}>{r[h]}</td>
                          ))}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", display: "flex", gap: 10 }}>
              <AlertTriangle style={{ width: 17, height: 17, color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#991b1b" }}>{error}</span>
            </div>
          )}

          {result && (
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid #6ee7b7", borderRadius: 6, padding: "12px 16px", display: "flex", gap: 10 }}>
              <CheckCircle2 style={{ width: 18, height: 18, color: "#10b981", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#065f46" }}>{result.message}</span>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !def || !parsed || parsed.rows.length === 0 || unknownCols.length > 0 || Boolean(parsed?.error)}
            style={{
              alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8,
              background: importing || !def || !parsed || unknownCols.length > 0 ? "#94a3b8" : NAVY,
              color: "#fff", border: "none", borderRadius: 4, padding: "11px 22px",
              fontSize: 13, fontWeight: 700,
              cursor: importing || !def || !parsed || unknownCols.length > 0 ? "not-allowed" : "pointer",
            }}
          >
            {importing
              ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
              : <Upload style={{ width: 16, height: 16, color: SAFFRON }} />}
            {importing ? "Loading…" : `Load into ${def?.name || "table"}`}
          </button>
        </>
      )}
    </div>
  );
};
