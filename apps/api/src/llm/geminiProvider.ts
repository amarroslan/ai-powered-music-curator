import { QuestionSchema } from "@curator/shared";
import { LlmError, type NextQuestionResult, type QuizLlmProvider } from "./types.js";
import { QUESTION_JSON_DESCRIPTION, SYSTEM_PROMPT, userPrompt } from "../quiz/prompt.js";
import { callGemini, PRIMARY_MODEL } from "./geminiClient.js";

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
export function createGeminiProvider(): QuizLlmProvider {
  return {
    name: `gemini:${PRIMARY_MODEL}`,

    async nextQuestion(input) {
      const text = await callGemini(userPrompt(input), {
        system: SYSTEM_PROMPT,
        jsonSchema: QUESTION_JSON_DESCRIPTION,
      });
      return parseProviderOutput(text, `gemini:${PRIMARY_MODEL}`);
    },
  };
}
