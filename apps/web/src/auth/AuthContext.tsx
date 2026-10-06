import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserPublic } from "@curator/shared";
import * as authApi from "../api/authApi";

interface AuthState {
  /** null = signed out; undefined = still bootstrapping the session. */
  user: UserPublic | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  completeGoogleLogin: (code: string, state?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null | undefined>(undefined);

  // Bootstrap: mint an access token from the refresh cookie (single
  // flight inside authApi, so StrictMode's double-mount is safe).
  useEffect(() => {
    let cancelled = false;
    authApi.tryRefresh().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setUser(null);
        return;
      }
      authApi
        .me()
        .then((u) => !cancelled && setUser(u))
        .catch(() => !cancelled && setUser(null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await authApi.register({ email, password, name });
      setUser(res.user);
    },
    [],
  );

  const loginWithGoogle = useCallback(async () => {
    await authApi.redirectToGoogleConsent();
  }, []);

  const completeGoogleLogin = useCallback(
    async (code: string, state?: string) => {
      const res = await authApi.loginWithGoogleCode({ code, state });
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, register, loginWithGoogle, completeGoogleLogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
