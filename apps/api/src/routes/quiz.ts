import { Router } from "express";
import {
  NextQuestionRequestSchema,
  NextQuestionResponseSchema,
} from "@curator/shared";
import type { NextQuestionResponse } from "@curator/shared";
import type { QuizEngine } from "../quiz/engine.js";
import { simpleRateLimit } from "../middleware/rateLimit.js";

/** Per-IP quiz quota (SPEC.md FR-11): generous for humans, hostile to bots. */
const quizLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

/**
 * Stateless quiz endpoint: the client sends its full answer history
 * and receives the next question — or `done` when the quiz completes.
 */
export function quizRouter(engine: QuizEngine): Router {
  const router = Router();

  router.post("/quiz/next", quizLimiter, async (req, res, next) => {
    try {
      const { history } = NextQuestionRequestSchema.parse(req.body);
      const outcome = await engine.next(history);
      const body: NextQuestionResponse = outcome.result;
      res.json(NextQuestionResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
