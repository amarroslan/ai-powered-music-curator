/**
 * End-to-end quiz smoke test (M2).
 * Drives the full loop against a running API: start → answer until
 * done → generate. Answering strategy: always pick the first option.
 *
 * Usage: node scripts/smoke-quiz.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:4000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function answerFor(question) {
  const questionId = question.id;
  if (question.type === "single_choice") {
    return { type: "single_choice", questionId, optionId: question.options[0].id };
  }
  if (question.type === "multi_choice") {
    return { type: "multi_choice", questionId, optionIds: [question.options[0].id] };
  }
  if (question.type === "scale") {
    return { type: "scale", questionId, value: 7 };
  }
  return { type: "free_text", questionId, text: "whatever " + questionId };
}

const start = await post("/api/quiz/start", {});
console.log(`started session ${start.sessionId}`);
console.log(`q1 [${start.question.topic}] ${start.question.text}`);

const sessionId = start.sessionId;
let count = 1;
let done = false;

// The API is one-answer-per-request: answer the pending question, get the next.
let pending = start.question;
for (let i = 0; i < 40; i++) {
  const res = await post("/api/quiz/next", {
    sessionId,
    answers: [answerFor(pending)],
  });
  if (res.done) {
    done = true;
    break;
  }
  pending = res.question;
  count += 1;
  console.log(`q${count} [${pending.topic}] ${pending.text}`);
}

if (!done) throw new Error(`quiz never finished (asked ${count})`);
if (count < 20) throw new Error(`finished too early at ${count} questions`);

const gen = await post("/api/quiz/generate", { sessionId });
console.log(`generate → ${JSON.stringify(gen)}`);
console.log(`SMOKE OK: ${count} questions, quiz complete, generation accepted`);
