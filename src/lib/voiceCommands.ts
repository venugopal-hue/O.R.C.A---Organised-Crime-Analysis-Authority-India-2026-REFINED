/**
 * Voice command matching for the command palette.
 *
 * Kept out of the component so it can be tested without the React/Next runtime,
 * and so the command table has one home. Matching is deliberately local and
 * deterministic — see the note in VoiceCommandPalette.tsx.
 */

export interface VoiceCommand {
  id: string;
  label: string;
  route: string;
  /** Spoken phrases that select this command. The longest match wins. */
  aliases: string[];
}

export const VOICE_COMMANDS: VoiceCommand[] = [
  { id: "dashboard",             label: "Command Overview",        route: "/dashboard", aliases: ["command overview", "dashboard", "overview", "home"] },
  { id: "chatbot",               label: "AI Chatbot",              route: "/dashboard", aliases: ["ai chatbot", "chatbot", "assistant", "chat"] },
  { id: "analytics",             label: "Crime Analytics",         route: "/dashboard", aliases: ["crime analytics", "analytics", "statistics", "stats"] },
  { id: "case-registration",     label: "Case Registration",       route: "/dashboard", aliases: ["case registration", "register a case", "register case", "new case", "register fir", "file an fir", "file fir"] },
  { id: "general-diary",         label: "General Diary",           route: "/dashboard", aliases: ["general diary", "station diary", "daily diary", "diary entry", "diary"] },
  { id: "arrest-register",       label: "Arrest Register",         route: "/dashboard", aliases: ["arrest register", "arrest record", "arrests", "arrested persons", "arrest"] },
  { id: "bail-remand",           label: "Bail & Remand Tracker",   route: "/dashboard", aliases: ["bail and remand", "bail remand", "bail tracker", "remand tracker", "bail", "remand"] },
  { id: "watch-list",            label: "Watch List",              route: "/dashboard", aliases: ["watch list", "watchlist", "persons of interest", "surveillance list", "watch"] },
  { id: "wanted-persons",        label: "Wanted Persons",          route: "/dashboard", aliases: ["wanted persons", "wanted list", "wanted criminals", "wanted"] },
  { id: "predictive-analytics",  label: "Predictive Analytics",    route: "/dashboard", aliases: ["predictive analytics", "crime prediction", "forecast", "predictive", "hotspot prediction"] },
  { id: "evidence",              label: "Evidence Management",     route: "/dashboard", aliases: ["evidence management", "evidence locker", "evidence"] },
  { id: "property-register",     label: "Lost & Stolen Property",  route: "/dashboard", aliases: ["lost and stolen", "lost property", "stolen property", "property register", "property"] },
  { id: "tasks",                 label: "Task & Assignment",       route: "/dashboard", aliases: ["task and assignment", "assignments", "my tasks", "tasks"] },
  { id: "networks",              label: "Threat Mapping",          route: "/dashboard", aliases: ["threat mapping", "threat map", "relation graph", "link analysis", "threat"] },
  { id: "heatmap",               label: "District Heatmap",        route: "/dashboard", aliases: ["district heatmap", "heatmap", "heat map", "crime map"] },
  { id: "news",                  label: "State Live News",         route: "/dashboard", aliases: ["state live news", "live news", "news"] },
  { id: "verification-document", label: "Document Verification",   route: "/verification/document", aliases: ["document verification", "verify document", "verify a document"] },
  { id: "admin-dashboard",       label: "Admin Controls",          route: "/dashboard", aliases: ["admin controls", "administration", "admin"] },
  { id: "settings",              label: "Profile Settings",        route: "/dashboard", aliases: ["profile settings", "settings", "my profile"] },
];

export const normaliseCommand = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 0..1 word similarity. 1 is identical; a single typo in a 7-letter word is ~0.86. */
function wordSim(a: string, b: string): number {
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  if (!longer) return 1;
  return 1 - editDistance(a, b) / longer;
}

/**
 * How well an alias is heard in a transcript, 0..1.
 *
 * Speech recognition drops and mangles syllables — "registr a case", "threat
 * maping", "crime analitics". Each alias word is matched to its closest word in
 * the transcript; a word counts only if it is a near hit, so noise words do not
 * inflate the score. This is what lets a mispronounced command still land.
 */
function aliasScore(alias: string, transcriptWords: string[]): number {
  const aliasWords = alias.split(" ");
  let sum = 0;
  for (const aw of aliasWords) {
    let best = 0;
    for (const tw of transcriptWords) {
      const sim = wordSim(aw, tw);
      if (sim > best) best = sim;
    }
    // Below this a "match" is coincidence, not a mishearing.
    sum += best >= 0.72 ? best : 0;
  }
  return sum / aliasWords.length;
}

/** A fuzzy match this confident or better is accepted. */
const FUZZY_THRESHOLD = 0.62;

/**
 * The command for a transcript.
 *
 * Two passes. First an exact substring match, longest alias wins — this is the
 * fast, certain path and covers clean recognition. If nothing matches exactly,
 * a fuzzy pass tolerates mispronunciation and recognition errors, taking the
 * highest-scoring alias above a confidence floor. Returns null only when even
 * the fuzzy pass finds nothing plausible, so a wrong tab is never opened on a
 * guess.
 */
export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const t = normaliseCommand(transcript);
  if (!t) return null;

  // Pass 1 — exact substring, most specific alias wins.
  let best: VoiceCommand | null = null;
  let bestLen = 0;
  for (const cmd of VOICE_COMMANDS) {
    for (const alias of cmd.aliases) {
      if (t.includes(alias) && alias.length > bestLen) {
        best = cmd;
        bestLen = alias.length;
      }
    }
  }
  if (best) return best;

  // Pass 2 — fuzzy, for mishearings.
  const words = t.split(" ");
  let bestScore = 0;
  for (const cmd of VOICE_COMMANDS) {
    for (const alias of cmd.aliases) {
      const score = aliasScore(alias, words);
      // Ties broken toward the more specific (longer) alias.
      if (score > bestScore || (score === bestScore && best && alias.length > bestLen)) {
        bestScore = score;
        best = cmd;
        bestLen = alias.length;
      }
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? best : null;
}
