import { motion } from "framer-motion";
import { HealthBadge } from "../components/HealthBadge";

const EQ_BARS = [0, 1, 2, 3, 4];

function Equalizer() {
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {EQ_BARS.map((i) => (
        <span
          key={i}
          className="w-2.5 origin-bottom animate-eq rounded-full bg-gradient-to-t from-electric-violet via-neon-pink to-cyan-pop"
          style={{
            height: "100%",
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${0.8 + (i % 3) * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="relative flex min-h-full flex-col overflow-hidden">
      {/* glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-[28rem] rounded-full bg-electric-violet/40 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-40 size-[30rem] rounded-full bg-neon-pink/30 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 left-1/3 size-[26rem] rounded-full bg-cyan-pop/20 blur-[130px]"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-lg font-black tracking-tight">
          music<span className="text-neon-pink">·</span>curator
        </span>
        <HealthBadge />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Equalizer />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mt-8 text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl"
        >
          Your taste,
          <br />
          <span className="bg-gradient-to-r from-neon-pink via-electric-violet to-cyan-pop bg-clip-text text-transparent">
            scored.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-6 max-w-xl text-lg text-white/70"
        >
          20+ cheeky questions. One playlist that gets you. Every track
          deep-linked to Spotify, YouTube and Apple Music — zero dead ends.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="mt-10 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-10 py-4 text-lg font-extrabold text-white shadow-[0_0_40px_rgba(255,47,179,0.45)]"
          onClick={() => (window.location.href = "/quiz")}
        >
          Start the vibe check →
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-4 text-xs font-semibold tracking-widest text-white/40 uppercase"
        >
          M1 scaffold · quiz engine lands in M2
        </motion.p>
      </section>
    </main>
  );
}
