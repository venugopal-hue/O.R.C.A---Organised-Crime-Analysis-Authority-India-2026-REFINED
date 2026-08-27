"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Mic, MicOff, X, CornerDownLeft, Loader2 } from "lucide-react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { canAccessTab, getRoleConfig } from "@/lib/rbac";
import { useVoice } from "@/lib/useVoice";
import { matchVoiceCommand } from "@/lib/voiceCommands";

/**
 * The voice command palette.
 *
 * A button in the top bar blurs the screen and opens this. The officer speaks —
 * "open threat mapping", "register a case" — the words appear as they are said,
 * the command is matched, the palette says what it is doing, and the tab
 * switches. Typing works too, so it is usable when voice input is switched off
 * for the department.
 *
 * WHY MATCHING IS LOCAL, NOT AN LLM CALL
 *
 * These are navigation commands over a fixed set of tabs. Keyword matching is
 * instant, free, deterministic and cannot hallucinate a destination — an AI
 * round-trip would be slower and could invent a screen that does not exist.
 *
 * ACCESS IS RESPECTED
 *
 * A command is only carried out if the officer may open that tab. Asking for a
 * screen they cannot reach is answered plainly, not by bouncing them to the
 * unauthorized page.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";

type Outcome =
  | { kind: "idle" }
  | { kind: "switching"; label: string }
  | { kind: "denied"; label: string }
  | { kind: "unknown" };

export const VoiceCommandPalette: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveTab } = useIntelligence();
  const { dashboardRole } = useAuth();

  const [heard, setHeard] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Guards against a late transcript firing after the officer closed the box. */
  const doneRef = useRef(false);

  const mayAccess = useCallback(
    (id: string) => {
      // Where a role config exists it is authoritative. Where it does not (a
      // legacy role), let the destination tab enforce its own access rather
      // than second-guessing it here.
      if (getRoleConfig(dashboardRole)) return canAccessTab(dashboardRole, id);
      return true;
    },
    [dashboardRole]
  );

  const run = useCallback(
    (text: string) => {
      if (doneRef.current) return;
      const cmd = matchVoiceCommand(text);
      if (!cmd) { setOutcome({ kind: "unknown" }); return; }
      if (!mayAccess(cmd.id)) { setOutcome({ kind: "denied", label: cmd.label }); return; }

      doneRef.current = true;
      setOutcome({ kind: "switching", label: cmd.label });
      // Let the confirmation line render and be spoken before the screen changes.
      window.setTimeout(() => {
        setActiveTab(cmd.id);
        if (pathname !== cmd.route && cmd.route !== "/dashboard") router.push(cmd.route);
        onClose();
      }, 850);
    },
    [mayAccess, setActiveTab, pathname, router, onClose]
  );

  const voice = useVoice({
    language: "en-US",
    narrate: false,
    handsFree: false,
    // Run the command as soon as one utterance ends — without the continuous
    // listen-and-reopen loop hands-free would add.
    submitOnEnd: true,
    onTranscript: (t) => setHeard(t),
    // A finished utterance is a command. This is the hands-free-style trigger,
    // but scoped to navigation rather than a chat turn.
    onUtteranceComplete: (t) => { setHeard(t); run(t); },
  });

  // The palette is mounted fresh each time it is opened, so state starts clean
  // with no reset needed. Start listening once the voice policy is known —
  // inputAllowed is null until the fetch returns, so this waits for it rather
  // than deciding on the unknown.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || voice.inputAllowed === null) return;
    startedRef.current = true;
    if (voice.inputAllowed === true) voice.startListening();
    else window.setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.inputAllowed]);

  // Release the microphone when the palette unmounts.
  useEffect(() => () => { voice.stopListening(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Speak the confirmation, so the officer gets an answer without looking.
  useEffect(() => {
    // Spoken confirmation does NOT read the transcript back — recognition
    // mangles words, and hearing "switching to registr" reads as a failure even
    // when the right tab is opening. A short, fixed acknowledgement instead; the
    // destination is shown on screen for anyone watching.
    if (outcome.kind === "switching") voice.speak("Alright, got it");
    else if (outcome.kind === "denied") voice.speak(`You do not have access to ${outcome.label}`);
    else if (outcome.kind === "unknown") voice.speak("Sorry, I didn't catch that");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const micUsable = voice.inputAllowed === true && voice.micState !== "unsupported";
  const listening = voice.micState === "listening";

  const statusLine = useMemo(() => {
    switch (outcome.kind) {
      case "switching": return { text: `Switching to ${outcome.label}…`, colour: "#10b981" };
      case "denied": return { text: `You do not have access to ${outcome.label}.`, colour: "#ef4444" };
      case "unknown": return { text: "No command recognised. Try “open threat mapping”.", colour: "#b45309" };
      default:
        return voice.transcribing
          ? { text: "Transcribing…", colour: "#64748b" }
          : listening
            ? { text: "Listening — say a command", colour: NAVY }
            : { text: micUsable ? "Click the mic, or type a command" : "Type a command", colour: "#64748b" };
    }
  }, [outcome, voice.transcribing, listening, micUsable]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(15,23,42,0.35)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "14vh",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(620px, 92vw)", background: "white", borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)", border: `1px solid ${SAFFRON}`,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => (listening ? voice.stopListening() : voice.startListening())}
            disabled={!micUsable}
            title={micUsable ? (listening ? "Stop listening" : "Start listening") : "Voice input is off — type instead"}
            style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              border: listening ? "1px solid #ef4444" : `1px solid ${micUsable ? NAVY : "#cbd5e1"}`,
              background: listening ? "rgba(239,68,68,0.1)" : "transparent",
              color: listening ? "#ef4444" : micUsable ? NAVY : "#94a3b8",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: micUsable ? "pointer" : "not-allowed",
            }}
          >
            {voice.transcribing
              ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
              : micUsable
                ? <Mic style={{ width: 18, height: 18 }} className={listening ? "animate-pulse" : ""} />
                : <MicOff style={{ width: 18, height: 18 }} />}
          </button>

          <input
            ref={inputRef}
            value={heard}
            onChange={(e) => { setHeard(e.target.value); setOutcome({ kind: "idle" }); }}
            onKeyDown={(e) => { if (e.key === "Enter") run(heard); }}
            placeholder={listening ? (voice.interim || "Listening…") : "Say or type a command…"}
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 18, color: NAVY,
              fontFamily: "Inter, sans-serif", background: "transparent",
            }}
          />

          <button type="button" onClick={onClose} title="Close (Esc)"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: statusLine.colour, display: "flex", alignItems: "center", gap: 8 }}>
            {outcome.kind === "switching" && <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />}
            {statusLine.text}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
            <CornerDownLeft style={{ width: 12, height: 12 }} /> run &nbsp;·&nbsp; Esc close
          </span>
        </div>

        {/* A few examples, so the officer knows what it understands. */}
        <div style={{ padding: "10px 18px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Open Threat Mapping", "Register a case", "Crime analytics", "My tasks"].map((ex) => (
            <button
              key={ex}
              onClick={() => { setHeard(ex); run(ex); }}
              style={{
                fontSize: 12, color: NAVY, background: "white", border: "1px solid #e2e8f0",
                borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
