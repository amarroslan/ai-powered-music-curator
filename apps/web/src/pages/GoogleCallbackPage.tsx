import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Google redirects here with ?code&state. We hand both to the API
 * (state verified server-side) and continue to where the user was
 * headed — usually the playlist they just generated.
 */
export default function GoogleCallbackPage() {
  const { completeGoogleLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const state = params.get("state") ?? undefined;
    if (!code) {
      setError("Google didn't send a code back — the redirect went sideways.");
      return;
    }

    completeGoogleLogin(code, state)
      .then(() => navigate("/", { replace: true }))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Sign-in failed"),
      );
  }, [params, completeGoogleLogin, navigate]);

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      {error ? (
        <>
          <h1 className="text-3xl font-black text-neon-pink">Jammed again.</h1>
          <p className="mt-3 text-white/70">{error}</p>
          <Link
            to="/login"
            className="mt-8 rounded-full bg-gradient-to-r from-neon-pink to-electric-violet px-8 py-3 font-extrabold"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="animate-pulse text-lg font-bold text-white/70">
          Talking to Google…
        </p>
      )}
    </main>
  );
}
