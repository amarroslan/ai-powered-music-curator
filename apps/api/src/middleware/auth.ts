import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../auth/tokens.js";
import { AuthError } from "../auth/service.js";

export interface AuthedRequest extends Request {
  user?: User;
}

async function resolveUser(
  prisma: PrismaClient,
  req: Request,
): Promise<User | null> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  let userId: string;
  try {
    const claims = await verifyAccessToken(token);
    userId = claims.sub;
  } catch {
    throw new AuthError("invalid_access_token", 401);
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

/** 401s unless a valid Bearer token resolves to a real user. */
export function requireAuth(prisma: PrismaClient | null): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!prisma) throw new AuthError("db_unavailable", 503);
      const user = await resolveUser(prisma, req);
      if (!user) throw new AuthError("unauthorized", 401);
      (req as AuthedRequest).user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Populates req.user when a valid token is present; never rejects. */
export function optionalAuth(prisma: PrismaClient | null): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!prisma) return next();
      const user = await resolveUser(prisma, req);
      if (user) (req as AuthedRequest).user = user;
      next();
    } catch {
      // Anonymous (or expired token) requests still flow through.
      next();
    }
  };
}
