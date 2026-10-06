import { z } from "zod";
import {
  CandidateTrackSchema,
  type CandidateTrack,
  PLAYLIST_CANDIDATE_COUNT,
} from "@curator/shared";
import { LlmError } from "../llm/types.js";
import { callGemini } from "./geminiClient.js";
import { config } from "../config.js";

const CandidatesSchema = z.object({
  title: z.string().min(1).max(120),
  vibeSummary: z.string().min(1).max(500),
  tracks: z.array(CandidateTrackSchema).min(15).max(40),
});

const SYSTEM_PROMPT = `You are a world-class music curator. Given a person's quiz answers, design a playlist they will love.

Output ONLY JSON: {"title", "vibeSummary", "tracks"}.
- title: max 60 chars, evocative, specific to THEIR answers — never generic.
- vibeSummary: 2-3 sentences explaining the journey this playlist takes them on, in their language.
- tracks: exactly ${PLAYLIST_CANDIDATE_COUNT} candidates. Mix eras, moods and discovery level to match what they asked for. Respect their dealbreakers absolutely.
- Every track must be REAL and findable: well-known catalog entries, correct artist, plausible year. Include 1-line reason tying it to their answers.
- Confidence: 0.9+ for catalog staples you are certain exist, lower for deep cuts.
- Order: a journey — strong opener, escalating middle, the ending they asked for.`;

const RESULT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    vibeSummary: { type: "string" },
    tracks: {
      type: "array",
      minItems: 15,
      maxItems: 40,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          artist: { type: "string" },
          year: { type: ["integer", "null"], description: "release year, null if unsure" },
          reason: { type: "string", description: "one line, ties the track to their answers" },
          confidence: { type: "number", description: "0-1 certainty the track exists in catalogs" },
        },
        required: ["title", "artist", "reason", "confidence"],
      },
    },
  },
  required: ["title", "vibeSummary", "tracks"],
} as const;

function profileSummary(history: Array<{ question: { topic: string }; answer: unknown }>): string {
  return history
    .map((h, i) => {
      const a = h.answer as { type?: string; optionId?: string; optionIds?: string[]; value?: number; text?: string };
      const rendered =
        a.type === "single_choice"
          ? a.optionId
          : a.type === "multi_choice"
            ? (a.optionIds ?? []).join(", ")
            : a.type === "scale"
              ? `${a.value}/10`
              : a.text;
      return `${i + 1}. [${h.question.topic}] ${rendered}`;
    })
    .join("\n");
}

export interface CuratorBlueprint {
  title: string;
  vibeSummary: string;
  candidates: CandidateTrack[];
}

/** Asks the LLM for the playlist blueprint (title, vibe, candidates). */
export async function generateCandidates(
  history: Array<{ question: { topic: string }; answer: unknown }>,
): Promise<CuratorBlueprint> {
  const prompt = [
    "Here is the person's full quiz transcript (topic → their answer):",
    "",
    profileSummary(history),
    "",
    "Design their playlist now.",
  ].join("\n");

  const text = await callGemini(prompt, {
    system: SYSTEM_PROMPT,
    jsonSchema: RESULT_JSON_SCHEMA,
    temperature: 1.0,
    maxOutputTokens: 4096,
    timeoutMs: config.llmTimeoutMs,
  });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LlmError(`candidate generator returned invalid JSON: ${text.slice(0, 200)}`);
  }

  const parsed = CandidatesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LlmError(`candidate blueprint failed schema: ${parsed.error.message.slice(0, 300)}`);
  }

  return {
    title: parsed.data.title,
    vibeSummary: parsed.data.vibeSummary,
    candidates: parsed.data.tracks,
  };
}
