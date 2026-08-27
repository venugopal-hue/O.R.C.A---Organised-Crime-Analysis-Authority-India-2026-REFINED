"use client";

import React, { useState } from "react";
import { Database, ChevronDown, ChevronRight, ShieldAlert, Info } from "lucide-react";

/**
 * What the assistant actually read, shown under what it actually said.
 *
 * An answer from a police console is not usable unless the officer can check
 * it. This panel is the check: the query that ran, the filters it ran with,
 * how many records matched, whose jurisdiction was applied, and every record
 * the answer is entitled to rest on.
 *
 * None of it is authored by the language model. The server builds it from the
 * rows it retrieved, which is what makes it worth trusting — the prose above
 * can drift, and this cannot.
 *
 * The warning strip is the sharp end. If the answer names an FIR number that
 * no retrieved record supports, that is a fabricated police record, and it is
 * labelled as one rather than left to look like a finding.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const RED = "#b91c1c";
const MONO = "JetBrains Mono, monospace";

export interface TrailCitation {
  table: string;
  recordId: string;
  label: string;
  detail?: string;
}

export interface TrailData {
  tool: string;
  toolLabel: string;
  args: Record<string, any>;
  matched: number;
  returned: number;
  truncated: boolean;
  citations: TrailCitation[];
  scopeNote: string;
  notes: string[];
}

export interface EvidenceTrailProps {
  retrieval?: TrailData | null;
  /** Set when the records store could not be read at all. */
  retrievalError?: string | null;
  /** References in the answer that no retrieved record backs. */
  unsupported?: string[];
  /** The answer denied records that were actually retrieved. */
  contradiction?: boolean;
  /** The answer asserted nothing exists, with no lookup behind it. */
  unverifiedAbsence?: boolean;
}

const describeArgs = (args: Record<string, any>) => {
  const parts = Object.entries(args || {})
    .filter(([, v]) => String(v ?? "").trim())
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join("  ·  ") : "no filters";
};

