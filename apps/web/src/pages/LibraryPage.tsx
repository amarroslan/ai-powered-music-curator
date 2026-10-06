import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { mePlaylists } from "../api/authApi";

/** The signed-in user's saved playlists (SPEC.md FR-8 precursor). */
export default function LibraryPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["me", "playlists", user?.id],
    queryFn: mePlaylists,
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-black">Your shelf awaits.</h1>
        <p className="mt-3 text-white/60">Sign in to see your saved playlists.</p>
        <Link
          to="/login"
          state={{ from: "/library" }}
          className="mt-8 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-4xl font-black">
        {user.name ? `${user.name}'s shelf` : "Your shelf"}
      </h1>

      {isLoading && <p className="mt-6 animate-pulse text-white/50">Digging through the crates…</p>}
      {error && (
        <p className="mt-6 text-sm font-bold text-neon-pink">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
      )}

      {data && data.playlists.length === 0 && (
        <p className="mt-6 text-white/60">
          Nothing saved yet — take the{" "}
          <Link to="/quiz" className="text-cyan-pop hover:underline">
            vibe check
          </Link>{" "}
          while signed in.
        </p>
      )}

      <ul className="mt-8 flex flex-col gap-3">
        {data?.playlists.map((p) => (
          <li
            key={p.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-5"
          >
            <p className="font-extrabold">{p.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-white/60">{p.vibeSummary}</p>
            <p className="mt-2 text-xs font-bold tracking-widest text-white/40 uppercase">
              {p.trackCount} tracks · {new Date(p.createdAt).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
