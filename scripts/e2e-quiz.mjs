/**
 * E2E smoke test (run with both dev servers up):
 *   node scripts/e2e-quiz.mjs [baseUrl]
 *
 * Drives the quiz through the same-origin /api path (vite proxy),
 * starting from the UI's locally-seeded first question, answering
 * every question type like a user would, then generating a playlist.
 */
const BASE = process.argv[2] ?? "http://localhost:5173";
const LOG = (msg) => process.stdout.write(`${msg}\n`);

// Mirrors SEED_QUESTION in apps/web/src/pages/QuizPage.tsx — the UI
// serves question 1 locally with zero network wait.
const SEED_QUESTION = {
  id: "seed-core-genres",
  index: 0,
  type: "single_choice",
  topic: "core-genres",
  text: "First one's on the house: which corner of the music universe feels most like home?",
  options: [
    { id: "rock", label: "Rock & guitar things", emoji: "🎸" },
    { id: "pop", label: "Pop bops", emoji: "✨" },
    { id: "electronic", label: "Electronic / dance", emoji: "🎛️" },
    { id: "hiphop", label: "Hip-hop & R&B", emoji: "🎤" },
  ],
};

const FREE_TEXT_ANSWERS = [
  "that song about driving at 3am with the windows down",
  "anything with a bassline you can feel in your ribs",
  "the kind of chorus that shows up in your head uninvited",
];

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`);
  }
  return json;
}

/** Answers like a user: first option(s), 7/10 energy, chatty free text. */
function answerFor(question, turn) {
  const base = { questionId: question.id };
  switch (question.type) {
    case "single_choice":
      return { type: "single_choice", ...base, optionId: question.options[0].id };
    case "multi_choice":
      return {
        type: "multi_choice",
        ...base,
        optionIds: question.options.slice(0, 2).map((o) => o.id),
      };
    case "scale":
      return { type: "scale", ...base, value: 7 };
    case "free_text":
      return {
        type: "free_text",
        ...base,
        text: FREE_TEXT_ANSWERS[turn % FREE_TEXT_ANSWERS.length],
      };
    default:
      throw new Error(`unknown question type: ${question.type}`);
  }
}

function describe(q) {
  const kind = q.type.replace("_", " ");
  const opts = q.options ? ` [${q.options.map((o) => o.emoji ?? "").join("")}]` : "";
  return `Q  (${kind}) ${q.text}${opts}`;
}

async function main() {
  const history = [];
  let question = SEED_QUESTION;
  let turn = 0;
  let done = false;

  LOG(`— Quiz start (${BASE}) —`);
  while (!done) {
    turn += 1;
    LOG(`Q${turn}: ${describe(question)}`);
    history.push({ question, answer: answerFor(question, turn) });

    const res = await post("/api/quiz/next", { history });
    if (res.done) {
      done = true;
      LOG(`→ done after ${turn} answers ✅`);
      break;
    }
    if (turn > 20) throw new Error("quiz exceeded 20 turns — guardrails failed");
    question = res.question;
  }

  const min = 10;
  const max = 12;
  if (turn < min || turn > max) {
    throw new Error(`quiz ended at ${turn} questions — expected ${min}-${max}`);
  }
  LOG(`— length OK: ${turn} questions (${min}-${max} allowed) —`);

  LOG("\n— Generating playlist (LLM + catalog validation)… —");
  const t0 = Date.now();
  const playlist = await post("/api/playlists/generate", { history });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const exact = playlist.tracks.filter((t) => t.matchStatus === "exact").length;
  const fallback = playlist.tracks.length - exact;
  const linked = playlist.tracks.filter(
    (t) => t.links.spotify && t.links.youtube && t.links.apple_music,
  ).length;

  LOG(`\n"${playlist.title}" (${secs}s)`);
  LOG(`vibe: ${playlist.vibeSummary}`);
  LOG(`tracks: ${playlist.tracks.length} (exact: ${exact}, fallback: ${fallback}, fully linked: ${linked})`);
  LOG("\nfirst 5 tracks:");
  for (const t of playlist.tracks.slice(0, 5)) {
    LOG(`  ${t.matchStatus === "exact" ? "✅" : "🔗"} ${t.title} — ${t.artist} | 🎧${t.links.spotify ? "yes" : "NO"} ▶️${t.links.youtube ? "yes" : "NO"} 🍎${t.links.apple_music ? "yes" : "NO"}`);
  }

  if (playlist.tracks.length === 0) throw new Error("playlist came back empty");
  LOG("\nE2E PASS 🎉");
}

main().catch((err) => {
  LOG(`\nE2E FAIL: ${err.message}`);
  process.exit(1);
});
