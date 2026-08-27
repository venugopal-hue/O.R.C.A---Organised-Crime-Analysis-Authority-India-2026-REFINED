"use client";

import React, { useState } from "react";

/**
 * "View my ticket" — the public status check.
 *
 * A reporter has no account and gets no email, so the reference they were
 * shown at submission is the only thread back to their ticket. This is where
 * they pull it.
 *
 * It shows progress, not the case file: status, what that status means, the
 * summary as submitted, and the resolution note if one has been written. The
 * server decides that — see `/api/support/lookup` — but the component is built
 * to the same rule, so nothing here reaches for a field it should not display.
 */

const ORCA = {
  navy: "#001f3f",
  gold: "#FF9933",
  white: "#ffffff",
  textGray: "#475569",
  textMuted: "#94a3b8",
  border: "#cbd5e1",
  red: "#ef4444",
  green: "#10b981",
  shadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "#64748b",
  TRIAGED: "#0ea5e9",
  IN_PROGRESS: "#FF9933",
  RESOLVED: "#10b981",
  CLOSED: "#64748b",
  REJECTED: "#ef4444",
};

interface PublicTicket {
  reference: string;
  type: string;
  category: string;
  severity: string;
  summary: string;
  status: string;
  statusLabel: string;
  statusNote: string;
  resolutionNote: string;
  submittedAt: string;
  updatedAt: string;
}

const pretty = (value: string): string => {
  if (!value) return "—";
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(t)) return value;
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TicketLookup() {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<PublicTicket | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setTicket(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/support/lookup?reference=${encodeURIComponent(reference.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Lookup failed.");
        return;
      }
      setTicket(data.ticket as PublicTicket);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: ORCA.white,
        border: `1px solid ${ORCA.border}`,
        borderRadius: 8,
        padding: 24,
        boxShadow: ORCA.shadow,
      }}
    >
      <h3
        style={{
          fontSize: 14.5,
          fontWeight: 800,
          color: ORCA.navy,
          margin: "0 0 6px 0",
          borderBottom: `1px solid ${ORCA.border}`,
          paddingBottom: 8,
        }}
      >
        View My Ticket
      </h3>
      <p style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.5, margin: "10px 0 14px 0" }}>
        Enter the reference you were given when you submitted. It looks like{" "}
        <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: ORCA.navy }}>
          ORCA-SUP-00012-K7F3QA
        </code>
        .
      </p>

      <form onSubmit={handleLookup} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="ORCA-SUP-00012-K7F3QA"
          aria-label="Ticket reference"
          style={{
            flex: "1 1 200px",
            padding: "8px 12px",
            fontSize: 13,
            borderRadius: 6,
            border: `1px solid ${ORCA.border}`,
            outline: "none",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.03em",
            color: ORCA.navy,
            background: ORCA.white,
          }}
        />
        <button
          type="submit"
          disabled={loading || !reference.trim()}
          style={{
            background: loading || !reference.trim() ? ORCA.textMuted : ORCA.navy,
            color: ORCA.white,
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: loading || !reference.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Checking…" : "Check Status"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            background: "rgba(239,68,68,0.06)",
            border: `1px solid ${ORCA.red}`,
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 12,
            color: ORCA.red,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {ticket && (
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${ORCA.border}`,
            borderRadius: 6,
            padding: 16,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 12.5,
                fontWeight: 800,
                color: ORCA.navy,
              }}
            >
              {ticket.reference}
            </code>
            <span
              style={{
                background: STATUS_COLOR[ticket.status] || ORCA.textMuted,
                color: ORCA.white,
                fontSize: 10,
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 12,
                fontFamily: "JetBrains Mono, monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {ticket.statusLabel}
            </span>
          </div>

          {ticket.statusNote && (
            <p style={{ fontSize: 12, color: ORCA.textGray, margin: "0 0 12px 0", lineHeight: 1.5 }}>
              {ticket.statusNote}
            </p>
          )}

          <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            <Row label="TYPE" value={ticket.type === "INCIDENT" ? "Incident Report" : "Support Ticket"} />
            <Row label="CATEGORY" value={ticket.category} />
            <Row label="SUMMARY" value={ticket.summary} />
            <Row label="SUBMITTED" value={pretty(ticket.submittedAt)} />
            <Row label="LAST UPDATED" value={pretty(ticket.updatedAt)} />
          </dl>

          {ticket.resolutionNote && (
            <div
              style={{
                marginTop: 12,
                borderTop: `1px dashed ${ORCA.border}`,
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: ORCA.textMuted,
                  fontFamily: "JetBrains Mono, monospace",
                  marginBottom: 4,
                }}
              >
                RESOLUTION
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: ORCA.navy, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {ticket.resolutionNote}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <dt
        style={{
          fontSize: 9,
          color: ORCA.textMuted,
          fontFamily: "JetBrains Mono, monospace",
          flex: "0 0 96px",
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: 12, color: ORCA.navy, fontWeight: 600, overflowWrap: "anywhere" }}>
        {value || "—"}
      </dd>
    </div>
  );
}
