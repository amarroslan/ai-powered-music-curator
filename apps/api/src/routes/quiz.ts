import { Router } from "express";
import {
  AnswerSchema,
  GeneratePlaylistRequestSchema,
  NextQuestionRequestSchema,
  NextQuestionResponseSchema,
  QuizStateSchema,
  StartQuizResponseSchema,
} from "@curator/shared";
import type { NextQuestionResponse, StartQuizResponse } from "@curator/shared";
import type { QuizEngine } from "../quiz/engine.js";
import { QuizEngineError } from "../quiz/engine.js";
import { simpleRateLimit } from "../middleware/rateLimit.js";

/** Per-IP quiz quota (SPEC.md FR-11): generous for humans, hostile to bots. */
const quizLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

export function quizRouter(engine: QuizEngine): Router {
  const router = Router();

  router.post("/quiz/start", quizLimiter, async (_req, res, next) => {
    try {
      const { sessionId, question } = await engine.start();
      const body: StartQuizResponse = { sessionId, question };
      res.status(201).json(StartQuizResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  router.post("/quiz/next", quizLimiter, async (req, res, next) => {
    try {
      const parsed = NextQuestionRequestSchema.parse(req.body);
      if (parsed.answers.length !== 1) {
        throw new QuizEngineError("exactly_one_answer_required", 422);
      }
      const outcome = await engine.submitAnswer(parsed.sessionId, parsed.answers[0]!);
      const body: NextQuestionResponse = outcome.result;
      res.json(NextQuestionResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  router.get("/quiz/:id", async (req, res, next) => {
    try {
      const state = await engine.getState(req.params.id ?? "");
      res.json(QuizStateSchema.parse(state));
    } catch (err) {
      next(err);
    }
  });

  /**
   * M2 stub: flips the session to "generating" so the client flow is
   * complete end-to-end. M3 replaces the response with the real
   * playlist pipeline (LLM candidates → validation → deep links).
   */
  router.post("/quiz/generate", quizLimiter, async (req, res, next) => {
    try {
      const { sessionId } = GeneratePlaylistRequestSchema.parse(req.body);
      await engine.beginGeneration(sessionId);
      res.status(202).json({ sessionId, status: "generating" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
