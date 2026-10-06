import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { user, login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from ?? "/playlist";

  if (user) {
    return <Navigate to={from} replace />;
  }

  const friendly = (msg: string) => {
    if (msg === "invalid_credentials") return "That email/password combo doesn't ring a bell.";
    if (msg === "email_already_registered") return "That email already has an account — try signing in.";
    if (msg === "google_not_configured") return "Google sign-in isn't set up on this server yet.";
    if (msg === "db_unavailable") return "The database is napping — try again shortly.";
    return msg;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name || undefined);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-full flex-col items-center justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/3 size-[26rem] rounded-full bg-electric-violet/30 blur-[120px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="text-2xl font-black tracking-tight">
          vibe<span className="text-neon-pink">check</span>
        </Link>

        <h1 className="mt-8 text-4xl font-black leading-tight">
          {mode === "login" ? (
            <>
              Welcome back to the{" "}
              <span className="bg-gradient-to-r from-neon-pink to-cyan-pop bg-clip-text text-transparent">
                record shop
              </span>
            </>
          ) : (
            <>
              Grab your{" "}
              <span className="bg-gradient-to-r from-neon-pink to-cyan-pop bg-clip-text text-transparent">
                listener pass
              </span>
            </>
          )}
        </h1>
        <p className="mt-3 text-white/60">
          Save every playlist you cook up and revisit them anytime.
        </p>

        <button
          onClick={() => void loginWithGoogle()}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-6 py-3 font-extrabold transition hover:bg-white/10"
        >
          <span aria-hidden>🇬</span> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-4 text-xs font-bold tracking-widest text-white/30 uppercase">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === "register" && (
            <input
              type="text"
              placeholder="What should we call you?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold outline-none placeholder:text-white/30 focus:border-neon-pink/60"
            />
          )}
          <input
            type="email"
            required
            placeholder="you@vibes.fm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold outline-none placeholder:text-white/30 focus:border-neon-pink/60"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold outline-none placeholder:text-white/30 focus:border-neon-pink/60"
          />

          {error && (
            <p className="text-sm font-bold text-neon-pink" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold disabled:opacity-50"
          >
            {busy ? "Spinning up…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-white/50">
          {mode === "login" ? "New here?" : "Already have a pass?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="font-bold text-cyan-pop hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </main>
  );
}
