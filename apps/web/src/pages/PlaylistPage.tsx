import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { PLATFORM_LABELS } from "@curator/shared";
import type { Playlist, Platform, Track } from "@curator/shared";
import { useAuth } from "../auth/AuthContext";

const PLATFORM_EMOJI: Record<Platform, string> = {
  spotify: "🎧",
  youtube: "▶️",
  apple_music: "🍎",
};

function TrackCard({ track, index }: { track: Track; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.3 }}
      className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
    >
      <span className="w-6 text-center text-sm font-black text-white/40">
        {index + 1}
      </span>
      {track.coverUrl ? (
        <img
          src={track.coverUrl}
          alt=""
          loading="lazy"
          className="size-14 rounded-xl object-cover"
        />
      ) : (
        <div className="flex size-14 items-center justify-center rounded-xl bg-white/10 text-xl" aria-hidden>
          🎵
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{track.title}</p>
        <p className="truncate text-sm text-white/60">
          {track.artist}
          {track.year ? ` · ${track.year}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {(Object.keys(PLATFORM_EMOJI) as Platform[]).map((p) => (
          <a
            key={p}
            href={track.links[p] ?? undefined}
            target="_blank"
            rel="noreferrer"
            title={`Open on ${PLATFORM_LABELS[p]}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-bold transition hover:scale-105 hover:border-white/30"
          >
            {PLATFORM_EMOJI[p]}
          </a>
        ))}
      </div>
    </motion.li>
  );
}

export default function PlaylistPage() {
  const location = useLocation();
  const { user } = useAuth();
  const playlist = (location.state as { playlist?: Playlist } | null)?.playlist;

  if (!playlist) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-black">Nothing on the turntable.</h1>
        <p className="mt-3 text-white/60">Take the quiz to cook one up.</p>
        <Link
          to="/quiz"
          className="mt-8 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
        >
          Start the vibe check
        </Link>
      </main>
    );
  }

  const exact = playlist.tracks.filter((t) => t.matchStatus === "exact").length;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-xs font-bold tracking-widest text-white/40 uppercase">
        Your playlist · {playlist.tracks.length} tracks · {exact} verified exact
      </p>
      <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
        {playlist.title}
      </h1>
      <p className="mt-4 text-white/70">{playlist.vibeSummary}</p>

      {user ? (
        <p className="mt-6 rounded-2xl border border-cyan-pop/30 bg-cyan-pop/10 px-5 py-3 text-sm font-bold text-cyan-pop">
          ✓ Saved to your library
        </p>
      ) : (
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70">
          Like it?{" "}
          <Link to="/login" state={{ from: "/playlist" }} className="text-cyan-pop hover:underline">
            Sign in
          </Link>{" "}
          and your next generation saves itself.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-3">
        {playlist.tracks.map((t, i) => (
          <TrackCard key={t.id} track={t} index={i} />
        ))}
      </ul>

      <Link
        to="/quiz"
        className="mt-10 inline-block rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
      >
        Cook another one
      </Link>
    </main>
  );
}
