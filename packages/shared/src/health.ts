import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  db: z.enum(["available", "unavailable"]),
  /** Active quiz LLM provider, e.g. "gemini:gemini-2.5-flash" or "mock". */
  llm: z.string(),
  timestamp: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
