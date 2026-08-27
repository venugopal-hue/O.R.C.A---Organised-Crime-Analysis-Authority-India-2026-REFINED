import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";
import { listActivity } from "@/lib/adminData";
import { aiRuntimeSettings } from "@/lib/systemSettings";

/**
 * AI model management — what is actually configured, and whether it answers.
 *
 * WHAT THIS REPLACED
 *
 * The tab this feeds showed a hardcoded version history
 * (v3.1.8b-2026.05, "accuracy 92.8%", RETIRED / ARCHIVED) and three buttons —
 * Rollback, Retrain, Restart Service — that were `setTimeout` calls setting a
 * success message. Nothing was ever deployed, retrained or restarted.
 *
 * Those are not features that were merely unimplemented; they are not things
 * this application can do at all. The models are hosted by NVIDIA and Groq. We
 * do not own the weights, cannot roll a version back, cannot retrain, and have
 * no service to restart. Leaving the buttons in place — working or not — would
 * misrepresent what the department controls.
 *
 * WHAT IS REAL AND IS EXPOSED INSTEAD
 *
 *   · which models the server is configured to call, and which key is in use
 *   · whether each one answers RIGHT NOW, probed live
 *   · the runtime parameters actually sent (from SystemSetting, editable)
 *   · how many queries each model has answered, counted from OfficerActivity
 *
 * The probe costs a real API call, so it runs only when asked for
 * (`?probe=1`), not on every page load.
 */

const ANSWERING_MODEL_NVIDIA = "meta/llama-3.1-8b-instruct";
const ANSWERING_MODEL_GROQ = "llama-3.1-8b-instant";
const VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

interface ModelInfo {
  id: string;
  role: string;
  provider: string;
  configured: boolean;
  active: boolean;
  note: string;
  reachable?: boolean | null;
  probeLatencyMs?: number | null;
  probeError?: string;
}

/**
 * A minimal real request. One token, no history — enough to prove the key works
 * and the model answers, without spending anything meaningful.
 */
async function probe(url: string, key: string, model: string) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const latency = Date.now() - startedAt;
    if (res.ok) return { reachable: true, probeLatencyMs: latency, probeError: "" };
    const body = await res.json().catch(() => ({}));
    return {
      reachable: false,
      probeLatencyMs: latency,
      probeError: body?.error?.message || body?.detail || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      reachable: false,
      probeLatencyMs: Date.now() - startedAt,
      probeError: err?.name === "TimeoutError" ? "No response within 12s" : err?.message || "Unreachable",
    };
  }
}

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req, "AI Model Management");
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Insufficient administrative privileges." },
      { status: 403 }
    );
  }

  // Keys are read to decide configuration and to probe. They are NEVER
  // returned, and no prefix or length is exposed either.
  const nvidiaKey = process.env.NVIDIA_API_KEY || "";
  const groqKey = process.env.GROQ_API_KEY || "";
  const useNvidia = Boolean(nvidiaKey);

  const models: ModelInfo[] = [
    {
      id: useNvidia ? ANSWERING_MODEL_NVIDIA : ANSWERING_MODEL_GROQ,
      role: "Answering",
      provider: useNvidia ? "NVIDIA NIM" : "Groq",
      configured: Boolean(nvidiaKey || groqKey),
      active: true,
      note: "Answers every question, including questions about an attached image — the image is read first and handed over as text.",
    },
    {
      id: VISION_MODEL,
      role: "Vision",
      provider: "NVIDIA NIM",
      configured: Boolean(nvidiaKey),
      active: Boolean(nvidiaKey),
      note: nvidiaKey
        ? "Transcribes attached images. It only reads — it never writes the answer, because it was measured to be unreliable at generation."
        : "Not available: image understanding needs the NVIDIA key.",
    },
    {
      id: ANSWERING_MODEL_GROQ,
      role: "Fallback",
      provider: "Groq",
      configured: Boolean(groqKey),
      active: !useNvidia && Boolean(groqKey),
      note: useNvidia
        ? "Standby. Used only when the NVIDIA key is absent; it has no vision model on this account."
        : "Currently answering, because no NVIDIA key is configured.",
    },
  ];

  if (req.nextUrl.searchParams.get("probe") === "1") {
    const results = await Promise.all(
      models.map(async (m) => {
        if (!m.configured) return { reachable: null, probeLatencyMs: null, probeError: "" };
        const isGroq = m.provider === "Groq";
        return probe(isGroq ? GROQ_URL : NVIDIA_URL, isGroq ? groqKey : nvidiaKey, m.id);
      })
    );
    results.forEach((r, i) => Object.assign(models[i], r));
  }

  // Usage, counted from what actually ran. A model with no queries shows zero
  // rather than being hidden — that is information too.
  const activity = await listActivity().catch(() => []);
  const ai = activity.filter((a) => a.activityType === "AI_QUERY");
  const usage = new Map<string, { count: number; failures: number; latencies: number[]; tokens: number }>();
  ai.forEach((a) => {
    if (!a.model) return;
    const u = usage.get(a.model) || { count: 0, failures: 0, latencies: [], tokens: 0 };
    u.count++;
    if (a.outcome === "ERROR") u.failures++;
    if (a.latencyMs !== null) u.latencies.push(a.latencyMs);
    if (a.totalTokens !== null) u.tokens += a.totalTokens;
    usage.set(a.model, u);
  });

  const median = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((x, y) => x - y);
    return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  };

  const withUsage = models.map((m) => {
    const u = usage.get(m.id);
    return {
      ...m,
      queries: u?.count ?? 0,
      failures: u?.failures ?? 0,
      medianLatencyMs: median(u?.latencies ?? []),
      totalTokens: u?.tokens ?? 0,
    };
  });

  return NextResponse.json({
    success: true,
    models: withUsage,
    runtime: await aiRuntimeSettings(),
    // Queries recorded before the Model column existed cannot be attributed.
    unattributedQueries: ai.filter((a) => !a.model).length,
    totalQueries: ai.length,
  });
}
