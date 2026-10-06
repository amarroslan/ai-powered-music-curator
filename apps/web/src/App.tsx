import { Link, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LandingPage from "./pages/LandingPage";
import QuizPage from "./pages/QuizPage";
import GeneratingPage from "./pages/GeneratingPage";
import PlaylistPage from "./pages/PlaylistPage";
import LoginPage from "./pages/LoginPage";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import LibraryPage from "./pages/LibraryPage";

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-4 sm:px-10">
      <Link to="/" className="text-lg font-black tracking-tight">
        vibe<span className="text-neon-pink">check</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm font-bold">
        {user && (
          <Link to="/library" className="text-white/60 hover:text-white">
            Library
          </Link>
        )}
        {user ? (
          <button
            onClick={() => void logout()}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 hover:bg-white/10"
          >
            {user.name ?? user.email} · Sign out
          </button>
        ) : (
          <Link
            to="/login"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 hover:bg-white/10"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/generating" element={<GeneratingPage />} />
        <Route path="/playlist" element={<PlaylistPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      </Routes>
    </AuthProvider>
  );
}
