import type { HealthResponse } from "@curator/shared";
import type { PrismaClient } from "@prisma/client";

/**
 * M1 note: the DB is optional — the API boots and reports health even
 * when Postgres is unreachable, so development never blocks on Docker.
 */
export async function getHealth(
  prisma: PrismaClient | null,
  llm: string,
): Promise<HealthResponse> {
  let db: HealthResponse["db"] = "unavailable";
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "available";
    } catch {
      db = "unavailable";
    }
  }

  return {
    status: "ok",
    service: "music-curator-api",
    db,
    llm,
    timestamp: new Date().toISOString(),
  };
}
