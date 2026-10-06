import { z } from "zod";
import type { Platform } from "./platforms.js";

export const PLATFORM_LABELS: Record<Platform, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  apple_music: "Apple Music",
};

/** Resolved deep links per platform. Never null in practice: the
 * resolver fills platform search URLs as fallbacks so every track
 * always has three clickable destinations. */
export const TrackLinksSchema = z.object({
  spotify: z.string().url().nullable(),
  youtube: z.string().url().nullable(),
  apple_music: z.string().url().nullable(),
});
export type TrackLinks = z.infer<typeof TrackLinksSchema>;

/** A validated, display-ready track. Only these are ever rendered to users. */
export const TrackSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().nullable(),
  year: z.number().int().nullable(),
  coverUrl: z.string().url().nullable(),
  links: TrackLinksSchema,
  /** exact = verified against a real music catalog */
  matchStatus: z.enum(["exact", "fallback"]),
  reason: z.string().max(200).nullable().optional(),
  /** Which catalog verified it (exact tracks only; feeds the track cache). */
  source: z.enum(["deezer", "itunes"]).optional(),
});
export type Track = z.infer<typeof TrackSchema>;

/**
 * The LLM's raw candidate output before validation. The curation
 * pipeline validates each candidate against real music APIs and
 * promotes the survivors to `Track`.
 */
export const CandidateTrackSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  year: z.number().int().min(1900).max(2100).nullable(),
  reason: z.string().max(200),
  confidence: z.number().min(0).max(1),
});
export type CandidateTrack = z.infer<typeof CandidateTrackSchema>;
