/**
 * O.R.C.A system settings — Catalyst backed (SERVER-SIDE ONLY).
 *
 * The settings screen used to be fifteen `useState` values and a Save button
 * that ran `setTimeout(1200)` and then showed "System settings saved
 * successfully." Nothing was written anywhere. Reloading the page silently
 * reverted every change, which is worse than having no settings screen at all:
 * an administrator would believe MFA had been enforced when it had not.
 *
 * Two separate problems were tangled together there, and they are separated
 * here:
 *
 *   1. PERSISTENCE — is the value stored? Everything below is now stored, in
 *      the `SystemSetting` table, one row per key.
 *
 *   2. ENFORCEMENT — does the value do anything? This is the honest part. Most
 *      of those toggles describe behaviour owned by Firebase Auth or by the
 *      hosting platform, not by this application. `enforcement` states which,
 *      per setting, and the UI shows it. A stored-but-unenforced setting is a
 *      recorded policy decision, not a lie — provided it says so.
 *
 * Settings are read on the server. There is deliberately no public read route:
 * `maxSignInAttempts` and the session timeout describe the security posture and
 * are not something an unauthenticated caller should be able to enumerate.
 */

import { getAllRows, insertRows, updateRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
// Catalyst rejects ISO-8601; see catalystNow() for what it does accept.
import { catalystNow } from "@/lib/adminData";

export const SETTINGS_TABLE = "SystemSetting";

export type Enforcement =
  /** This application reads the value and acts on it. */
  | "enforced"
  /** Owned by Firebase Auth. Recorded here as the department's policy. */
  | "firebase"
  /** Owned by the hosting platform / AppSail. Recorded, not applied by us. */
  | "infrastructure"
  /** Nothing consumes it yet. Recorded so the decision is not lost. */
  | "recorded";

export interface SettingSpec {
  key: string;
  label: string;
  group: string;
  type: "boolean" | "number" | "string";
  fallback: boolean | number | string;
  enforcement: Enforcement;
  /** Shown under the control. Says what actually happens, in plain words. */
  note: string;
  min?: number;
  max?: number;
  /** Render as a textarea. For values too long for a single-line input. */
  multiline?: boolean;
  /** Numbers that step in fractions (temperature). Defaults to whole numbers. */
  step?: number;
  /** Hidden from System Settings — edited on its own screen instead. */
  hiddenFromSettings?: boolean;
}

/**
 * The catalogue. Adding a setting here is all that is needed — the API, the
 * store and the screen are all driven from it, so there is no second list to
 * keep in step.
 */
/**
 * The prompt the assistant has been running with. Kept here as the fallback so
 * that clearing the field restores known-good behaviour rather than sending an
 * empty system prompt.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are O.R.C.A AI Core, an advanced AI intelligence assistant for the Karnataka State Police and Internal Security Division (ISD).
You assist investigating officers with criminal intelligence analysis, FIR forensic breakdowns, syndicate tracking, ANPR vehicle telemetry, and legal directives.
When the user greets you or speaks casually (e.g. "hi", "hello", "say hi", "yo"), respond warmly, naturally, and concisely.
CRITICAL: Never ask for security clearance levels (such as ISD-1 to ISD-5) or act like a robotic gatekeeper. Be helpful, direct, and conversational at all times.`;

export const SETTING_SPECS: SettingSpec[] = [
  {
    key: "app.name",
    label: "Application Name",
    group: "Application",
    type: "string",
    fallback: "O.R.C.A",
    enforcement: "recorded",
    note: "Display name. Not yet read by the header or the printed letterhead.",
  },
  {
    key: "app.maintenanceMode",
    label: "Maintenance Mode",
    group: "Application",
    type: "boolean",
    fallback: false,
    enforcement: "enforced",
    note: "When on, officers see a maintenance notice instead of the dashboard. Administrators are never locked out.",
  },
  {
    key: "app.debugMode",
    label: "Verbose Server Logging",
    group: "Application",
    type: "boolean",
    fallback: false,
    enforcement: "enforced",
    note: "Writes extra detail to the server log. Never changes what officers see.",
  },
  {
    key: "session.timeoutMinutes",
    label: "Idle Session Timeout (minutes)",
    group: "Sessions",
    type: "number",
    fallback: 30,
    min: 5,
    max: 480,
    enforcement: "enforced",
    note: "An idle tab signs out after this long and the session is closed in the audit trail.",
  },
  {
    key: "security.enforceHttps",
    label: "Enforce HTTPS",
    group: "Security",
    type: "boolean",
    fallback: true,
    enforcement: "infrastructure",
    note: "Applied by the hosting platform's TLS configuration, not by this application. Recorded here as policy.",
  },
  {
    key: "security.rateLimiting",
    label: "API Rate Limiting",
    group: "Security",
    type: "boolean",
    fallback: true,
    enforcement: "infrastructure",
    note: "Applied at the platform edge. This application does not rate limit its own routes.",
  },
  {
    key: "security.vpnEnforcement",
    label: "Block VPN / Proxy Connections",
    group: "Security",
    type: "boolean",
    fallback: true,
    enforcement: "enforced",
    note: "When on, an officer detected on a commercial VPN or anonymising proxy is warned and then signed out. When off, the connection is still recorded as a warning but nobody is signed out.",
  },
  {
    key: "security.vpnGraceSeconds",
    label: "Grace Period Before Sign-out (seconds)",
    group: "Security",
    type: "number",
    fallback: 30,
    min: 10,
    max: 600,
    enforcement: "enforced",
    note: "How long an officer has to disconnect the VPN before the session is closed. The countdown is shown to them.",
  },
  {
    key: "security.trustedIpPrefixes",
    label: "Departmental Address Ranges",
    group: "Security",
    type: "string",
    fallback: "",
    multiline: true,
    enforcement: "enforced",
    note: "Comma-separated address prefixes treated as departmental networks — e.g. 103.21.58, 14.139. Anything listed here is never flagged. Leave blank if the department's egress addresses are not known: an empty list means unrecognised networks are reported as unidentified rather than falsely confirmed as secure.",
  },
  {
    key: "auth.mfaEnforced",
    label: "Require Multi-Factor Authentication",
    group: "Authentication",
    type: "boolean",
    fallback: true,
    enforcement: "firebase",
    note: "Enforced by Firebase Auth, configured in the Firebase console. Recorded here as the department's policy.",
  },
  {
    key: "auth.passwordExpiryDays",
    label: "Password Expiry (days)",
    group: "Authentication",
    type: "number",
    fallback: 90,
    min: 0,
    max: 365,
    enforcement: "firebase",
    note: "Password lifetime is managed by Firebase Auth. Recorded here as policy.",
  },
  {
    key: "auth.maxSignInAttempts",
    label: "Maximum Sign-in Attempts",
    group: "Authentication",
    type: "number",
    fallback: 5,
    min: 3,
    max: 20,
    enforcement: "firebase",
    note: "Firebase Auth throttles repeated failures itself. This application never sees a failed attempt.",
  },
  /**
   * AI runtime parameters.
   *
   * These were three dead controls on the AI Model Management tab — a
   * temperature slider, a max-tokens slider and a system-prompt textarea, none
   * of which was read by anything. /api/chat now loads them from here on every
   * request, so moving a slider genuinely changes the next answer.
   *
   * `hiddenFromSettings` keeps them off the System Settings screen: they belong
   * with the models they configure, not in a list of security policies.
   */
  /*
   * MODEL IDS ARE SETTINGS, NOT LITERALS.
   *
   * On 2026-08-26 `meta/llama-3.1-8b-instruct` reached end of life at 09:00Z
   * and NVIDIA began answering 410 Gone. The id was hardcoded in the chat
   * route, so the assistant died mid-shift and could only be revived by an
   * edit and a redeploy. A model retiring is a scheduled, routine event; it
   * should be a value an administrator can change.
   */
  {
    key: "ai.model",
    label: "Answering Model",
    group: "AI Runtime",
    type: "string",
    fallback: "openai/gpt-oss-20b",
    enforcement: "enforced",
    note: "Model id used for text answers. Must exist on BOTH providers, or the fallback cannot serve the same behaviour.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.visionModel",
    label: "Document Reading Model",
    group: "AI Runtime",
    type: "string",
    fallback: "meta/llama-3.2-11b-vision-instruct",
    enforcement: "enforced",
    note: "Reads text out of an attached image. NVIDIA only — no vision model is available on the fallback provider.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.temperature",
    label: "Temperature",
    group: "AI Runtime",
    type: "number",
    fallback: 0.3,
    min: 0,
    max: 1,
    step: 0.05,
    enforcement: "enforced",
    note: "How much the model varies its wording. Low keeps answers consistent, which is what a case file wants.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.maxTokens",
    label: "Max Response Tokens",
    group: "AI Runtime",
    type: "number",
    fallback: 1024,
    min: 128,
    max: 8192,
    enforcement: "enforced",
    note: "Length cap for an ordinary answer.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.maxTokensWithImages",
    label: "Max Response Tokens (with attachments)",
    group: "AI Runtime",
    type: "number",
    fallback: 2048,
    min: 256,
    max: 8192,
    enforcement: "enforced",
    note: "Reading a document out of a photo runs long, so attachments get a higher cap.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.historyMessages",
    label: "Conversation History Sent",
    group: "AI Runtime",
    type: "number",
    fallback: 6,
    min: 0,
    max: 20,
    enforcement: "enforced",
    note: "How many earlier messages travel with each question. More context costs more tokens.",
    hiddenFromSettings: true,
  },
  {
    key: "ai.systemPrompt",
    label: "System Prompt",
    group: "AI Runtime",
    type: "string",
    fallback: DEFAULT_SYSTEM_PROMPT,
    multiline: true,
    enforcement: "enforced",
    note: "The standing instruction sent with every query. Language mandates, the active module and the active case are appended in code and are not editable here.",
    hiddenFromSettings: true,
  },
  {
    key: "audit.retentionDays",
    label: "Audit Log Retention (days)",
    group: "Retention",
    type: "number",
    fallback: 365,
    min: 30,
    max: 3650,
    enforcement: "recorded",
    note: "No purge job exists. Audit rows are kept indefinitely — this records the intended policy only.",
  },
  {
    key: "backup.retentionDays",
    label: "Backup Retention (days)",
    group: "Retention",
    type: "number",
    fallback: 30,
    min: 7,
    max: 365,
    enforcement: "infrastructure",
    note: "Backups are taken by Catalyst on its own schedule. This application does not run them.",
  },
  {
    key: "voice.inputEnabled",
    label: "Allow Voice Input (Dictation)",
    group: "Voice",
    type: "boolean",
    /*
     * OFF by default, and that default is the decision, not an oversight.
     *
     * The browser's speech recognition is NOT on-device: Chrome streams the
     * captured audio to Google for transcription. An officer dictating a
     * question names crime numbers, accused and stations, so switching this on
     * sends operational speech to a third party. That is a departmental call,
     * so it is off until somebody makes it deliberately.
     *
     * Narration (text-to-speech) is unaffected and always available — it runs
     * entirely in the browser and no audio leaves the machine.
     */
    fallback: false,
    enforcement: "enforced",
    note: "When on, officers can dictate questions to the assistant. Speech recognition is performed by the browser vendor's servers, not on this machine or by this platform, so the spoken audio leaves the device. Reading replies aloud is unaffected — that runs locally and is always available.",
  },
  {
    key: "voice.sarvamTts",
    label: "Kannada Read-Aloud (Sarvam AI)",
    group: "Voice",
    type: "boolean",
    /*
     * Off by default because it BILLS. No Kannada voice exists in the browser
     * on this platform, so Kannada replies otherwise cannot be read aloud at
     * all. When on, only replies with no local browser voice are sent to
     * Sarvam (an Indian-hosted service); English and Hindi stay fully local
     * and cost nothing. Billed per 1,000 characters against a fixed credit
     * balance, so audio is cached by content and long replies are capped.
     */
    fallback: false,
    enforcement: "enforced",
    note: "When on, replies in a language with no browser voice — Kannada — are read aloud using Sarvam AI, an Indian-hosted service. The reply text is sent to Sarvam to generate the audio. English and Hindi narration is unaffected and stays on this machine. This draws on a metered credit balance.",
  },
  {
    key: "voice.sarvamStt",
    label: "Private Dictation (Sarvam AI)",
    group: "Voice",
    type: "boolean",
    /*
     * When on, dictation records audio and sends it to Sarvam (Indian-hosted)
     * instead of the browser streaming it to Google. This is the more private
     * route, but it BILLS per hour of audio, so it is off by default and only
     * takes effect where dictation itself is already permitted.
     */
    fallback: false,
    enforcement: "enforced",
    note: "Requires 'Allow Voice Input' to be on. When enabled, dictated audio is sent to Sarvam AI (Indian-hosted) for transcription instead of to the browser vendor. This is the more private route for Indian languages, but draws on a metered credit balance. When off, dictation uses the browser's own recogniser.",
  },
];

