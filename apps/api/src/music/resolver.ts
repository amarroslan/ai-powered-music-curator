import type { CandidateTrack, Track, TrackLinks } from "@curator/shared";

/**
 * Validates LLM candidates against real music catalogs (SPEC.md §6)
 * and resolves deep links for every platform. Both sources are
 * keyless public APIs: Deezer (~50 req/5s) does the heavy lifting,
 * iTunes Search (~20 req/min) backs it up.
 */

const DEEZER_API = "https://api.deezer.com/search";
const ITUNES_API = "https://itunes.apple.com/search";
const MATCH_TIMEOUT_MS = 6_000;
/** Concurrency for fan-out validation. */
const CONCURRENCY = 4;

export interface ValidatedTrack extends Track {
  /** 0-1: how strongly the catalog entry matched the candidate. */
  matchScore: number;
  source: "deezer" | "itunes";
}

// ---- text normalization + fuzzy matching -----------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/\(.*?\)|\[.*?\]/g, " ") // strip parenthetical bits
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE_WORDS = new Set([
  "feat", "ft", "featuring", "with", "and", "the", "a", "an", "remastered",
  "remaster", "version", "edit", "single", "mono", "stereo", "live",
]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0 && !NOISE_WORDS.has(t));
}

/** Token-overlap similarity in [0,1]. */
function similarity(a: string, b: string): number {
  const at = new Set(tokens(a));
  const bt = new Set(tokens(b));
  if (at.size === 0 || bt.size === 0) return 0;
  let overlap = 0;
  for (const t of at) if (bt.has(t)) overlap += 1;
  return overlap / Math.max(at.size, bt.size);
}

/** Artist must share a meaningful token (surname/band word); title scored by overlap. */
export function matchScore(candidate: CandidateTrack, foundTitle: string, foundArtist: string): number {
  const candArtist = tokens(candidate.artist);
  const foundArtistTokens = new Set(tokens(foundArtist));
  const artistOk =
    candArtist.length > 0 && candArtist.some((t) => foundArtistTokens.has(t));
  if (!artistOk) return 0;
  return similarity(candidate.title, foundTitle);
}

// ---- catalog clients ---------------------------------------------------------

interface CatalogHit {
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  coverUrl: string | null;
  previewUrl: string | null;
  links: Partial<TrackLinks>;
  source: "deezer" | "itunes";
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(MATCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

interface DeezerData {
  data?: Array<{
    title?: string;
    artist?: { name?: string };
    album?: { title?: string; cover_medium?: string; cover_big?: string };
    preview?: string;
    link?: string;
  }>;
}

async function searchDeezer(candidate: CandidateTrack): Promise<CatalogHit | null> {
  const q = encodeURIComponent(`${candidate.artist} ${candidate.title}`);
  const json = (await fetchJson(`${DEEZER_API}?q=${q}&limit=5`)) as DeezerData | null;
  const hits = json?.data ?? [];
  let best: { hit: NonNullable<DeezerData["data"]>[number]; score: number } | null = null;
  for (const hit of hits) {
    const score = matchScore(candidate, hit.title ?? "", hit.artist?.name ?? "");
    if (score > 0 && (!best || score > best.score)) best = { hit, score };
  }
  if (!best || best.score < 0.5) return null;
  const h = best.hit;
  return {
    title: h.title ?? candidate.title,
    artist: h.artist?.name ?? candidate.artist,
    album: h.album?.title ?? null,
    year: null, // Deezer search doesn't return release year reliably
    coverUrl: h.album?.cover_big ?? h.album?.cover_medium ?? null,
    previewUrl: h.preview ?? null,
    links: { spotify: h.link ?? null }, // deezer page; replaced below
    source: "deezer",
  };
}

interface ITunesData {
  results?: Array<{
    trackName?: string;
    artistName?: string;
    collectionName?: string;
    releaseDate?: string;
    artworkUrl100?: string;
    previewUrl?: string;
    trackViewUrl?: string;
  }>;
}

async function searchItunes(candidate: CandidateTrack): Promise<CatalogHit | null> {
  const q = encodeURIComponent(`${candidate.artist} ${candidate.title}`);
  const json = (await fetchJson(`${ITUNES_API}?term=${q}&entity=song&limit=5`)) as ITunesData | null;
  const hits = json?.results ?? [];
  let best: { hit: NonNullable<ITunesData["results"]>[number]; score: number } | null = null;
  for (const hit of hits) {
    const score = matchScore(candidate, hit.trackName ?? "", hit.artistName ?? "");
    if (score > 0 && (!best || score > best.score)) best = { hit, score };
  }
  if (!best || best.score < 0.5) return null;
  const h = best.hit;
  const year = h.releaseDate ? Number(h.releaseDate.slice(0, 4)) : null;
  return {
    title: h.trackName ?? candidate.title,
    artist: h.artistName ?? candidate.artist,
    album: h.collectionName ?? null,
    year: Number.isFinite(year) ? year : null,
    coverUrl: h.artworkUrl100?.replace("100x100", "600x600") ?? null,
    previewUrl: h.previewUrl ?? null,
    links: { apple_music: h.trackViewUrl ?? null },
    source: "itunes",
  };
}

// ---- deep-link builders --------------------------------------------------------

function searchLinks(title: string, artist: string): TrackLinks {
  const q = encodeURIComponent(`${artist} ${title}`);
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
    apple_music: `https://music.apple.com/us/search?term=${q}`,
  };
}

// ---- validation pipeline ---------------------------------------------------------

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i;
      i += 1;
      results[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Validates every candidate against real catalogs. Survivors become
 * tracks with exact-match deep links (Apple Music via iTunes) plus
 * per-platform search fallbacks so nothing is ever a dead end.
 */
export async function validateCandidates(
  candidates: CandidateTrack[],
): Promise<ValidatedTrack[]> {
  const validated = await mapLimit(candidates, CONCURRENCY, async (candidate) => {
    // Dedupe by normalized identity within the same batch.
    const [deezer, itunes] = await Promise.all([
      searchDeezer(candidate),
      new Promise((r) => setTimeout(r, 60)).then(() => searchItunes(candidate)),
    ]);

    const hit = deezer ?? itunes;
    if (!hit) return null;

    const links = searchLinks(hit.title, hit.artist);
    if (hit.links.apple_music) links.apple_music = hit.links.apple_music;

    const score = Math.max(
      deezer ? matchScore(candidate, deezer.title, deezer.artist) : 0,
      itunes ? matchScore(candidate, itunes.title, itunes.artist) : 0,
    );

    const track: ValidatedTrack = {
      id: `${normalize(hit.artist)}::${normalize(hit.title)}`,
      title: hit.title,
      artist: hit.artist,
      album: hit.album,
      year: hit.year ?? candidate.year,
      coverUrl: hit.coverUrl,
      links,
      matchStatus: "exact",
      reason: candidate.reason,
      matchScore: score,
      source: hit.source,
    };
    return track;
  });

  // Dedupe by id, keep the highest-scored entry.
  const byId = new Map<string, ValidatedTrack>();
  for (const t of validated) {
    if (!t) continue;
    const existing = byId.get(t.id);
    if (!existing || t.matchScore > existing.matchScore) byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => b.matchScore - a.matchScore);
}
