import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { config } from "./config.js";

async function main(): Promise<void> {
  let prisma: PrismaClient | null = null;
  try {
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log("[api] database connected");
  } catch (err) {
    console.warn(
      "[api] database unavailable, continuing without it:",
      err instanceof Error ? err.message : err,
    );
    prisma = null;
  }

  const app = createApp(prisma);
  app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });
}

void main();