export type SettingValue = boolean | number | string;
export type SettingsMap = Record<string, SettingValue>;

const unwrap = (row: any) => (row && row[SETTINGS_TABLE]) || row || {};
const str = (v: any) => (v === null || v === undefined ? "" : String(v));

const specByKey = new Map(SETTING_SPECS.map((s) => [s.key, s]));

/** Stored as text; coerced back using the spec, never using `typeof` guessing. */
const decode = (spec: SettingSpec, raw: string): SettingValue => {
  if (spec.type === "boolean") return raw === "true" || raw === "1";
  if (spec.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : (spec.fallback as number);
  }
  return raw;
};

const clamp = (spec: SettingSpec, v: SettingValue): SettingValue => {
  if (spec.type !== "number") return v;
  let n = Number(v);
  if (!Number.isFinite(n)) return spec.fallback;
  if (spec.min !== undefined) n = Math.max(spec.min, n);
  if (spec.max !== undefined) n = Math.min(spec.max, n);
  // Temperature is 0.0-1.0. Rounding every number to an integer would have
  // silently turned 0.3 into 0 and made every answer deterministic.
  if (spec.step && spec.step < 1) {
    const dp = String(spec.step).split(".")[1]?.length ?? 2;
    return Number(n.toFixed(dp));
  }
  return Math.round(n);
};

