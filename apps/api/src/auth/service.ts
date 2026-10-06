import type { PrismaClient, User } from "@prisma/client";
import type { UserPublic } from "@curator/shared";
import type { Response } from "express";
import { hashPassword, verifyPassword } from "./passwords.js";
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens.js";
import type { GoogleProfile } from "./google.js";

/** Typed error the app-level handler maps to an HTTP status. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthPrisma = PrismaClient | null;

/** Auth needs the database; degrade loudly instead of mysteriously. */
export function requireDb(prisma: AuthPrisma): PrismaClient {
  if (!prisma) {
    throw new AuthError("db_unavailable", 503);
  }
  return prisma;
}

export function toPublicUser(user: User): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

export async function registerUser(
  prisma: PrismaClient,
  input: { email: string; password: string; name?: string },
): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError("email_already_registered", 409);
  }
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(input.password),
      name: input.name ?? null,
    },
  });
}

export async function loginUser(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic message for unknown email and wrong password — no
  // account enumeration (SPEC.md §7).
  if (!user?.passwordHash) {
    throw new AuthError("invalid_credentials", 401);
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthError("invalid_credentials", 401);
  }
  return user;
}

/** Link by googleId first, then by verified email; never two accounts. */
export async function findOrCreateGoogleUser(
  prisma: PrismaClient,
  profile: GoogleProfile,
): Promise<User> {
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
  });
  if (byGoogleId) return byGoogleId;

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: profile.sub, avatarUrl: profile.picture ?? byEmail.avatarUrl },
    });
  }

  return prisma.user.create({
    data: {
      email: profile.email,
      googleId: profile.sub,
      name: profile.name,
      avatarUrl: profile.picture,
    },
  });
}

/** Issues a fresh token pair: access token in the body, refresh token
 * in an httpOnly cookie scoped to /api/auth (SPEC.md §7). */
export async function issueSession(
  res: Response,
  user: User,
): Promise<{ accessToken: string; user: UserPublic }> {
  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return { accessToken, user: toPublicUser(user) };
}

/**
 * Rotation: a valid refresh cookie earns a brand-new pair (the old
 * access token simply expires within 15 minutes). Stateful revocation
 * (jti denylist) lands with the persistence milestone.
 */
export async function rotateSession(
  cookieValue: string | undefined,
): Promise<{ userId: string }> {
  if (!cookieValue) throw new AuthError("missing_refresh_token", 401);
  try {
    const claims = await verifyRefreshToken(cookieValue);
    return { userId: claims.sub };
  } catch {
    throw new AuthError("invalid_refresh_token", 401);
  }
}

export function clearSession(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}
