import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config.js";

/**
 * Token issuance (SPEC.md §7): short-lived JWT access token + rotating
 * refresh token delivered as an httpOnly cookie. HS256 with the single
 * server secret; access and refresh are separated by the `aud` claim so
 * one can never be replayed as the other.
 */
const secretKey = new TextEncoder().encode(config.authJwtSecret);

export const REFRESH_COOKIE = "curator_rt";

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  aud: "access";
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;
  aud: "refresh";
  jti: string;
}

async function sign(userId: string, aud: "access" | "refresh", ttlSec: number, jti?: string) {
  return new SignJWT(jti ? { jti } : {})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(secretKey);
}

export function signAccessToken(userId: string): Promise<string> {
  return sign(userId, "access", config.accessTokenTtlSec);
}

/** jti gives refresh tokens a unique identity for future revocation. */
export function signRefreshToken(userId: string): Promise<string> {
  return sign(userId, "refresh", config.refreshTokenTtlSec, randomUUID());
}

async function verify<T extends JWTPayload>(token: string, aud: "access" | "refresh"): Promise<T> {
  const { payload } = await jwtVerify(token, secretKey, { audience: aud });
  return payload as T;
}

export function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  return verify<AccessTokenClaims>(token, "access");
}

export function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  return verify<RefreshTokenClaims>(token, "refresh");
}

/** httpOnly cookie settings for the refresh token (SPEC.md §7). */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: config.refreshTokenTtlSec * 1000,
  };
}
