import { createGeminiProvider } from "./geminiProvider.js";
import { mockProvider } from "./mockProvider.js";
import type { QuizLlmProvider } from "./types.js";
import { config } from "../config.js";

export function getQuizLlmProvider(): QuizLlmProvider {
  if (config.geminiApiKey) {
    return createGeminiProvider(config.geminiApiKey);
  }
  console.warn(
    "[llm] GEMINI_API_KEY not set — using deterministic mock questions (M2 dev mode)",
  );
  return mockProvider;
}

export { mockProvider } from "./mockProvider.js";
export { LlmError } from "./types.js";
export type {
  QuizLlmProvider,
  NextQuestionInput,
  NextQuestionResult,
} from "./types.js";
