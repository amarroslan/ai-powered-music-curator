import { QUIZ_LIMITS, QuestionSchema } from "@curator/shared";
import type { Answer, Question, QuizHistoryEntry } from "@curator/shared";
import {
  LlmError,
  type NextQuestionInput,
  type NextQuestionResult,
  type QuizLlmProvider,
} from "../llm/types.js";

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
 * Stateless adaptive quiz engine (SPEC.md §5). The client owns the
 * history; the server verifies its integrity, then asks the LLM
 * provider for the next question with hard guardrails: min/max counts,
 * schema validation, topic uniqueness, and a deterministic fallback if
 * the provider misbehaves.
 */
export function createQuizEngine(provider: QuizLlmProvider) {
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

    /** Verifies the client's history, then produces the next turn. */
    async next(history: QuizHistoryEntry[]): Promise<QuizOutcome> {
      verifyHistory(history);

      const questionCount = history.length;

      // Hard cap: finish without another LLM round-trip.
      if (questionCount >= QUIZ_LIMITS.max) {
        return {
          result: { done: true },
          questionCount,
          minQuestions: QUIZ_LIMITS.min,
          maxQuestions: QUIZ_LIMITS.max,
        };
      }

      const result = await ask(questionCount, history);
      return {
        result,
        questionCount,
        minQuestions: QUIZ_LIMITS.min,
        maxQuestions: QUIZ_LIMITS.max,
      };
    },
  };
}

// ---- history verification ---------------------------------------------------

/**
 * The history is client-supplied, so treat it as hostile: answers must
 * match their questions (type + ids + option ids), and topics must be
 * unique. Tampered or malformed histories are rejected outright.
 */
function verifyHistory(history: QuizHistoryEntry[]): void {
  const seenTopics = new Set<string>();
  history.forEach((entry, i) => {
    const { question, answer } = entry;
    if (seenTopics.has(question.topic)) {
      throw new QuizEngineError(`duplicate_question_topic_at_${i}`, 422);
    }
    seenTopics.add(question.topic);
    try {
      validateAnswer(question, answer);
    } catch {
      throw new QuizEngineError(`invalid_answer_at_${i}`, 422);
    }
  });
}

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
