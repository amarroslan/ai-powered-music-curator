import type {
  NextQuestionInput,
  NextQuestionResult,
  QuizLlmProvider,
} from "./types.js";

interface MockQuestion {
  topic: string;
  text: string;
  options: Array<{ id: string; label: string; emoji: string }>;
}

const WARMUP: MockQuestion[] = [
  {
    topic: "core-genres",
    text: "Which corner of the music universe feels most like home?",
    options: [
      { id: "rock", label: "Rock & guitar things", emoji: "🎸" },
      { id: "pop", label: "Pop bops", emoji: "✨" },
      { id: "electronic", label: "Electronic / dance", emoji: "🎛️" },
      { id: "hiphop", label: "Hip-hop & R&B", emoji: "🎤" },
    ],
  },
  {
    topic: "era-home",
    text: "If you could set your personal radio dial to one era, which one?",
    options: [
      { id: "60s-70s", label: "'60s–'70s", emoji: "🌻" },
      { id: "80s-90s", label: "'80s–'90s", emoji: "📼" },
      { id: "2000s", label: "2000s", emoji: "💿" },
      { id: "now", label: "Right now", emoji: "🚀" },
    ],
  },
  {
    topic: "language",
    text: "What languages should the lyrics come in?",
    options: [
      { id: "english", label: "English only", emoji: "🇬🇧" },
      { id: "open", label: "Any language, good music is good music", emoji: "🌍" },
      { id: "mostly-instr", label: "Mostly instrumental please", emoji: "🎻" },
    ],
  },
  {
    topic: "discovery-vs-comfort",
    text: "Should this playlist be a mirror or a window?",
    options: [
      { id: "comfort", label: "Mirror — songs I already love", emoji: "🪞" },
      { id: "discovery", label: "Window — new stuff I've never heard", emoji: "🪟" },
      { id: "mix", label: "Half and half", emoji: "🔀" },
    ],
  },
  {
    topic: "listening-format",
    text: "How do you actually listen to music?",
    options: [
      { id: "albums", label: "Full albums, front to back", emoji: "💽" },
      { id: "playlists", label: "Curated playlists & singles", emoji: "📌" },
      { id: "radio", label: "Radio / autoplay, zero effort", emoji: "📻" },
    ],
  },
];

const DEEP_DIVE: MockQuestion[] = [
  {
    topic: "subgenre-pull",
    text: "Inside your favorite genre, which flavor hits hardest?",
    options: [
      { id: "raw", label: "Raw & gritty", emoji: "🪨" },
      { id: "polished", label: "Polished & produced", emoji: "💎" },
      { id: "experimental", label: "Weird & experimental", emoji: "🧪" },
      { id: "melodic", label: "Big melodies, huge hooks", emoji: "🎼" },
    ],
  },
  {
    topic: "vocal-style",
    text: "What kind of voice do you want in your ears?",
    options: [
      { id: "powerhouse", label: "Powerhouse vocals", emoji: "💪" },
      { id: "soft", label: "Soft & intimate", emoji: "🌙" },
      { id: "spoken", label: "Talk-sing / rap flow", emoji: "🗣️" },
      { id: "none", label: "Give me instruments only", emoji: "🥁" },
    ],
  },
  {
    topic: "production-era",
    text: "Which production style makes you feel at home?",
    options: [
      { id: "analog", label: "Warm analog tape", emoji: "🎚️" },
      { id: "digital", label: "Crisp digital sheen", emoji: "🪩" },
      { id: "lofi", label: "Lo-fi & dusty", emoji: "🍂" },
    ],
  },
  {
    topic: "hero-artist",
    text: "Name an artist (or band) that defines your taste.",
    options: [
      { id: "classic-rock-hero", label: "Something like Queen or Led Zeppelin", emoji: "👑" },
      { id: "pop-hero", label: "Something like Taylor Swift or Beyoncé", emoji: "🌟" },
      { id: "electronic-hero", label: "Something like Daft Punk or Aphex Twin", emoji: "🤖" },
      { id: "hiphop-hero", label: "Something like Kendrick or Tyler", emoji: "🔥" },
    ],
  },
  {
    topic: "desert-island",
    text: "Desert island pick: one song for the rest of your life.",
    options: [
      { id: "epic", label: "An epic, 8-minute journey", emoji: "🏔️" },
      { id: "groove", label: "A groove that never quits", emoji: "🕺" },
      { id: "tearjerker", label: "A beautiful tearjerker", emoji: "💧" },
      { id: "banger", label: "An absolute banger", emoji: "💥" },
    ],
  },
];

