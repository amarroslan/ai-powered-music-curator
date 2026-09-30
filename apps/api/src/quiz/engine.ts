import { QUIZ_LIMITS, QuestionSchema } from "@curator/shared";
import type { Answer, Question } from "@curator/shared";
import {
  LlmError,
  type NextQuestionInput,
  type NextQuestionResult,
  type QuizLlmProvider,
} from "../llm/types.js";
import type { QuizStore } from "./store.js";

const MAX_LLM_ATTEMPTS = 2;

export class QuizEngineError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "QuizEngineError";
  }
}

export type AskResult = { done: false; question: Question } | { done: true };

export interface QuizOutcome {
  result: AskResult;
  questionCount: number;
  minQuestions: number;
  maxQuestions: number;
}

export type QuizEngine = ReturnType<typeof createQuizEngine>;

/**
 * The adaptive quiz engine (SPEC.md §5): commits each answer, then asks
 * the LLM provider for the next question with hard server-side
 * guardrails — min/max counts, schema validation, topic uniqueness, and
 * a deterministic fallback question if the provider misbehaves.
 */
export function createQuizEngine(store: QuizStore, provider: QuizLlmProvider) {
  async function ask(count: number, history: NextQuestionInput["history"]): Promise<AskResult> {
    const input: NextQuestionInput = {
      questionCount: count,
      minQuestions: QUIZ_LIMITS.min,
      maxQuestions: QUIZ_LIMITS.max,
      history,
    };
    const usedTopics = new Set(history.map((h) => h.question.topic));

    for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt++) {
      let result: NextQuestionResult;
      try {
        result = await provider.nextQuestion(input);
      } catch (err) {
        // Provider down (quota, capacity, outage): keep the session
        // alive with a deterministic question instead of 503-ing the
        // user mid-quiz (SPEC.md §14 — never break the vibe).
        console.error(
          "[quiz] llm provider failed, serving fallback question:",
          err instanceof Error ? err.message : err,
        );
        return { done: false, question: fallbackQuestion(count, usedTopics) };
      }

      if (result.done) {
        if (count >= QUIZ_LIMITS.min) return { done: true };
        continue; // provider tried to finish too early — try again
      }

      // Validate the model output against the shared schema (providers
      // already parse, but this is the trust boundary).
      const parsed = QuestionSchema.safeParse(result.question);
      if (!parsed.success) {
        if (attempt < MAX_LLM_ATTEMPTS) continue;
        return { done: false, question: fallbackQuestion(count, usedTopics) };
      }

      const question = parsed.data;
      if (usedTopics.has(question.topic)) {
        if (attempt < MAX_LLM_ATTEMPTS) continue;
        return { done: false, question: fallbackQuestion(count, usedTopics) };
      }

      return { done: false, question: { ...question, index: count } };
    }

    return { done: false, question: fallbackQuestion(count, usedTopics) };
  }

  return {
    providerName: provider.name,

    async start(): Promise<{ sessionId: string; question: Question }> {
      const session = await store.create();
      const result = await ask(0, []);
      if (!result.done) {
        const question = { ...result.question, index: 0 };
        await store.setPendingQuestion(session.id, question);
        return { sessionId: session.id, question };
      }
      // Practically unreachable (fallback pool always has topics).
      throw new QuizEngineError("quiz_bootstrap_failed", 500);
    },

    async submitAnswer(sessionId: string, answer: Answer): Promise<QuizOutcome> {
      const session = await store.get(sessionId);
      if (!session) throw new QuizEngineError("quiz_session_not_found", 404);
      if (session.status !== "active") {
        throw new QuizEngineError("quiz_session_not_active", 409);
      }
      const pending = session.pendingQuestion;
      if (!pending) throw new QuizEngineError("no_pending_question", 409);

      validateAnswer(pending, answer);

      const questionCount = session.questionCount + 1;
      await store.appendAnswer(sessionId, pending, answer, questionCount);

      // Hard cap: finish without another LLM round-trip.
      if (questionCount >= QUIZ_LIMITS.max) {
        return {
          result: { done: true },
          questionCount,
          minQuestions: QUIZ_LIMITS.min,
          maxQuestions: QUIZ_LIMITS.max,
        };
      }

      const result = await ask(questionCount, session.history);
      if (!result.done) {
        await store.setPendingQuestion(sessionId, result.question);
      }
      return {
        result,
        questionCount,
        minQuestions: QUIZ_LIMITS.min,
        maxQuestions: QUIZ_LIMITS.max,
      };
    },

    async getState(sessionId: string) {
      const session = await store.get(sessionId);
      if (!session) throw new QuizEngineError("quiz_session_not_found", 404);
      return {
        sessionId: session.id,
        status: session.status,
        questionCount: session.questionCount,
        minQuestions: QUIZ_LIMITS.min,
        maxQuestions: QUIZ_LIMITS.max,
      };
    },

    async beginGeneration(sessionId: string): Promise<void> {
      const session = await store.get(sessionId);
      if (!session) throw new QuizEngineError("quiz_session_not_found", 404);
      if (session.questionCount < QUIZ_LIMITS.min) {
        throw new QuizEngineError("quiz_too_short", 422);
      }
      if (session.status !== "active") {
        throw new QuizEngineError("quiz_session_not_active", 409);
      }
      await store.setStatus(sessionId, "generating");
    },
  };
}

