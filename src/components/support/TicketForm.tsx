"use client";

import React, { useState } from "react";
import { useUnsavedWarning, anyFilled } from "@/lib/useUnsavedWarning";
import {
  SUPPORT_CATEGORIES,
  INCIDENT_COMPONENTS,
  SEVERITIES,
  SEVERITY_LABELS,
  HONEYPOT_FIELD,
  LIMITS,
  type TicketType,
} from "@/lib/supportTickets";

/**
 * The live ticket form shared by /support and /report-issue.
 *
 * Both pages previously rendered a `disabled` form under a "COMING SOON"
 * hover-lock. The layout, spacing and controls here are carried over from
 * those forms unchanged — same labels, same order, same ORCA tokens — so the
 * pages look as they did. What changed is that the inputs work and the submit
 * button reaches a real endpoint.
 *
 * The two variants differ only in their field set, so they share one component
 * rather than drifting apart in two files:
 *
 *   SUPPORT   name, badge, email, category, summary, details
 *   INCIDENT  name, badge, email, component, severity, summary, details,
 *             plus the browser diagnostics the page collected
 *
 * EVERY field is required and NOTHING is pre-filled — including the two
 * selects, which open on a placeholder rather than on their first real
 * option.
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

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  borderRadius: 6,
  border: `1px solid ${ORCA.border}`,
  outline: "none",
  background: ORCA.white,
  color: ORCA.navy,
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: ORCA.textGray,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export interface TicketFormProps {
  type: TicketType;
  /** Browser diagnostics gathered by the page; sent with an incident report. */
  diagnostics?: string;
  heading: string;
  submitLabel: string;
}

interface Submitted {
  reference: string;
  submittedAt: string;
}

