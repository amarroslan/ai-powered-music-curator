import { Router } from "express";
import {
  AuthResponseSchema,
  GoogleAuthUrlResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
  UserPublicSchema,
  GoogleAuthRequestSchema,
} from "@curator/shared";
import type { UserPublic } from "@curator/shared";
import type { PrismaClient } from "@prisma/client";
import { REFRESH_COOKIE } from "../auth/tokens.js";
import {
  AuthError,
  clearSession,
  findOrCreateGoogleUser,
  issueSession,
  loginUser,
  registerUser,
  requireDb,
  rotateSession,
} from "../auth/service.js";
import {
  exchangeGoogleCode,
  googleAuthUrl,
  googleConfigured,
  verifyGoogleState,
} from "../auth/google.js";
import { requireAuth } from "../middleware/auth.js";
import { simpleRateLimit } from "../middleware/rateLimit.js";
import type { AuthedRequest } from "../middleware/auth.js";

/** Brute-force protection (SPEC.md FR-11): tight on credential routes. */
const credentialLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const refreshLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 60 });

export function authRouter(prisma: PrismaClient | null): Router {
  const router = Router();

  router.post("/auth/register", credentialLimiter, async (req, res, next) => {
    try {
      const input = RegisterRequestSchema.parse(req.body);
      const user = await registerUser(requireDb(prisma), input);
      const body: unknown = await issueSession(res, user);
      res.status(201).json(AuthResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/login", credentialLimiter, async (req, res, next) => {
    try {
      const input = LoginRequestSchema.parse(req.body);
      const user = await loginUser(requireDb(prisma), input);
      const body: unknown = await issueSession(res, user);
      res.json(AuthResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  /** Consent-screen entry point: hands the browser a signed URL. */
  router.get("/auth/google/url", (_req, res, next) => {
    try {
      if (!googleConfigured()) {
        throw new AuthError("google_not_configured", 503);
      }
      res.json(GoogleAuthUrlResponseSchema.parse({ url: googleAuthUrl() }));
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/google", credentialLimiter, async (req, res, next) => {
    try {
      if (!googleConfigured()) {
        throw new AuthError("google_not_configured", 503);
      }
      const { code, state } = GoogleAuthRequestSchema.parse(req.body);
      if (state) await verifyGoogleState(state);
      const profile = await exchangeGoogleCode(code);
      const user = await findOrCreateGoogleUser(requireDb(prisma), profile);
      const body: unknown = await issueSession(res, user);
      res.json(AuthResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/refresh", refreshLimiter, async (req, res, next) => {
    try {
      const db = requireDb(prisma);
      const { userId } = await rotateSession(req.cookies?.[REFRESH_COOKIE]);
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) throw new AuthError("invalid_refresh_token", 401);
      const body: unknown = await issueSession(res, user);
      res.json(AuthResponseSchema.parse(body));
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/logout", (req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  router.get("/auth/me", requireAuth(prisma), async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user!;
      const body: UserPublic = UserPublicSchema.parse({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
      res.json(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
