import { Router } from "express";
import {
  MePlaylistsResponseSchema,
  UserPublicSchema,
} from "@curator/shared";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

/** Library for the signed-in user (SPEC.md §10: GET /api/me/playlists). */
export function meRouter(prisma: PrismaClient | null): Router {
  const router = Router();

  router.get("/me/playlists", requireAuth(prisma), async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user!;
      const playlists = await prisma!.playlist.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tracks: true } } },
      });

      res.json(
        MePlaylistsResponseSchema.parse({
          playlists: playlists.map((p) => ({
            id: p.id,
            shareId: p.shareId,
            title: p.title,
            vibeSummary: p.vibeSummary,
            trackCount: p._count.tracks,
            createdAt: p.createdAt.toISOString(),
          })),
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", requireAuth(prisma), async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user!;
      res.json(
        UserPublicSchema.parse({
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}
