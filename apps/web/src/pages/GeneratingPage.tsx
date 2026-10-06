import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { QuizHistoryEntry } from "@curator/shared";
import { generatePlaylist } from "../api/playlistApi";

const STEPS = [
  "Interviewing your answers…",
  "Bribing the music gods…",
  "Validating every single track…",
  "Untangling deep links…",
];

const EQ_BARS = [0, 1, 2, 3, 4, 5, 6];

export default function GeneratingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const history =
      (location.state as { history?: QuizHistoryEntry[] } | null)?.history ?? [];

    generatePlaylist({ history })
      .then((playlist) => {
        navigate("/playlist", { state: { playlist }, replace: true });
      })
      .catch(() => setFailed(true));
  }, [location.state, navigate]);

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 items-end gap-2" aria-hidden>
        {EQ_BARS.map((i) => (
          <span
            key={i}
            className="w-3 origin-bottom animate-eq rounded-full bg-gradient-to-t from-electric-violet via-neon-pink to-cyan-pop"
            style={{
              height: "100%",
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.7 + (i % 4) * 0.2}s`,
            }}
          />
        ))}
      </div>

      {failed ? (
        <>
          <h1 className="mt-10 text-4xl font-black text-neon-pink">
            The jukebox jammed.
          </h1>
          <p className="mt-3 text-white/70">
            The curation pipeline hit a sour note. Run it back?
          </p>
          <button
            onClick={() => (window.location.href = "/quiz")}
            className="mt-8 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
          >
            Take the quiz again
          </button>
        </>
      ) : (
        <>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 text-4xl font-black sm:text-5xl"
          >
            Cooking your{" "}
            <span className="bg-gradient-to-r from-neon-pink to-cyan-pop bg-clip-text text-transparent">
              playlist
            </span>
          </motion.h1>
          <ul className="mt-8 space-y-2 text-white/60">
            {STEPS.map((s, i) => (
              <motion.li
                key={s}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.35] }}
                transition={{ delay: i * 1.4, duration: 2.4, repeat: Infinity, repeatDelay: 2 }}
                className="text-sm font-bold"
              >
                {s}
              </motion.li>
            ))}
          </ul>
          <p className="mt-10 text-xs font-semibold tracking-widest text-white/40 uppercase">
            Real songs only — every track is being verified
          </p>
        </>
      )}
    </main>
  );
}