// ---- answer validation ----------------------------------------------------

function validateAnswer(question: Question, answer: Answer): void {
  if (answer.questionId !== question.id) {
    throw new QuizEngineError("answer_question_mismatch", 422);
  }

  const optionIds = new Set(question.options?.map((o) => o.id) ?? []);

  switch (question.type) {
    case "single_choice":
      if (answer.type !== "single_choice" || !optionIds.has(answer.optionId)) {
        throw new QuizEngineError("invalid_answer", 422);
      }
      break;
    case "multi_choice":
      if (
        answer.type !== "multi_choice" ||
        answer.optionIds.some((id) => !optionIds.has(id))
      ) {
        throw new QuizEngineError("invalid_answer", 422);
      }
      break;
    case "scale":
      if (answer.type !== "scale") throw new QuizEngineError("invalid_answer", 422);
      break;
    case "free_text":
      if (answer.type !== "free_text") throw new QuizEngineError("invalid_answer", 422);
      break;
  }
}

// ---- deterministic fallback -------------------------------------------------

const FALLBACK_QUESTIONS = [
  {
    topic: "energy-dial",
    text: "Quick one: crank the energy dial for this playlist — 1 is sleepy, 10 is a headline set.",
    options: [
      { id: "chill", label: "Keep it sleepy (1-3)", emoji: "😴" },
      { id: "steady", label: "Steady middle (4-6)", emoji: "🚶" },
      { id: "buzzing", label: "Buzzing (7-8)", emoji: "🐝" },
      { id: "max", label: "Straight to 10", emoji: "🔥" },
    ],
  },
  {
    topic: "vibe-one-word",
    text: "Describe the exact vibe you want in one word.",
    options: [
      { id: "euphoric", label: "Euphoric", emoji: "🌅" },
      { id: "melancholy", label: "Melancholy", emoji: "🌧️" },
      { id: "furious", label: "Furious", emoji: "🌩️" },
      { id: "dreamy", label: "Dreamy", emoji: "☁️" },
    ],
  },
  {
    topic: "payoff-final",
    text: "How should the last song leave you feeling?",
    options: [
      { id: "full", label: "Completely full", emoji: "🫙" },
      { id: "empty", label: "Beautifully empty", emoji: "🫧" },
      { id: "wired", label: "Wired for more", emoji: "🔌" },
    ],
  },
];

function fallbackQuestion(count: number, usedTopics: Set<string>): Question {
  const fresh = FALLBACK_QUESTIONS.filter((q) => !usedTopics.has(q.topic));
  const pick = fresh[0] ?? {
    topic: `wildcard-${count}`,
    text: "Wildcard round: pick the track that feels most like you.",
    options: [
      { id: "heart", label: "With my heart", emoji: "❤️" },
      { id: "gut", label: "With my gut", emoji: "🦾" },
      { id: "chaos", label: "With pure chaos", emoji: "🌪️" },
    ],
  };
  return {
    id: `fallback-${count}-${pick.topic}`,
    index: count,
    type: "single_choice",
    topic: pick.topic,
    text: pick.text,
    options: pick.options,
  };
}