export const EvidenceTrail: React.FC<EvidenceTrailProps> = ({
  retrieval,
  retrievalError,
  unsupported,
  contradiction,
  unverifiedAbsence,
}) => {
  // A contradicted answer is opened by default. The officer has just been told
  // something untrue; the correction should not be behind a click.
  const [open, setOpen] = useState(!!contradiction);
  const flagged = (unsupported || []).filter(Boolean);

  // Nothing was consulted and nothing went wrong: an ordinary conversational
  // reply, which does not need a records panel bolted underneath it.
  if (!retrieval && !retrievalError && !flagged.length && !contradiction && !unverifiedAbsence)
    return null;

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      {contradiction && retrieval && (
        <div
          style={{
            border: `1px solid ${RED}`,
            background: "#fef2f2",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <ShieldAlert size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: RED, lineHeight: 1.6 }}>
            <strong style={{ fontFamily: MONO, letterSpacing: 0.4 }}>
              ANSWER CONTRADICTS THE RECORD
            </strong>
            <div style={{ marginTop: 4, color: "#7f1d1d" }}>
              The reply above says nothing was found, but{" "}
              <strong>
                {retrieval.matched} record{retrieval.matched === 1 ? "" : "s"}
              </strong>{" "}
              {retrieval.matched === 1 ? "was" : "were"} retrieved. Read the records below — they
              are what the database holds, not the sentence above them.
            </div>
          </div>
        </div>
      )}

      {flagged.length > 0 && (
        <div
          style={{
            border: `1px solid ${RED}`,
            background: "#fef2f2",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <ShieldAlert size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: RED, lineHeight: 1.6 }}>
            <strong style={{ fontFamily: MONO, letterSpacing: 0.4 }}>UNVERIFIED REFERENCE</strong>
            <div style={{ marginTop: 4, color: "#7f1d1d" }}>
              The answer above mentions{" "}
              <strong style={{ fontFamily: MONO }}>{flagged.join(", ")}</strong>, which{" "}
              {flagged.length === 1 ? "does" : "do"} not appear in any record retrieved for this
              question. Treat {flagged.length === 1 ? "it" : "them"} as unsourced and verify against
              the case file before acting.
            </div>
          </div>
        </div>
      )}

      {unverifiedAbsence && (
        <div
          style={{
            border: `1px solid ${RED}`,
            background: "#fef2f2",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <ShieldAlert size={16} color={RED} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: RED, lineHeight: 1.6 }}>
            <strong style={{ fontFamily: MONO, letterSpacing: 0.4 }}>NO LOOKUP WAS RUN</strong>
            <div style={{ marginTop: 4, color: "#7f1d1d" }}>
              The reply above states that nothing exists, but no database query was made for
              this question — so that is not a finding from the records. Search the relevant
              module directly before relying on it.
            </div>
          </div>
        </div>
      )}

      {retrievalError && (
        <div
          style={{
            border: `1px solid ${BORDER}`,
            background: "#fffbeb",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 12.5,
            color: "#92400e",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ fontFamily: MONO, letterSpacing: 0.4 }}>RECORDS UNAVAILABLE</strong>
          <div style={{ marginTop: 4 }}>
            The crime database could not be read for this question ({retrievalError}). Nothing above
            is drawn from case records.
          </div>
        </div>
      )}

      {retrieval && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              width: "100%",
              background: "#f8fafc",
              border: "none",
              borderBottom: open ? `1px solid ${BORDER}` : "none",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
            aria-expanded={open}
          >
            {open ? <ChevronDown size={14} color={GRAY} /> : <ChevronRight size={14} color={GRAY} />}
            <Database size={14} color={NAVY} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: 0.6,
                color: NAVY,
                fontWeight: 700,
              }}
            >
              EVIDENCE TRAIL
            </span>
            <span style={{ fontSize: 12, color: GRAY }}>
              {retrieval.toolLabel} — {retrieval.matched}{" "}
              {retrieval.matched === 1 ? "record" : "records"} matched
              {retrieval.truncated ? `, ${retrieval.returned} shown` : ""}
            </span>
          </button>

          {open && (
            <div style={{ padding: "14px 16px", background: "#fff", fontSize: 12.5, color: TEXT }}>
              <Row label="QUERY" value={retrieval.tool} mono />
              <Row label="FILTERS" value={describeArgs(retrieval.args)} />
              <Row
                label="MATCHED"
                value={
                  `${retrieval.matched} record(s)` +
                  (retrieval.truncated
                    ? ` — the ${retrieval.returned} most relevant were used to write the answer`
                    : "")
                }
              />
              <Row label="JURISDICTION" value={retrieval.scopeNote} />

              {retrieval.citations.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      letterSpacing: 0.6,
                      color: MUTED,
                      marginBottom: 6,
                    }}
                  >
                    RECORDS CONSULTED
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {retrieval.citations.map((c, i) => (
                      <div
                        key={`${c.table}-${c.recordId}-${i}`}
                        style={{
                          border: `1px solid ${BORDER}`,
                          borderLeft: `3px solid ${SAFFRON}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          background: "#fbfcfd",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: NAVY }}>{c.label}</div>
                        {c.detail && (
                          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{c.detail}</div>
                        )}
                        <div
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            color: MUTED,
                            marginTop: 3,
                            letterSpacing: 0.3,
                          }}
                        >
                          {c.table} · {c.recordId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/*
                An aggregate has no row to point at. Saying so is better than an
                empty list, which reads as a retrieval that found nothing.
              */}
              {retrieval.citations.length === 0 && retrieval.matched > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: GRAY, lineHeight: 1.6 }}>
                  This answer is a count rather than a set of records, computed over{" "}
                  <strong>{retrieval.matched}</strong> case record(s) with the filters above. There
                  is no individual record to cite.
                </div>
              )}

              {retrieval.notes.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    borderTop: `1px solid ${BORDER}`,
                    paddingTop: 10,
                  }}
                >
                  <Info size={13} color={MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 11.5, color: GRAY, lineHeight: 1.65 }}>
                    {retrieval.notes.map((n, i) => (
                      <div key={i} style={{ marginBottom: i === retrieval.notes.length - 1 ? 0 : 5 }}>
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 6, alignItems: "flex-start" }}>
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: 0.6,
        color: MUTED,
        minWidth: 96,
        paddingTop: 2,
      }}
    >
      {label}
    </div>
    <div
      style={{
        flex: 1,
        color: TEXT,
        lineHeight: 1.6,
        fontFamily: mono ? MONO : undefined,
        fontSize: mono ? 12 : undefined,
        wordBreak: "break-word",
      }}
    >
      {value}
    </div>
  </div>
);

export default EvidenceTrail;