export function defaults(): SettingsMap {
  const out: SettingsMap = {};
  SETTING_SPECS.forEach((s) => {
    out[s.key] = s.fallback;
  });
  return out;
}

/**
 * Read every setting, filling absent keys from the catalogue.
 *
 * A missing row means "never configured", which is not an error — it is the
 * normal state on a fresh deployment. Callers get the fallback, so nothing
 * downstream has to handle undefined.
 */
export async function loadSettings(): Promise<SettingsMap> {
  const out = defaults();
  if (!isCatalystConfigured()) return out;

  const rows = await getAllRows(SETTINGS_TABLE).catch(() => [] as any[]);
  rows.forEach((r) => {
    const rec = unwrap(r);
    const key = str(rec.SettingKey);
    const spec = specByKey.get(key);
    // An unknown key is ignored rather than surfaced: it means the catalogue
    // shrank and the row is now orphaned, which is harmless.
    if (spec) out[key] = decode(spec, str(rec.SettingValue));
  });
  return out;
}

/**
 * Write the settings that actually changed.
 *
 * Only keys present in the catalogue are accepted, and every value is clamped
 * to its declared range before storage — a client cannot set an idle timeout of
 * zero minutes and sign everybody out. Unchanged values are skipped so the
 * audit trail records real changes rather than every press of Save.
 */
