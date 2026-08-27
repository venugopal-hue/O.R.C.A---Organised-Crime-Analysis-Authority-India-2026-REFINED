"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice for the assistant: dictation in, narration out.
 *
 * ONE IMPLEMENTATION, TWO SCREENS
 *
 * This logic existed twice — once in AIChatbotModule and again in
 * MiniAIAssistant — which meant a fix in one left the other broken. Both now
 * call this.
 *
 * THE BUG THIS EXISTS TO FIX
 *
 * The old `toggleMicrophone` turned the indicator off by setting a piece of
 * state, but it never called `recognition.stop()` — the recognition object was
 * created inside `startListening` and then dropped, so nothing held a reference
 * to it. Pressing stop turned the icon off while THE MICROPHONE STAYED LIVE and
 * kept transcribing into the box. On a police console that is not a cosmetic
 * bug. The instance is kept in a ref here and genuinely stopped.
 *
 * WHERE THE AUDIO GOES
 *
 * Dictation uses the browser's SpeechRecognition, which in Chrome is NOT
 * on-device: the captured audio is sent to Google for transcription. That is
 * why dictation is gated on a departmental setting (`voice.inputEnabled`) and
 * why `permission` and `unsupported` are surfaced as visible states instead of
 * an `alert()` and a console line an officer will never see.
 *
 * Narration is `speechSynthesis` and is fully local — no audio leaves the
 * machine — so it is never gated.
 */

type Recognition = any;

export type MicState =
  | "idle"
  | "listening"
  /** The officer denied, or has previously denied, microphone access. */
  | "denied"
  /** No SpeechRecognition in this browser (Firefox, most of them). */
  | "unsupported"
  /** Turned off for the department in System Settings. */
  | "disabled"
  | "error";

export interface UseVoiceOptions {
  /** BCP-47 tag driving BOTH dictation and narration. */
  language: string;
  /** Called when a final transcript is ready. */
  onTranscript: (text: string) => void;
  /**
   * Hands-free: called when the officer stops speaking and the utterance is
   * complete, so the caller can send it without a click.
   */
  onUtteranceComplete?: (text: string) => void;
  /** Read replies aloud as they arrive. */
  narrate: boolean;
  /** Hands-free loop: auto-send on silence, then reopen the mic after the reply. */
  handsFree: boolean;
  /**
   * Fire `onUtteranceComplete` when a SINGLE utterance ends, without the
   * continuous listening and mic-reopen that hands-free adds. This is what the
   * command palette needs: speak one command, it runs, done. Independent of
   * `handsFree`; either being on triggers completion.
   */
  submitOnEnd?: boolean;
}

/** Languages narrated through Sarvam because the browser has no voice for them.
 *  Mirrors the server's allow-list in /api/voice/tts. */
const SARVAM_TTS_LANGS = new Set(["kn-IN"]);

const getRecognitionCtor = (): any =>
  typeof window === "undefined"
    ? null
    : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

/**
 * Prepare text for narration.
 *
 * Two things here are not cosmetic:
 *
 *   1. A crime number is 18 digits. Left alone, a synthesiser reads it as a
 *      quantity ("one hundred four quadrillion...") which is useless to an
 *      officer trying to note it down. Long digit runs are spaced so they are
 *      read out one digit at a time.
 *
 *   2. The assistant marks unsupported claims with "UNVERIFIED REFERENCE" and
 *      similar warnings. Stripping punctuation and symbols must never remove
 *      those words — a spoken answer that drops its own caveat is worse than
 *      one that was never spoken.
 */
