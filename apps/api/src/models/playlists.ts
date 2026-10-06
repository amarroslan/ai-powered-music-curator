import type { PrismaClient } from "@prisma/client";
import type { Playlist, QuizHistoryEntry } from "@curator/shared";

/**
 * Persists a generated playlist for a signed-in user (SPEC.md FR-7:
 * logged-in users get their library). Only exact tracks enter the
 * permanent track cache — fallback (search-URL-only) tracks are not
 * catalog-verified, so they are not cached, only linked by position.
 */
export async function persistPlaylist(
  prisma: PrismaClient,
  userId: string,
  history: QuizHistoryEntry[],
  playlist: Playlist,
): Promise<void> {
  const session = await prisma.quizSession.create({
    data: {
      userId,
      status: "done",
      answers: history as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  const rows: Array<{
    trackId: string;
    position: number;
    matchStatus: "exact";
    reason: string | null;
  }> = [];

  for (const [position, t] of playlist.tracks.entries()) {
    if (t.matchStatus !== "exact") continue;
    const cached = await prisma.track.upsert({
      where: { fingerprint: t.id },
      create: {
        // Track.id IS the normalized artist::title fingerprint.
        fingerprint: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        year: t.year,
        coverUrl: t.coverUrl,
        links: t.links,
        source: t.source ?? "itunes",
      },
      update: {},
    });
    rows.push({
      trackId: cached.id,
      position,
      matchStatus: "exact",
      reason: t.reason ?? null,
    });
  }

  await prisma.playlist.create({
    data: {
      shareId: playlist.shareId,
      quizSessionId: session.id,
      userId,
      title: playlist.title,
      vibeSummary: playlist.vibeSummary,
      tracks: { create: rows },
    },
  });
}