export async function saveSettings(
  patch: SettingsMap,
  updatedBy: string
): Promise<{ changed: { key: string; from: SettingValue; to: SettingValue }[] }> {
  const current = await loadSettings();
  const rows = await getAllRows(SETTINGS_TABLE).catch(() => [] as any[]);
  const rowByKey = new Map<string, any>();
  rows.forEach((r) => {
    const rec = unwrap(r);
    const k = str(rec.SettingKey);
    if (k) rowByKey.set(k, rec);
  });

  const changed: { key: string; from: SettingValue; to: SettingValue }[] = [];
  const now = catalystNow();

  for (const [key, raw] of Object.entries(patch)) {
    const spec = specByKey.get(key);
    if (!spec) continue;

    const value = clamp(spec, spec.type === "boolean" ? Boolean(raw) : raw);
    if (String(value) === String(current[key])) continue;

    changed.push({ key, from: current[key], to: value });

    const existing = rowByKey.get(key);
    if (existing) {
      await updateRows(SETTINGS_TABLE, [
        {
          ROWID: existing.ROWID,
          SettingValue: String(value),
          ValueType: spec.type,
          UpdatedBy: updatedBy,
          UpdatedAt: now,
        },
      ]);
    } else {
      const settingId = await nextId(SETTINGS_TABLE, "SettingID");
      await insertRows(SETTINGS_TABLE, [
        {
          SettingID: settingId,
          SettingKey: key,
          SettingValue: String(value),
          ValueType: spec.type,
          UpdatedBy: updatedBy,
          UpdatedAt: now,
        },
      ]);
    }
  }

  return { changed };
}

