import { SignJWT, jwtVerify, decodeJwt } from "jose";
import { config } from "../config.js";

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/** Google OAuth is optional at runtime: unconfigured → clean 503s. */
export function googleConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * CSRF protection for the consent redirect: the `state` we hand to
 * Google is a short-lived JWT we can verify on the way back.
 */
const STATE_AUD = "oauth-state";

export async function googleAuthUrl(): Promise<string> {
  const state = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(STATE_AUD)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(config.authJwtSecret));

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

export async function verifyGoogleState(state: string): Promise<void> {
  try {
    await jwtVerify(state, new TextEncoder().encode(config.authJwtSecret), {
      audience: STATE_AUD,
    });
  } catch {
    throw new GoogleAuthError("invalid_oauth_state", 400);
  }
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Exchanges the authorization code server-side so the client secret
 * never touches the browser, then decodes the id_token for the profile.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GoogleAuthError(
      `google token exchange failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new GoogleAuthError("google response missing id_token");

  const claims = decodeJwt<{
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>(idToken);

  if (!claims.sub || !claims.email || claims.email_verified === false) {
    throw new GoogleAuthError("google profile missing required claims", 400);
  }

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    name: claims.name ?? null,
    picture: claims.picture ?? null,
  };
}
