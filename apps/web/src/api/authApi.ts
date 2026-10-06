import type { AuthResponse, MePlaylistsResponse, UserPublic } from "@curator/shared";

/**
 * Access tokens live in memory only (SPEC.md §7: the refresh token is
 * the httpOnly cookie, so a reload simply mints a fresh access token).
 * Authed calls transparently refresh-and-retry on a 401.
 */
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

async function rawPost<T>(path: string, body: unknown, auth = false): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(auth) },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

async function rawGet<T>(path: string, auth = false): Promise<T> {
  const res = await fetch(path, { headers: authHeaders(auth) });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      (json as { error?: string } | null)?.error ?? `API ${res.status}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

function authHeaders(auth: boolean): HeadersInit {
  return auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/** Tries the refresh cookie; safe to call concurrently (single flight). */
export function tryRefresh(): Promise<boolean> {
  refreshPromise ??= rawPost<AuthResponse>("/api/auth/refresh", {})
    .then((res) => {
      accessToken = res.accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function authedGet<T>(path: string): Promise<T> {
  try {
    return await rawGet<T>(path, true);
  } catch (err) {
    if ((err as { status?: number }).status !== 401) throw err;
    if (!(await tryRefresh())) throw err;
    return await rawGet<T>(path, true);
  }
}

export async function register(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthResponse> {
  const res = await rawPost<AuthResponse>("/api/auth/register", input);
  accessToken = res.accessToken;
  return res;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await rawPost<AuthResponse>("/api/auth/login", input);
  accessToken = res.accessToken;
  return res;
}

export async function loginWithGoogleCode(input: {
  code: string;
  state?: string;
}): Promise<AuthResponse> {
  const res = await rawPost<AuthResponse>("/api/auth/google", input);
  accessToken = res.accessToken;
  return res;
}

/** Full redirect to Google's consent screen (server-signed state). */
export async function redirectToGoogleConsent(): Promise<void> {
  const { url } = await rawGet<{ url: string }>("/api/auth/google/url", true);
  window.location.href = url;
}

export async function logout(): Promise<void> {
  try {
    await rawPost("/api/auth/logout", {});
  } finally {
    accessToken = null;
  }
}

export async function me(): Promise<UserPublic> {
  return authedGet<UserPublic>("/api/auth/me");
}

export function mePlaylists(): Promise<MePlaylistsResponse> {
  return authedGet<MePlaylistsResponse>("/api/me/playlists");
}
