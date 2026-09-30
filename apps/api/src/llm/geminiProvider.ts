import { QuestionSchema } from "@curator/shared";
import { LlmError, type NextQuestionResult, type QuizLlmProvider } from "./types.js";
import { QUESTION_JSON_DESCRIPTION, SYSTEM_PROMPT, userPrompt } from "../quiz/prompt.js";
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

const PRIMARY_MODEL = GEMINI_MODELS[0];
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Statuses worth retrying on another model in the chain. */
function isRotatableStatus(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/** Parses the provider's JSON output into a validated result. */
export function parseProviderOutput(text: string, provider: string): NextQuestionResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LlmError(`${provider} returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { done?: unknown }).done === true
  ) {
    return { done: true };
  }

  const parsed = QuestionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LlmError(
      `${provider} question failed schema: ${parsed.error.message.slice(0, 300)}`,
    );
  }
  return { done: false, question: parsed.data };
}

async function callModel(
  model: string,
  apiKey: string,
  input: Parameters<QuizLlmProvider["nextQuestion"]>[0],
): Promise<NextQuestionResult> {
  const res = await fetch(`${BASE_URL}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt(input) }] }],
      generationConfig: {
        temperature: 1.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseJsonSchema: QUESTION_JSON_DESCRIPTION,
      },
    }),
    signal: AbortSignal.timeout(config.llmTimeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new LlmError(`gemini ${res.status} (${model}): ${body.slice(0, 200)}`, res.status);
    if (!isRotatableStatus(res.status)) throw err;
    throw Object.assign(err, { rotatable: true });
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new LlmError(`gemini returned an empty response (${model})`);
  }
  return parseProviderOutput(text, `gemini:${model}`);
}

/** Real provider: Gemini free tier with structured (JSON) output. */
export function createGeminiProvider(apiKey: string): QuizLlmProvider {
  return {
    name: `gemini:${PRIMARY_MODEL}`,

    async nextQuestion(input) {
      let lastError: unknown;
      // Two passes over the chain with a short backoff: free-tier 503
      // storms are bursty, and a second swing usually lands.
      for (let pass = 0; pass < 2; pass++) {
        if (pass > 0) {
          await new Promise((r) => setTimeout(r, 1_200));
        }
        for (const model of GEMINI_MODELS) {
          try {
            return await callModel(model, apiKey, input);
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
    },
  };
}
