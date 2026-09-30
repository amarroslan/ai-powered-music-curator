import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

// Both layouts (src/config.ts and dist/config.js) sit one directory
// below the package root, so ../.env is apps/api/.env for either.
// Second candidate: repo-root .env, if the user prefers one there.
for (const rel of ["../.env", "../../../.env"]) {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  if (existsSync(path)) {
    dotenvConfig({ path });
    break;
  }
}

function env(name: string): string | undefined {
  return process.env[name];
}

export const config = {
  port: Number(env("PORT") ?? 4000),
  databaseUrl: env("DATABASE_URL") ?? "",
  corsOrigin: env("CORS_ORIGIN") ?? "http://localhost:5173",
  nodeEnv: env("NODE_ENV") ?? "development",
  geminiApiKey: env("GEMINI_API_KEY") ?? "",
  llmTimeoutMs: Number(env("LLM_TIMEOUT_MS") ?? 20_000),
};
