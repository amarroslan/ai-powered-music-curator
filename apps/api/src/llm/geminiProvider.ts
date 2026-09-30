import { QuestionSchema } from "@curator/shared";
import { LlmError, type NextQuestionResult, type QuizLlmProvider } from "./types.js";
import { QUESTION_JSON_DESCRIPTION, SYSTEM_PROMPT, userPrompt } from "../quiz/prompt.js";
import { config } from "../config.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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

/** Real provider: Gemini free tier with structured (JSON) output. */
export function createGeminiProvider(apiKey: string): QuizLlmProvider {
  return {
    name: `gemini:${GEMINI_MODEL}`,

    async nextQuestion(input) {
      const res = await fetch(`${BASE_URL}/${GEMINI_MODEL}:generateContent`, {
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
        throw new LlmError(
          `gemini ${res.status}: ${body.slice(0, 300)}`,
          res.status,
        );
      }

      const data = (await res.json()) as GeminiResponse;
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      if (!text.trim()) {
        throw new LlmError("gemini returned an empty response");
      }
      return parseProviderOutput(text, "gemini");
    },
  };
}