const CONTEXT: MockQuestion[] = [
  {
    topic: "listening-context",
    text: "When will you actually press play on this playlist?",
    options: [
      { id: "work", label: "While working / studying", emoji: "💻" },
      { id: "workout", label: "Working out", emoji: "🏋️" },
      { id: "commute", label: "Commuting", emoji: "🚇" },
      { id: "party", label: "Hanging out with people", emoji: "🥳" },
    ],
  },
  {
    topic: "energy-level",
    text: "On a scale, how much energy should this playlist carry?",
    options: [
      { id: "low", label: "Soft & floaty", emoji: "☁️" },
      { id: "mid", label: "Steady middle ground", emoji: "🚶" },
      { id: "high", label: "Full-send energy", emoji: "⚡" },
    ],
  },
  {
    topic: "day-time",
    text: "What time of day is this soundtrack for?",
    options: [
      { id: "morning", label: "Morning", emoji: "🌅" },
      { id: "afternoon", label: "Afternoon", emoji: "☀️" },
      { id: "night", label: "Late night", emoji: "🌃" },
    ],
  },
  {
    topic: "mood-weather",
    text: "Pick the weather that matches the mood you're chasing.",
    options: [
      { id: "sunny", label: "Sunny & clear", emoji: "🌞" },
      { id: "rain", label: "Rainy & moody", emoji: "🌧️" },
      { id: "storm", label: "Thunder & chaos", emoji: "⛈️" },
      { id: "snow", label: "Quiet snowfall", emoji: "❄️" },
    ],
  },
  {
    topic: "novelty-dose",
    text: "How weird are we allowed to get?",
    options: [
      { id: "safe", label: "Keep it familiar", emoji: "🛋️" },
      { id: "spicy", label: "A few surprises, please", emoji: "🌶️" },
      { id: "unhinged", label: "Go fully unhinged", emoji: "🌀" },
    ],
  },
];

const CURVEBALL: MockQuestion[] = [
  {
    topic: "hate-list",
    text: "What's an instant skip for you — the thing that ruins a playlist?",
    options: [
      { id: "country", label: "Country twang", emoji: "🤠" },
      { id: "screaming", label: "Screaming vocals", emoji: "😤" },
      { id: "overplayed", label: "Songs that are overplayed", emoji: "📢" },
      { id: "cheesy", label: "Cheesy lyrics", emoji: "🧀" },
    ],
  },
  {
    topic: "guilty-pleasure",
    text: "Confess one guilty pleasure you'd never admit at a party.",
    options: [
      { id: "boyband", label: "Boy bands", emoji: "🙈" },
      { id: "musicals", label: "Musical theater", emoji: "🎭" },
      { id: "eurodance", label: "Cheesy eurodance", emoji: "🪩" },
      { id: "none", label: "I have no shame, I love it all", emoji: "😎" },
    ],
  },
  {
    topic: "karaoke-song",
    text: "It's karaoke night. What are you grabbing the mic for?",
    options: [
      { id: "anthem", label: "A stadium anthem", emoji: "🏟️" },
      { id: "ballad", label: "A dramatic power ballad", emoji: "🎤" },
      { id: "rap", label: "A rapid-fire verse", emoji: "👅" },
      { id: "watching", label: "I don't sing, I judge", emoji: "👀" },
    ],
  },
  {
    topic: "nostalgia-trigger",
    text: "Which song from your past still hits hardest?",
    options: [
      { id: "childhood", label: "Something from childhood", emoji: "🧒" },
      { id: "teens", label: "My teenage anthem", emoji: "🛹" },
      { id: "recent", label: "A recent obsession", emoji: "新" },
    ],
  },
  {
    topic: "payoff-vibe",
    text: "Last one: how should the playlist END?",
    options: [
      { id: "flying", label: "On a flying, euphoric high", emoji: "🛫" },
      { id: "melt", label: "Melting into something soft", emoji: "🕯️" },
      { id: "cliffhanger", label: "A cliffhanger that begs a replay", emoji: "🎬" },
    ],
  },
];

const POOLS = [WARMUP, DEEP_DIVE, CONTEXT, CURVEBALL];

/**
 * Deterministic stand-in for the real LLM: cycles a curated pool of
 * questions, skips already-used topics, and "decides" to finish after
 * the minimum is reached. Lets the whole M2 loop run with zero API keys.
 */
export const mockProvider: QuizLlmProvider = {
  name: "mock",
  async nextQuestion(input: NextQuestionInput): Promise<NextQuestionResult> {
    const { questionCount, minQuestions, maxQuestions, history } = input;
    if (questionCount >= maxQuestions) return { done: true };

    const usedTopics = new Set(history.map((h) => h.question.topic));
    const candidates = POOLS.flat().filter((q) => !usedTopics.has(q.topic));
    if (candidates.length === 0) return { done: true };

    // Deterministic "model judgment": finish at the first opportunity
    // once the minimum is reached ((count*61) % 100 >= 50 first passes
    // at minQuestions + 1 for min=10, so the mock lands on 11 turns).
    if (questionCount >= minQuestions && (questionCount * 61) % 100 >= 50) {
      return { done: true };
    }

    const next = candidates[0]!;
    return {
      done: false,
      question: {
        id: `mock-${questionCount + 1}-${next.topic}`,
        index: questionCount,
        type: "single_choice",
        topic: next.topic,
        text: next.text,
        options: next.options,
      },
    };
  },
};
