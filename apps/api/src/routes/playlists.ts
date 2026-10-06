import { Router } from "express";
import {
  GeneratePlaylistRequestSchema,
  PlaylistSchema,
} from "@curator/shared";
import type { Playlist, QuizHistoryEntry } from "@curator/shared";
import type { PrismaClient } from "@prisma/client";
import { curatePlaylist } from "../music/pipeline.js";
import { persistPlaylist } from "../models/playlists.js";
import { optionalAuth, type AuthedRequest } from "../middleware/auth.js";
import { simpleRateLimit } from "../middleware/rateLimit.js";

/** Playlists are LLM + catalog heavy: 5 per IP per hour (SPEC.md §12). */
const generateLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

export function playlistsRouter(prisma: PrismaClient | null = null): Router {
  const router = Router();

  router.post(
    "/playlists/generate",
    generateLimiter,
    optionalAuth(prisma),
    async (req, res, next) => {
      try {
        const { history } = GeneratePlaylistRequestSchema.parse(req.body);
        const playlist: Playlist = await curatePlaylist(history);

        // Signed-in users get their playlist saved to the library
        // automatically (SPEC.md §3). Persistence failure must never
        // lose the user their playlist — log and move on.
        const user = (req as AuthedRequest).user;
        if (user && prisma) {
          try {
            await persistPlaylist(prisma, user.id, history as QuizHistoryEntry[], playlist);
          } catch (persistErr) {
            console.error("[playlists] persist failed:", persistErr);
          }
        }

        res.json(PlaylistSchema.parse(playlist));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
