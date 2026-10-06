import { randomUUID } from "node:crypto";
import {
  PLAYLIST_TARGET_SIZE,
  type Playlist,
  type Track,
  type TrackLinks,
} from "@curator/shared";
import { generateCandidates } from "../llm/candidates.js";
import { validateCandidates, type ValidatedTrack } from "./resolver.js";

const MAX_ROUNDS = 2;
/** Minimum similarity to accept a catalog match. */
const MATCH_THRESHOLD = 0.5;

function toTrack(v: ValidatedTrack): Track {
  return {
    id: v.id,
    title: v.title,
    artist: v.artist,
    album: v.album,
    year: v.year,
    coverUrl: v.coverUrl,
    links: v.links,
    matchStatus: v.matchStatus,
    reason: v.reason,
    source: v.source,
  };
}

function searchOnlyTrack(title: string, artist: string, reason: string | null): Track {
  const q = encodeURIComponent(`${artist} ${title}`);
  const links: TrackLinks = {
    spotify: `https://open.spotify.com/search/${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    apple_music: `https://music.apple.com/us/search?term=${q}`,
  };
  return {
    id: `fallback::${artist}::${title}`.toLowerCase(),
    title,
    artist,
    album: null,
    year: null,
    coverUrl: null,
    links,
    matchStatus: "fallback",
    reason,
  };
}

/**
 * The M3 heart (SPEC.md §6): LLM proposes candidates, every one is
 * validated against real catalogs, drops are retried once with an
 * avoid-list, and the final playlist is assembled in curation order.
 * If validation catastrophically fails, unverified candidates ship as
 * clearly-marked fallback tracks — never a dead end, never a lie.
 */
export async function curatePlaylist(
  history: Array<{ question: { topic: string }; answer: unknown }>,
): Promise<Playlist> {
  const blueprint = await generateCandidates(history);

  let validated: ValidatedTrack[] = [];
  let dropped: string[] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const batch =
      round === 1
        ? blueprint.candidates
        : blueprint.candidates.filter(
            (c) => !dropped.includes(`${c.artist}::${c.title}`.toLowerCase()),
          );

    const found = await validateCandidates(batch);
    validated = validated.concat(found);

    const keptIds = new Set(validated.map((v) => v.id));
    dropped = blueprint.candidates
      .map((c) => `${c.artist}::${c.title}`.toLowerCase())
      .filter((id) => !keptIds.has(id.replace(/::.*/, "")) && !keptIds.has(id));

    if (validated.length >= PLAYLIST_TARGET_SIZE) break;
  }

  // Assemble in blueprint order, filtered to validated tracks.
  const byIdentity = new Map<string, ValidatedTrack>();
  for (const v of validated) {
    const key = `${v.artist}::${v.title}`.toLowerCase();
    if (!byIdentity.has(key)) byIdentity.set(key, v);
  }

  const ordered: Track[] = [];
  const seen = new Set<string>();
  for (const c of blueprint.candidates) {
    const key = `${c.artist}::${c.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const v = byIdentity.get(key);
    if (v && v.matchScore >= MATCH_THRESHOLD) ordered.push(toTrack(v));
  }

  // Backfill with the best remaining matches if we're short.
  for (const v of validated) {
    if (ordered.length >= PLAYLIST_TARGET_SIZE) break;
    const key = `${v.artist}::${v.title}`.toLowerCase();
    if (!seen.has(key) && v.matchScore >= MATCH_THRESHOLD) {
      seen.add(key);
      ordered.push(toTrack(v));
    }
  }

  // Last resort: pad with clearly-marked fallback tracks so the user
  // always gets a usable playlist (SPEC.md FR-5's safety valve).
  if (ordered.length < PLAYLIST_TARGET_SIZE) {
    for (const c of blueprint.candidates) {
      if (ordered.length >= PLAYLIST_TARGET_SIZE) break;
      const key = `${c.artist}::${c.title}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(searchOnlyTrack(c.title, c.artist, c.reason));
      }
    }
  }

  return {
    id: randomUUID(),
    shareId: randomUUID().replace(/-/g, "").slice(0, 10),
    title: blueprint.title,
    vibeSummary: blueprint.vibeSummary,
    tracks: ordered.slice(0, PLAYLIST_TARGET_SIZE),
    createdAt: new Date().toISOString(),
  };
}
