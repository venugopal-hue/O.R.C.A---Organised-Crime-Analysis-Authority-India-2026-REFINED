"use client";

/**
 * O.R.C.A — face capture liveness measurement.
 *
 * WHAT THIS REPLACED
 * ------------------
 * The registration form advertised "Biometric Face Verification (Anti-Deepfake)".
 * It measured nothing:
 *
 *   - a baseline frame was captured into a ref and never compared to anything;
 *   - two setTimeouts advanced the progress bar 25% -> 60% -> 100% on a fixed
 *     schedule, whatever the camera saw;
 *   - the "blink now" prompt showed for 700ms and no blink was ever checked;
 *   - "LIVENESS ID: GENUINE" was painted onto the image as a claim, not a result;
 *   - if the webcam was missing or DENIED, it drew a cartoon (a gradient, a
 *     circle for a head, an ellipse for shoulders), stamped it
 *     "LIVENESS ID: VERIFIED (GENUINE)", and accepted it. An officer could
 *     register with no camera at all and be recorded as biometrically verified;
 *   - an "Instant Snap" button skipped even that.
 *
 * WHAT THIS DOES
 * --------------
 * Real, measured signals from the live video frames:
 *
 *   1. A camera stream must exist and be producing frames of non-zero size.
 *   2. Exposure: the frame must not be near-black, blown out, or near-uniform
 *      (a covered lens or a blank wall).
 *   3. Stillness phase: frame-to-frame difference is sampled while the subject
 *      holds still, establishing that baseline noise level.
 *   4. Challenge phase: the subject is asked to blink/move, and the difference
 *      must SPIKE measurably above that baseline. A photograph held to the lens
 *      produces no spike.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is **not** anti-deepfake, and the UI must not claim that it is. Defeating
 * it needs only a moving face - a video replay, or a printed photo that is
 * wiggled, will pass. Real presentation-attack detection needs either a
 * depth/IR sensor or a trained model, neither of which exists here.
 *
 * It is an honest motion-liveness gate: much stronger than accepting a drawing
 * of a person, much weaker than the old label promised. Every decision carries
 * the numbers behind it so a reviewer can audit the judgement.
 */

export interface LivenessMetrics {
  /** Frames actually sampled. */
  frames: number;
  /** Mean luma 0-255. Rejects a black frame or a blown-out one. */
  brightness: number;
  /** Luma standard deviation. Near-zero means a lens cap or a blank wall. */
  contrast: number;
  /** Typical frame-to-frame change while holding still (0-100). */
  baselineDelta: number;
  /** Largest frame-to-frame change during the challenge (0-100). */
  peakDelta: number;
  /** peakDelta / baselineDelta. The evidence that something moved on cue. */
  responseRatio: number;
  capturedAt: string;
}

export interface LivenessResult {
  passed: boolean;
  /** Plain-language reasons for a failure, shown to the officer. */
  reasons: string[];
  metrics: LivenessMetrics;
}

/**
 * Thresholds. Deliberately named and commented rather than sprinkled as magic
 * numbers, because tuning these changes who can register.
 */
const MIN_BRIGHTNESS = 25;    // below this the frame is effectively dark
const MAX_BRIGHTNESS = 240;   // above this it is washed out
const MIN_CONTRAST = 12;      // a lens cap or flat wall sits near zero
const MIN_PEAK_DELTA = 1.2;   // absolute floor: something must actually change
const MIN_RESPONSE_RATIO = 1.8; // the challenge must move measurably more than stillness
const SAMPLE_INTERVAL_MS = 100;
/** Divisor floor for responseRatio, so a silent sensor cannot divide by zero. */
const BASELINE_FLOOR = 0.05;

const SAMPLE_W = 160;   // downscale: this is a motion measure, not a portrait
const SAMPLE_H = 120;

