import { Router } from "express";
import {
  GeneratePlaylistRequestSchema,
  PlaylistSchema,
} from "@curator/shared";
import type { Playlist } from "@curator/shared";
import { curatePlaylist } from "../music/pipeline.js";
import { simpleRateLimit } from "../middleware/rateLimit.js";

/** Playlists are LLM + catalog heavy: 5 per IP per hour (SPEC.md §12). */
const generateLimiter = simpleRateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

export function playlistsRouter(): Router {
  const router = Router();

  router.post(
    "/playlists/generate",
    generateLimiter,
    async (req, res, next) => {
      try {
        const { history } = GeneratePlaylistRequestSchema.parse(req.body);
        const playlist: Playlist = await curatePlaylist(history);
        res.json(PlaylistSchema.parse(playlist));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
