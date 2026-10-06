import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";

// Local dev: load .env relative to the package root, whichever layout
// we run from (src/config.ts and dist/config.js both sit one level
// below it). Bundled/serverless builds (Vercel) can't resolve
// import.meta.url — there env comes from the platform, so we skip
// file loading entirely instead of crashing at import time.
function loadDotenv(): void {
  for (const rel of ["../.env", "../../../.env"]) {
    try {
      const path = fileURLToPath(new URL(rel, import.meta.url));
      if (existsSync(path)) {
        dotenvConfig({ path });
        return;
      }
    } catch {
      return;
    }
  }
}
loadDotenv();

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

  // Auth (SPEC.md §7): JWT access (15 min) + rotating refresh (30 d).
  // Missing secret in dev → per-process random so stale tokens die on
  // restart; in production this MUST be set explicitly.
  authJwtSecret:
    env("AUTH_JWT_SECRET") ??
    (env("NODE_ENV") === "production"
      ? ""
      : randomBytes(32).toString("hex")),
  accessTokenTtlSec: Number(env("ACCESS_TOKEN_TTL_SEC") ?? 15 * 60),
  refreshTokenTtlSec: Number(env("REFRESH_TOKEN_TTL_SEC") ?? 30 * 24 * 60 * 60),
  bcryptRounds: Number(env("BCRYPT_ROUNDS") ?? 12),

  // Google OAuth 2.0 authorization-code flow (SPEC.md §7).
  googleClientId: env("GOOGLE_CLIENT_ID") ?? "",
  googleClientSecret: env("GOOGLE_CLIENT_SECRET") ?? "",
  googleRedirectUri:
    env("GOOGLE_REDIRECT_URI") ?? "http://localhost:5173/auth/google/callback",
};
