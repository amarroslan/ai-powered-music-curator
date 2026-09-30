import type { NextQuestionInput } from "../llm/types.js";

/**
 * Server-side system prompt: defines the quiz arc, topic uniqueness
 * rule, voice, and the JSON contract (SPEC.md §5).
 */
export const SYSTEM_PROMPT = `You are the host of "the vibe check": a playful music-taste quiz that ends in a personalized playlist.

Your job: each turn, output the NEXT single question as JSON — or {"done": true} when the quiz is complete.

Rules:
- The quiz must run 20-24 questions. Never return done before 20 questions have been asked.
- Ask ONE question at a time. Never repeat or trivially rephrase an earlier question: the topic tag must be new every time.
- Follow this arc across the quiz: (1) warmup — genres, eras, languages, habits; (2) deep dive — subgenres, vocal styles, production, hero artists; (3) context — when/where they'll listen, energy, mood, setting; (4) curveballs — dealbreakers, guilty pleasures, karaoke, nostalgia; (5) wrap-up — how the playlist should start and end.
- Use their answers: reference, contrast, and build on what they told you. Make them feel heard.
- Vary the question types: mostly single_choice, some multi_choice, 2-3 scale (1-10) questions, 1-2 free_text (e.g. "describe a song you love in your own words").
- Voice: playful, punchy, a little cheeky. Max 300 characters per question. Option labels max ~60 characters, 2-6 options, ids are short kebab-case. Add an emoji to each option.
- Output ONLY JSON, no markdown, no commentary.`;

export const QUESTION_JSON_DESCRIPTION = {
  type: "object",
  properties: {
    done: {
      type: "boolean",
      description:
        "true ONLY when at least 20 questions have been asked and the profile feels complete. Then output just {\"done\": true}.",
    },
    id: { type: "string", description: "short kebab-case unique id, e.g. 'era-split'" },
    type: {
      type: "string",
      enum: ["single_choice", "multi_choice", "scale", "free_text"],
    },
    topic: {
      type: "string",
      description: "unique one-or-two-word topic tag; must differ from every previous topic",
    },
    text: { type: "string", description: "the question itself, playful host voice, max 300 chars" },
    options: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      description: "required for single_choice and multi_choice",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "short kebab-case option id" },
          label: { type: "string", maxLength: 120 },
          emoji: { type: "string", description: "single emoji" },
        },
        required: ["id", "label"],
      },
    },
    scale: {
      type: "object",
      description: "required for scale questions",
      properties: {
        min: { type: "integer", enum: [1] },
        max: { type: "integer", enum: [10] },
        minLabel: { type: "string" },
        maxLabel: { type: "string" },
      },
      required: ["min", "max", "minLabel", "maxLabel"],
    },
    placeholder: { type: "string", description: "input hint for free_text questions" },
  },
  required: ["id", "type", "topic", "text"],
} as const;

export function userPrompt(input: NextQuestionInput): string {
  const { history, questionCount, minQuestions, maxQuestions } = input;

  if (history.length === 0) {
    return [
      `Start a new quiz. Ask question 1 of ${minQuestions}-${maxQuestions}.`,
      "Open with a fun warmup about the person's music taste.",
    ].join("\n");
  }

  const transcript = history
    .map(
      (h, i) =>
        `${i + 1}. [${h.question.topic}] ${h.question.text} → ${describeAnswer(h.answer)}`,
    )
    .join("\n");

  return [
    `Asked so far: ${questionCount} (minimum ${minQuestions}, hard cap ${maxQuestions}).`,
    "",
    transcript,
    "",
    `Topics already covered (never reuse): ${history.map((h) => h.question.topic).join(", ")}`,
    questionCount >= minQuestions
      ? "The quiz MAY end now — return {\"done\": true} only if the profile is rich enough to build a great playlist."
      : `Keep going: at least ${minQuestions} questions are required before you may finish.`,
    "Return the JSON for the NEXT question now.",
  ].join("\n");
}

function describeAnswer(answer: NextQuestionInput["history"][number]["answer"]): string {
  switch (answer.type) {
    case "single_choice":
      return answer.optionId;
    case "multi_choice":
      return answer.optionIds.join(", ");
    case "scale":
      return `${answer.value}/10`;
    case "free_text":
      return `"${answer.text}"`;
  }
}
