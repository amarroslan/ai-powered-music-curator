import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import type { PrismaClient } from "@prisma/client";
import { healthRouter } from "./routes/health.js";
import { quizRouter } from "./routes/quiz.js";
import { createQuizEngine, QuizEngineError } from "./quiz/engine.js";
import { createMemoryQuizStore } from "./quiz/store.js";
import { getQuizLlmProvider } from "./llm/index.js";
import { LlmError } from "./llm/types.js";
import { config } from "./config.js";

export function createApp(prisma: PrismaClient | null = null): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "256kb" }));

  const engine = createQuizEngine(createMemoryQuizStore(), getQuizLlmProvider());

  app.use("/api", healthRouter(prisma, engine.providerName));
  app.use("/api", quizRouter(engine));

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "validation_error", issues: err.issues });
      return;
    }
    if (err instanceof QuizEngineError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof LlmError) {
      console.error("[api] llm error:", err.message);
      res.status(503).json({ error: "llm_unavailable" });
      return;
    }
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