function grabLuma(video: HTMLVideoElement, ctx: CanvasRenderingContext2D): Uint8ClampedArray | null {
  try {
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    const luma = new Uint8ClampedArray(SAMPLE_W * SAMPLE_H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Rec. 601 luma; cheaper and steadier than working in RGB.
      luma[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return luma;
  } catch {
    // A cross-origin or not-yet-ready frame taints the canvas.
    return null;
  }
}

/** Mean absolute difference between two luma frames, scaled 0-100. */
function frameDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return (sum / a.length / 255) * 100;
}

function exposure(frame: Uint8ClampedArray): { brightness: number; contrast: number } {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i];
  const mean = sum / frame.length;
  let sq = 0;
  for (let i = 0; i < frame.length; i++) sq += (frame[i] - mean) ** 2;
  return { brightness: mean, contrast: Math.sqrt(sq / frame.length) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LivenessOptions {
  /** Called as the check moves through its phases, for the UI. */
  onPhase?: (phase: "settling" | "stillness" | "challenge" | "done", progress: number) => void;
  stillnessMs?: number;
  challengeMs?: number;
}

/**
 * Run the check against a live <video>. Rejects immediately if the element is
 * not backed by an active camera stream — there is no simulated path.
 */
export async function runLivenessCheck(
  video: HTMLVideoElement | null,
  options: LivenessOptions = {}
): Promise<LivenessResult> {
  const { onPhase, stillnessMs = 1200, challengeMs = 2000 } = options;

  const fail = (reason: string): LivenessResult => ({
    passed: false,
    reasons: [reason],
    metrics: {
      frames: 0, brightness: 0, contrast: 0,
      baselineDelta: 0, peakDelta: 0, responseRatio: 0,
      capturedAt: new Date().toISOString(),
    },
  });

  const stream = video?.srcObject as MediaStream | null;
  if (!video || !stream || !stream.active || stream.getVideoTracks().length === 0) {
    return fail("No active camera. Face capture requires a working camera — it cannot be skipped.");
  }
  if (!video.videoWidth || !video.videoHeight) {
    return fail("The camera is not producing an image yet. Wait a moment and try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fail("This browser cannot read frames from the camera.");

  // ── Let auto-exposure settle, then check the frame is usable ──────────────
  onPhase?.("settling", 10);
  await sleep(400);

  const first = grabLuma(video, ctx);
  if (!first) return fail("The camera frame could not be read.");

  const { brightness, contrast } = exposure(first);
  const reasons: string[] = [];
  if (brightness < MIN_BRIGHTNESS) reasons.push("Too dark — move somewhere brighter or uncover the lens.");
  else if (brightness > MAX_BRIGHTNESS) reasons.push("Too bright — move out of direct light.");
  if (contrast < MIN_CONTRAST) reasons.push("No face detected in frame — the image is almost flat.");

  const metricsOf = (frames: number, baselineDelta: number, peakDelta: number): LivenessMetrics => ({
    frames,
    brightness: Number(brightness.toFixed(1)),
    contrast: Number(contrast.toFixed(1)),
    baselineDelta: Number(baselineDelta.toFixed(3)),
    peakDelta: Number(peakDelta.toFixed(3)),
    // Divide by a floor, never by zero. A baseline of 0 means the sensor is
    // perfectly quiet, so a large peak is the STRONGEST evidence of movement -
    // returning 0 here rejected exactly the clearest pass. Found while testing
    // against a synthetic noise-free camera.
    responseRatio: Number((peakDelta / Math.max(baselineDelta, BASELINE_FLOOR)).toFixed(2)),
    capturedAt: new Date().toISOString(),
  });

  if (reasons.length) {
    return { passed: false, reasons, metrics: metricsOf(1, 0, 0) };
  }

  // ── Stillness: what does "not moving" look like for this camera? ──────────
  onPhase?.("stillness", 30);
  let prev = first;
  const stillDeltas: number[] = [];
  const stillSamples = Math.max(3, Math.round(stillnessMs / SAMPLE_INTERVAL_MS));
  for (let i = 0; i < stillSamples; i++) {
    await sleep(SAMPLE_INTERVAL_MS);
    const f = grabLuma(video, ctx);
    if (!f) continue;
    stillDeltas.push(frameDelta(prev, f));
    prev = f;
    onPhase?.("stillness", 30 + Math.round((i / stillSamples) * 25));
  }

  // Median, so one twitch does not inflate the baseline.
  const sorted = [...stillDeltas].sort((a, b) => a - b);
  const baselineDelta = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  // ── Challenge: blink / move. The difference must spike. ───────────────────
  onPhase?.("challenge", 60);
  let peakDelta = 0;
  const challengeSamples = Math.max(5, Math.round(challengeMs / SAMPLE_INTERVAL_MS));
  for (let i = 0; i < challengeSamples; i++) {
    await sleep(SAMPLE_INTERVAL_MS);
    const f = grabLuma(video, ctx);
    if (!f) continue;
    peakDelta = Math.max(peakDelta, frameDelta(prev, f));
    prev = f;
    onPhase?.("challenge", 60 + Math.round((i / challengeSamples) * 35));
  }

  const metrics = metricsOf(1 + stillDeltas.length + challengeSamples, baselineDelta, peakDelta);

  if (peakDelta < MIN_PEAK_DELTA) {
    reasons.push("No movement detected. A still photograph will not pass — blink and turn your head slightly.");
  } else if (metrics.responseRatio < MIN_RESPONSE_RATIO) {
    reasons.push("Movement was not clear enough. Blink deliberately when prompted, then try again.");
  }

  onPhase?.("done", 100);
  return { passed: reasons.length === 0, reasons, metrics };
}
