import express from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { healthRouter } from "./routes/health.js";
import { config } from "./config.js";

export function createApp(prisma: PrismaClient | null = null): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "256kb" }));

  app.use("/api", healthRouter(prisma));

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