export function narratableText(raw: string): string {
  return String(raw ?? "")
    // Markdown emphasis and list bullets only. Not a blanket symbol strip:
    // that is what used to eat the warning markers.
    .replace(/[*_`#]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // 7+ digits reads as an identifier, not a quantity. Space them out.
    .replace(/\d{7,}/g, (d) => d.split("").join(" "))
    .replace(/\s+/g, " ")
    .trim();
}

export function useVoice(opts: UseVoiceOptions) {
  const { language, onTranscript, onUtteranceComplete, narrate, handsFree, submitOnEnd } = opts;

  const [micState, setMicState] = useState<MicState>("idle");
  /** Live, not-yet-final words. Shown greyed so the officer can see it working. */
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [inputAllowed, setInputAllowed] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  /** Sarvam availability, from the same policy fetch as inputAllowed. */
  const [cloudTts, setCloudTts] = useState(false);
  const [cloudStt, setCloudStt] = useState(false);
  /** A Sarvam transcription round-trip is in flight (no interim words to show). */
  const [transcribing, setTranscribing] = useState(false);

  const recognitionRef = useRef<Recognition>(null);
  /** MediaRecorder path, used when dictation goes to Sarvam instead of the browser. */
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** The <audio> element playing cloud-synthesised narration. */
  const cloudAudioRef = useRef<HTMLAudioElement | null>(null);
  const cloudSttRef = useRef(false);
  useEffect(() => { cloudSttRef.current = cloudStt; }, [cloudStt]);
  /** Accumulates final chunks across one press of the button. */
  const finalRef = useRef("");
  /** Read inside recognition callbacks, which close over their first render. */
  const handsFreeRef = useRef(handsFree);
  const submitOnEndRef = useRef(submitOnEnd);
  const langRef = useRef(language);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { submitOnEndRef.current = submitOnEnd; }, [submitOnEnd]);
  useEffect(() => { langRef.current = language; }, [language]);

  const onTranscriptRef = useRef(onTranscript);
  const onCompleteRef = useRef(onUtteranceComplete);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onCompleteRef.current = onUtteranceComplete; }, [onUtteranceComplete]);

  /* ── Is dictation permitted at all? ──────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/voice", { credentials: "include" });
        const data = await res.json();
        if (!cancelled) {
          setInputAllowed(Boolean(data?.inputEnabled));
          setCloudTts(Boolean(data?.sarvamTts));
          setCloudStt(Boolean(data?.sarvamStt));
        }
      } catch {
        // Fail closed: an unreachable policy is not a licence to transmit audio.
        if (!cancelled) setInputAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /*
   * The voice list arrives ASYNCHRONOUSLY.
   *
   * `getVoices()` returns an EMPTY ARRAY on the first call after a page load;
   * Chrome fills it in later and fires `voiceschanged`. Calling it only at the
   * moment of speaking therefore finds nothing on the first narration, no voice
   * is selected, and the engine falls back to its default — which is US
   * English, whatever language the officer picked.
   *
   * Both chatbots used to run this warm-up themselves. It belongs here, and it
   * has to live in STATE rather than a bare call, so the controls re-render
   * once the list is known.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  /** The best installed voice for a language tag, or null if there is none. */
  const voiceFor = useCallback(
    (lang: string): SpeechSynthesisVoice | null => {
      const want = lang.toLowerCase();
      const exact = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === want);
      if (exact) return exact;
      const prefix = want.split("-")[0];
      return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
    },
    [voices]
  );

  /**
   * True when the officer's language has NO installed voice.
   *
   * This is a real situation, not a theoretical one: Windows Chrome ships a
   * Hindi voice but NO KANNADA VOICE. Without this check the assistant answers
   * in Kannada script and the engine reads it with a US English voice, which
   * produces nonsense the officer is left to interpret as a broken feature.
   * Narration is skipped and the reason is put on screen instead.
   */
  const narrationVoiceMissing =
    voices.length > 0 && voiceFor(language) === null && !(cloudTts && SARVAM_TTS_LANGS.has(language));

  /* ── Narration ───────────────────────────────────────────────────────── */
  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const a = cloudAudioRef.current;
    if (a) { a.pause(); a.src = ""; cloudAudioRef.current = null; }
    setSpeaking(false);
  }, []);

  /** Stop any cloud-synthesised audio that is playing. */
  const stopCloudAudio = useCallback(() => {
    const a = cloudAudioRef.current;
    if (a) { a.pause(); a.src = ""; cloudAudioRef.current = null; }
  }, []);

  /**
   * Narrate a language the browser cannot speak (Kannada) via Sarvam.
   *
   * Billed, so it is only reached when there is genuinely no local voice AND
   * the department has switched it on. The audio comes back base64 and is
   * played from a data URL — nothing is written to disk.
   */
  const speakViaCloud = useCallback(async (clean: string, lang: string) => {
    try {
      setSpeaking(true);
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: clean, language_code: lang }),
      });
      const data = await res.json();
      if (!data?.success || !data.audio) { setSpeaking(false); return; }

      stopCloudAudio();
      const audio = new Audio(`data:audio/${data.codec || "mp3"};base64,${data.audio}`);
      cloudAudioRef.current = audio;
      audio.onended = () => { setSpeaking(false); cloudAudioRef.current = null; };
      audio.onerror = () => { setSpeaking(false); cloudAudioRef.current = null; };
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      setSpeaking(false);
    }
  }, [stopCloudAudio]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined") return;
    const clean = narratableText(text);
    if (!clean) return;
    const lang = langRef.current;

    // One language setting drives dictation and narration. Asking in Kannada
    // and being answered in a US English voice was the old behaviour, because
    // the two halves picked their language independently.
    const voice = voiceFor(lang);
    if (voice) {
      window.speechSynthesis.cancel();
      stopCloudAudio();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.voice = voice;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      return;
    }

    // No local voice. Sarvam can speak Kannada if it is switched on; otherwise
    // there is nothing that can pronounce this and the UI already says so.
    if (cloudTts && SARVAM_TTS_LANGS.has(lang)) { void speakViaCloud(clean, lang); return; }
    setSpeaking(false);
  }, [voiceFor, cloudTts, speakViaCloud, stopCloudAudio]);

  /* ── Dictation ───────────────────────────────────────────────────────── */
  /**
   * DICTATION VIA SARVAM (the private route).
   *
   * When `voice.sarvamStt` is on, the officer's audio is recorded here and sent
   * to Sarvam — Indian-hosted — instead of the browser streaming it to Google.
   * There is no interim transcript on this path (MediaRecorder yields none), so
   * the UI shows "Transcribing..." while the round-trip runs.
   */
  const finishRecording = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    setMicState("idle");

    if (!blob.size) return;
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "dictation.webm");
      form.append("language_code", langRef.current || "unknown");
      const res = await fetch("/api/voice/stt", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      const text = String(data?.transcript || "").trim();
      if (text) {
        onTranscriptRef.current(text);
        if (handsFreeRef.current || submitOnEndRef.current) onCompleteRef.current?.(text);
      }
    } catch {
      setMicState("error");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => { void finishRecording(); };
      rec.start();
      setInterim("");
      setMicState("listening");
    } catch (e: any) {
      setMicState(e?.name === "NotAllowedError" ? "denied" : "error");
    }
  }, [finishRecording, stopSpeaking]);

  const stopRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch { /* already stopped */ } }
    setMicState((s) => (s === "listening" ? "idle" : s));
  }, []);

  const stopListening = useCallback(() => {
    if (cloudSttRef.current) { stopRecording(); return; }
    const rec = recognitionRef.current;
    if (rec) {
      // `stop` finalises the current utterance; `abort` would discard it. The
      // officer has already spoken the words, so they are kept.
      try { rec.stop(); } catch { /* already stopped */ }
    }
    setMicState((s) => (s === "listening" ? "idle" : s));
  }, [stopRecording]);

  const startListening = useCallback(() => {
    if (inputAllowed === false) { setMicState("disabled"); return; }

    // Private route: record and send to Sarvam instead of the browser recogniser.
    if (cloudSttRef.current) { void startRecording(); return; }

    const Ctor = getRecognitionCtor();
    if (!Ctor) { setMicState("unsupported"); return; }

    // Barge-in: speaking over the assistant cuts the narration rather than
    // making the officer wait for it to finish.
    stopSpeaking();

    const rec: Recognition = new Ctor();
    rec.lang = langRef.current;
    // Interim results are what make the control feel alive. Without them
    // nothing appears until the officer stops talking, which reads as frozen.
    rec.interimResults = true;
    rec.continuous = handsFreeRef.current;
    rec.maxAlternatives = 1;

    finalRef.current = "";
    setInterim("");

    rec.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += (finalRef.current ? " " : "") + result[0].transcript.trim();
        else interimText += result[0].transcript;
      }
      setInterim(interimText.trim());
      if (finalRef.current) onTranscriptRef.current(finalRef.current);
    };

    rec.onerror = (event: any) => {
      // A silent timeout is not a failure worth shouting about — it is what
      // happens when somebody opens the mic and thinks for a moment.
      if (event.error === "no-speech" || event.error === "aborted") return;
      setMicState(
        event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "error"
      );
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setInterim("");
      setMicState((s) => (s === "listening" ? "idle" : s));

      const spoken = finalRef.current.trim();
      finalRef.current = "";
      if ((handsFreeRef.current || submitOnEndRef.current) && spoken) onCompleteRef.current?.(spoken);
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setMicState("listening");
    } catch {
      // start() throws if a previous instance is still winding down.
      setMicState("error");
    }
  }, [inputAllowed, stopSpeaking, startRecording]);

  const toggleListening = useCallback(() => {
    if (micState === "listening") stopListening();
    else startListening();
  }, [micState, startListening, stopListening]);

  /**
   * Narrate a reply, and in hands-free mode reopen the microphone once the
   * narration has finished — never during it, or the assistant transcribes
   * itself.
   */
  const handleReply = useCallback(
    (text: string) => {
      if (!narrate) {
        if (handsFreeRef.current) startListening();
        return;
      }
      speak(text);
      if (!handsFreeRef.current) return;

      const poll = window.setInterval(() => {
        if (!window.speechSynthesis?.speaking) {
          window.clearInterval(poll);
          if (handsFreeRef.current) startListening();
        }
      }, 300);
    },
    [narrate, speak, startListening]
  );

  /* Leaving the screen must not leave the microphone open or the synthesiser
     talking to an empty room. */
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* nothing to abort */ }
      recognitionRef.current = null;
      // Release the microphone and stop any cloud audio too — the Sarvam path
      // holds a live MediaStream that would otherwise keep the mic indicator on.
      try { mediaRef.current?.stop(); } catch { /* already stopped */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const a = cloudAudioRef.current;
      if (a) { a.pause(); a.src = ""; cloudAudioRef.current = null; }
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    micState,
    interim,
    speaking,
    /** null while the policy is still loading. */
    inputAllowed,
    /** Dictation goes to Sarvam (Indian-hosted) rather than the browser. */
    cloudStt,
    /** Kannada narration is available through Sarvam. */
    cloudTts,
    /** A Sarvam transcription round-trip is in flight. */
    transcribing,
    /** No installed voice can speak the selected language. */
    narrationVoiceMissing,
    /** Which language the narration will actually use. */
    narrationVoiceName: voiceFor(language)?.name || null,
    supported: Boolean(getRecognitionCtor()),
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    handleReply,
  };
}