export default function TicketForm({ type, diagnostics = "", heading, submitLabel }: TicketFormProps) {
  const isIncident = type === "INCIDENT";
  const categories = isIncident ? INCIDENT_COMPONENTS : SUPPORT_CATEGORIES;

  const [name, setName] = useState("");
  const [badge, setBadge] = useState("");
  const [email, setEmail] = useState("");
  // Both selects start EMPTY. A pre-selected first option is an answer the
  // reporter never gave — it silently files every hurried ticket against
  // "AI Chatbot (ZIA)" at MEDIUM severity, which is worse than no value at
  // all because it looks deliberate in the triage queue.
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Submitted | null>(null);
  const [copied, setCopied] = useState(false);

  // Something is at risk the moment ANY field holds a value, and nothing is at
  // risk once the ticket is filed — warning on the confirmation screen would
  // train people to dismiss the dialog without reading it. The honeypot is
  // excluded: only a bot ever fills it, and a bot is not owed a warning.
  const isDirty = anyFilled(name, badge, email, category, severity, summary, details);
  const unsaved = isDirty && !done;
  useUnsavedWarning(unsaved);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reporterName: name,
          reporterBadge: badge,
          reporterEmail: email,
          category,
          severity: isIncident ? severity : "",
          summary,
          details,
          diagnostics: isIncident ? diagnostics : "",
          [HONEYPOT_FIELD]: honeypot,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Submission failed. Please try again.");
        return;
      }
      if (!data.reference) {
        setError("Submission could not be recorded. Please try again.");
        return;
      }
      setDone({ reference: data.reference, submittedAt: data.submittedAt || "" });
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  //
  // The reference is the ONLY way back to this ticket — it is what the public
  // lookup page checks, and it is not emailed. So it is shown large, with a
  // copy button and an explicit warning to keep it.
  if (done) {
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
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "rgba(16,185,129,0.12)",
            border: `1px solid ${ORCA.green}`,
            color: ORCA.green,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 14,
          }}
        >
          ✓
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 800, color: ORCA.navy, margin: "0 0 6px 0" }}>
          {isIncident ? "Incident Logged" : "Ticket Registered"}
        </h3>
        <p style={{ fontSize: 12.5, color: ORCA.textGray, margin: "0 0 18px 0", lineHeight: 1.5 }}>
          Your {isIncident ? "report" : "ticket"} has been recorded and placed in the triage queue.
        </p>

        <div style={{ ...fieldStyle, gap: 6, marginBottom: 16 }}>
          <span style={{ ...labelStyle, color: ORCA.textMuted, fontFamily: "JetBrains Mono, monospace", fontSize: 9 }}>
            YOUR REFERENCE NUMBER
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              background: "rgba(255,153,51,0.08)",
              border: `1px dashed rgba(255,153,51,0.5)`,
              borderRadius: 6,
              padding: "12px 14px",
            }}
          >
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 16,
                fontWeight: 800,
                color: ORCA.navy,
                letterSpacing: "0.04em",
              }}
            >
              {done.reference}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(done.reference).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  },
                  () => setCopied(false)
                );
              }}
              style={{
                background: ORCA.navy,
                color: ORCA.white,
                border: "none",
                borderRadius: 5,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(239,68,68,0.03)",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <strong style={{ display: "block", fontSize: 12, color: ORCA.red, marginBottom: 4 }}>
            Save this reference now
          </strong>
          <span style={{ fontSize: 12, color: ORCA.textGray, lineHeight: 1.5 }}>
            It is not sent by email. The six characters after the final hyphen are what prove the ticket is
            yours — without the full reference the status cannot be retrieved.
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setDone(null);
            setName("");
            setBadge("");
            setEmail("");
            setCategory("");
            setSeverity("");
            setSummary("");
            setDetails("");
          }}
          style={{
            background: "transparent",
            color: ORCA.navy,
            border: `1px solid ${ORCA.border}`,
            borderRadius: 6,
            padding: "9px 16px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
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
      <h3 style={{ fontSize: 16, fontWeight: 800, color: ORCA.navy, margin: "0 0 16px 0" }}>{heading}</h3>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Honeypot: off-screen, never announced, empty for a human. */}
        <input
          type="text"
          name={HONEYPOT_FIELD}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tf-name">
              OFFICER NAME *
            </label>
            <input
              id="tf-name"
              type="text"
              required
              maxLength={LIMITS.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inspector Ramesh Kumar"
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tf-badge">
              BADGE / SERVICE ID *
            </label>
            <input
              id="tf-badge"
              type="text"
              required
              maxLength={LIMITS.badge}
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="e.g. KSP-10928"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="tf-email">
            OFFICIAL EMAIL ADDRESS *
          </label>
          <input
            id="tf-email"
            type="email"
            required
            maxLength={LIMITS.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. ramesh.kumar@ksp.gov.in"
            style={inputStyle}
          />
          <span style={{ fontSize: 10.5, color: ORCA.textMuted }}>
            The engineering cell replies to this address. Use your official KSP address.
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isIncident ? "1fr 1fr" : "1fr", gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tf-category">
              {isIncident ? "AFFECTED COMPONENT *" : "ISSUE CATEGORY *"}
            </label>
            <select
              id="tf-category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ ...inputStyle, color: category ? ORCA.navy : ORCA.textMuted }}
            >
              <option value="" disabled>
                {isIncident ? "Select the affected component…" : "Select an issue category…"}
              </option>
              {categories.map((c) => (
                <option key={c} value={c} style={{ color: ORCA.navy }}>
                  {c}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 10.5, color: ORCA.textMuted }}>
              {isIncident
                ? "Where in the platform the problem appeared. Pick Other if it spans several screens."
                : "What kind of help you need. Pick Other if none of these fit."}
            </span>
          </div>

          {isIncident && (
            <div style={fieldStyle}>
              <label style={labelStyle} htmlFor="tf-severity">
                SEVERITY LEVEL *
              </label>
              <select
                id="tf-severity"
                required
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{ ...inputStyle, color: severity ? ORCA.navy : ORCA.textMuted }}
              >
                <option value="" disabled>
                  Select a severity…
                </option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s} style={{ color: ORCA.navy }}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 10.5, color: ORCA.textMuted }}>
                How badly this blocks work — not how urgent it feels. Triage may adjust it.
              </span>
            </div>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="tf-summary">
            SUMMARY DESCRIPTION *
          </label>
          <input
            id="tf-summary"
            type="text"
            required
            maxLength={LIMITS.summary}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={isIncident ? "Brief headline of the bug..." : "Brief headline of the issue..."}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="tf-details">
            {isIncident ? "DETAILED STEPS TO REPRODUCE *" : "DETAILED DESCRIPTION *"}
          </label>
          <textarea
            id="tf-details"
            required
            rows={5}
            maxLength={LIMITS.details}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={
              isIncident
                ? "Explain the steps taken, what you expected, and what happened instead..."
                : "Describe the issue, including any error messages seen..."
            }
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
          <span style={{ fontSize: 10.5, color: ORCA.textMuted, textAlign: "right" }}>
            {details.length} / {LIMITS.details}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: `1px solid ${ORCA.red}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 12,
              color: ORCA.red,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/*
          The browser writes its own "Leave site?" dialog and ignores any text
          we pass, so it can never say WHAT is about to be lost. This line is
          where that meaning lives — it appears the moment the form holds
          anything, and disappears once the ticket is filed.
        */}
        {unsaved && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,153,51,0.08)",
              border: "1px dashed rgba(255,153,51,0.45)",
              borderRadius: 6,
              padding: "9px 12px",
              fontSize: 11.5,
              color: ORCA.textGray,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
              ⚠
            </span>
            <span>
              <strong style={{ color: ORCA.navy }}>Draft not yet submitted.</strong> Nothing is saved
              until you press {submitLabel}. Refreshing or leaving this page will discard what you have
              typed.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          style={{
            background: sending ? ORCA.textMuted : ORCA.navy,
            color: ORCA.white,
            border: "none",
            borderRadius: 6,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: sending ? "wait" : "pointer",
            marginTop: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {sending ? "Submitting…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
