import { z } from "zod";
import { TrackSchema } from "./track.js";

/** A finished, shareable playlist. */
export const PlaylistSchema = z.object({
  id: z.string().uuid(),
  shareId: z.string().min(10).max(16),
  title: z.string().min(1).max(120),
  vibeSummary: z.string().min(1).max(500),
  tracks: z.array(TrackSchema).min(1).max(50),
  createdAt: z.string().datetime(),
});
export type Playlist = z.infer<typeof PlaylistSchema>;

export const PlaylistNotFoundErrorSchema = z.object({
  error: z.literal("playlist_not_found"),
});
