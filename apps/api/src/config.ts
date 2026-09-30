import "dotenv/config";

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
