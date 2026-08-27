import { aiRuntimeSettings } from "@/lib/systemSettings";

/**
 * The shared AI provider chain — SERVER-SIDE ONLY.
 *
 * The chat route learned this the hard way: it once keyed the fallback on a
 * provider's key being ABSENT rather than the call FAILING, so when NVIDIA
 * retired a model and started answering 410 Gone, the assistant went down with
 * a working Groq key sitting unused. The rule is: try each provider in turn,
 * move on when one fails, and take the model id from settings so a rename is a
 * config change rather than a code change.
 *
 * This function is that rule, factored out so a second feature (the relation
 * graph's notes extraction) does not reimplement it and drift. The chat route
 * still has its own richer loop for streaming/vision; this is the plain-text
 * JSON-friendly path.
 */

export interface Provider {
  name: string;
  url: string;
  key: string;
}

/** The configured providers, in priority order, each with a live key. */
export function buildProviders(): Provider[] {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  return [
    { name: "NVIDIA", url: "https://integrate.api.nvidia.com/v1/chat/completions", key: nvidiaKey },
    { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groqKey },
  ].filter((p): p is Provider => !!p.key);
}

export class NoAIProviderError extends Error {
  constructor() {
    super("No AI provider key is configured. Set NVIDIA_API_KEY or GROQ_API_KEY.");
    this.name = "NoAIProviderError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider for a JSON object back (OpenAI-compatible). */
  json?: boolean;
  /**
   * Move this provider to the FRONT of the chain for this call. The fallback
   * order is unchanged; only the starting point moves. Used by JSON extraction,
   * which Groq answers in ~1s while NVIDIA hangs — so trying NVIDIA first there
   * only burns the timeout before failing over.
   */
  preferProvider?: string;
  /**
   * Per-provider timeout. A provider that stalls past this is treated as a
   * failure and the chain moves on. This is not optional insurance: NVIDIA
   * reliably HANGS on a json_object request with the current reasoning model
   * (observed >25s with no response), while Groq answers the same call in ~1s.
   * Without a timeout the whole request hangs on the first provider forever.
   */
  timeoutMs?: number;
  /**
   * gpt-oss reasoning budget: "low" | "medium" | "high". The default model is a
   * reasoning model that, left unbounded, spends the ENTIRE token budget on
   * hidden reasoning and returns empty content. "low" caps that so the answer
   * actually arrives. Ignored by providers/models that do not support it.
   */
  reasoningEffort?: string;
}

/**
 * Run one chat completion across the provider chain.
 *
 * Returns the assistant's text and which provider served it. Throws
 * NoAIProviderError when nothing is configured, or an Error naming every
 * provider's failure when all of them fail — so an outage is legible, not a
 * silent empty string.
 */
export async function aiChat(
  messages: ChatMessage[],
  opts: AiChatOptions = {}
): Promise<{ text: string; servedBy: string }> {
  let providers = buildProviders();
  if (!providers.length) throw new NoAIProviderError();
  if (opts.preferProvider) {
    const pref = providers.filter((p) => p.name === opts.preferProvider);
    const rest = providers.filter((p) => p.name !== opts.preferProvider);
    providers = [...pref, ...rest];
  }

  const ai = await aiRuntimeSettings().catch(() => ({ model: "", temperature: 0.3, maxTokens: 1024 } as any));
  const model = ai.model;
  const attempts: string[] = [];

  const timeoutMs = opts.timeoutMs ?? 15000;

  for (const provider of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 1024,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        const detail = err?.error?.message || err?.detail || `HTTP ${res.status}`;
        attempts.push(
          res.status === 410
            ? `${provider.name}: model "${model}" has reached end of life (${detail})`
            : `${provider.name}: ${detail}`
        );
        continue;
      }

      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
      if (!text) { attempts.push(`${provider.name}: empty response`); continue; }
      return { text, servedBy: provider.name };
    } catch (e: any) {
      attempts.push(
        e?.name === "AbortError"
          ? `${provider.name}: timed out after ${timeoutMs}ms`
          : `${provider.name}: ${e?.message || e}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`All AI providers failed. ${attempts.join(" | ")}`);
}
