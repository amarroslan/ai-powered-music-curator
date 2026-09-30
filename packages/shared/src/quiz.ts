import { z } from "zod";

/** Types of questions the adaptive quiz engine can ask. */
export const QUESTION_TYPES = [
  "single_choice",
  "multi_choice",
  "scale",
  "free_text",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QuizOptionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
});
export type QuizOption = z.infer<typeof QuizOptionSchema>;

const ScaleSchema = z.object({
  min: z.literal(1),
  max: z.literal(10),
  minLabel: z.string().min(1).max(60),
  maxLabel: z.string().min(1).max(60),
});

/**
 * A quiz question. The LLM generates these adaptively; the server
 * validates them against this schema before sending to the client.
 */
export const QuestionSchema = z
  .object({
    id: z.string().min(1).max(60),
    index: z.number().int().nonnegative(),
    type: z.enum(QUESTION_TYPES),
    /** Topic tag used to prevent repeated questions. Must differ per question. */
    topic: z.string().min(1).max(60),
    text: z.string().min(1).max(300),
    options: z.array(QuizOptionSchema).min(2).max(6).optional(),
    scale: ScaleSchema.optional(),
    placeholder: z.string().max(120).optional(),
  })
  .superRefine((q, ctx) => {
    if ((q.type === "single_choice" || q.type === "multi_choice") && !q.options) {
      ctx.addIssue({
        code: "custom",
        message: "choice questions require 2-6 options",
      });
    }
    if (q.type === "scale" && !q.scale) {
      ctx.addIssue({ code: "custom", message: "scale questions require a scale config" });
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

/** A user's answer to one question, discriminated by question type. */
export const AnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single_choice"),
    questionId: z.string(),
    optionId: z.string(),
  }),
  z.object({
    type: z.literal("multi_choice"),
    questionId: z.string(),
    optionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("scale"),
    questionId: z.string(),
    value: z.number().int().min(1).max(10),
  }),
  z.object({
    type: z.literal("free_text"),
    questionId: z.string(),
    text: z.string().min(1).max(500),
  }),
]);
export type Answer = z.infer<typeof AnswerSchema>;

export const QUIZ_LIMITS = {
  /** Minimum questions before generation is allowed. */
  min: 20,
  /** Hard cap — the engine must finish by this many. */
  max: 24,
} as const;

export const QuizSessionStatusSchema = z.enum([
  "active",
  "generating",
  "done",
  "failed",
]);
export type QuizSessionStatus = z.infer<typeof QuizSessionStatusSchema>;

export const QuizStateSchema = z.object({
  sessionId: z.string().uuid(),
  status: QuizSessionStatusSchema,
  questionCount: z.number().int().nonnegative(),
  minQuestions: z.number().int().positive(),
  maxQuestions: z.number().int().positive(),
});
export type QuizState = z.infer<typeof QuizStateSchema>;

// ---- API contracts -------------------------------------------------------

export const StartQuizRequestSchema = z.void();
export const StartQuizResponseSchema = z.object({
  sessionId: z.string().uuid(),
  question: QuestionSchema,
});
export type StartQuizResponse = z.infer<typeof StartQuizResponseSchema>;

export const NextQuestionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(AnswerSchema).min(1).max(QUIZ_LIMITS.max),
});
export type NextQuestionRequest = z.infer<typeof NextQuestionRequestSchema>;

/** Either the next question, or `done` once the quiz can be generated. */
export const NextQuestionResponseSchema = z.discriminatedUnion("done", [
  z.object({ done: z.literal(false), question: QuestionSchema }),
  z.object({ done: z.literal(true) }),
]);
export type NextQuestionResponse = z.infer<typeof NextQuestionResponseSchema>;