/** The AI runtime parameters, coerced and ready for the chat route. */
export async function aiRuntimeSettings(): Promise<{
  temperature: number;
  maxTokens: number;
  maxTokensWithImages: number;
  historyMessages: number;
  systemPrompt: string;
  model: string;
  visionModel: string;
}> {
  const s = await loadSettings();
  const prompt = String(s["ai.systemPrompt"] || "").trim();
  const model = String(s["ai.model"] || "").trim();
  const visionModel = String(s["ai.visionModel"] || "").trim();
  return {
    // A blank stored model would be sent as `model: ""` and rejected by both
    // providers, so an empty value falls back exactly as the prompt does.
    model: model || "openai/gpt-oss-20b",
    visionModel: visionModel || "meta/llama-3.2-11b-vision-instruct",
    temperature: Number(s["ai.temperature"]),
    maxTokens: Number(s["ai.maxTokens"]),
    maxTokensWithImages: Number(s["ai.maxTokensWithImages"]),
    historyMessages: Number(s["ai.historyMessages"]),
    // An empty stored prompt falls back rather than being sent as-is: a blank
    // system prompt would quietly drop every instruction the assistant relies on.
    systemPrompt: prompt || DEFAULT_SYSTEM_PROMPT,
  };
}

/** The network-trust settings, coerced for the vpn-check route. */
export async function networkSecuritySettings(): Promise<{
  enforce: boolean;
  graceSeconds: number;
  allowList: string[];
}> {
  const s = await loadSettings();
  return {
    enforce: Boolean(s["security.vpnEnforcement"]),
    graceSeconds: Number(s["security.vpnGraceSeconds"]) || 30,
    allowList: String(s["security.trustedIpPrefixes"] || "")
      // Commas or newlines — administrators paste both.
      .split(/[,\r\n]+/)
      .map((x) => x.trim())
      .filter(Boolean),
  };
}

/** Convenience for the two settings this application genuinely acts on. */
export async function enforcedSettings(): Promise<{
  maintenanceMode: boolean;
  debugMode: boolean;
  sessionTimeoutMinutes: number;
}> {
  const s = await loadSettings();
  return {
    maintenanceMode: Boolean(s["app.maintenanceMode"]),
    debugMode: Boolean(s["app.debugMode"]),
    sessionTimeoutMinutes: Number(s["session.timeoutMinutes"]) || 30,
  };
}
