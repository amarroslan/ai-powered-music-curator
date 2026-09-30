/**
 * End-to-end quiz smoke test (stateless contract).
 * Drives /api/quiz/next with a growing client-side history until done.
 *
 * Usage: SMOKE_DELAY_MS=6500 node scripts/smoke-quiz.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:4000";
/** Spacing between LLM-backed calls, e.g. 6500 for free-tier RPM limits. */
const DELAY = Number(process.env.SMOKE_DELAY_MS ?? 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
console.log(`health: llm=${health.llm}`);

// First question is served locally by the same seed logic the client
// uses; but the stateless API must also accept an empty history to
// produce one. We use the server for q1 to prove the cold path works.
let history = [];
let count = 0;
let done = false;
let pending = null;

for (let i = 0; i < 40; i++) {
  if (DELAY > 0 && count > 0) await sleep(DELAY);
  const res = await post("/api/quiz/next", { history });
  if (res.done) {
    done = true;
    break;
  }
  pending = res.question;
  count += 1;
  console.log(`q${count} [${pending.topic}] ${pending.text}`);
  history = [...history, { question: pending, answer: answerFor(pending) }];
}

if (!done) throw new Error(`quiz never finished (asked ${count})`);
if (count < 20) throw new Error(`finished too early at ${count} questions`);

console.log(`SMOKE OK: ${count} questions through the stateless API`);
