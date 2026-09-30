import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { HealthResponseSchema } from "@curator/shared";
import { getHealth } from "../models/health.js";

export function healthRouter(prisma: PrismaClient | null, llm: string): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const health = await getHealth(prisma, llm);
    res.json(HealthResponseSchema.parse(health));
  });

  return router;
}
