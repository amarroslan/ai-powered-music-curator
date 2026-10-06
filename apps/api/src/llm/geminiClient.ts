import { LlmError } from "./types.js";
import { config } from "../config.js";

/**
 * Fallback chain (SPEC.md §14): concrete models first — ordered by
 * observed free-tier availability — then the evergreen alias. Google
 * rotates model availability, so requests rotate on 404/429/5xx but
 * fail fast on auth errors (those mean the key itself is bad).
 */
const GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
] as const;

export const PRIMARY_MODEL = GEMINI_MODELS[0];
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Statuses worth retrying on another model in the chain. */
function isRotatableStatus(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}

export interface GeminiCallOptions {
  system: string;
  prompt: string;
  jsonSchema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

async function callModel(
  model: string,
  apiKey: string,
  opts: GeminiCallOptions,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 1.1,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        responseJsonSchema: opts.jsonSchema,
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? config.llmTimeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new LlmError(
      `gemini ${res.status} (${model}): ${body.slice(0, 200)}`,
      res.status,
    );
    if (!isRotatableStatus(res.status)) throw err;
    throw Object.assign(err, { rotatable: true });
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new LlmError(`gemini returned an empty response (${model})`);
  }
  return text;
}

/**
 * One Gemini call with structured output, rotating across the model
 * chain. Two passes with a short backoff: free-tier 503 storms are
 * bursty, and a second swing usually lands.
 */
export async function callGemini(
  prompt: string,
  opts: Omit<GeminiCallOptions, "prompt">,
): Promise<string> {
  const apiKey = config.geminiApiKey;
  let lastError: unknown;

  for (let pass = 0; pass < 2; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, 1_200));
    for (const model of GEMINI_MODELS) {
      try {
        return await callModel(model, apiKey, { ...opts, prompt });
      } catch (err) {
        lastError = err;
        const rotatable = (err as { rotatable?: boolean }).rotatable === true;
        if (err instanceof LlmError && rotatable) {
          console.warn(`[llm] ${model} unavailable, trying next in chain: ${err.message}`);
          continue;
        }
        throw err;
      }
    }
  }

  throw lastError instanceof LlmError
    ? lastError
    : new LlmError("all gemini models in the chain failed");
}
