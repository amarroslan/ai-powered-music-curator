import type { GeneratePlaylistRequest, Playlist } from "@curator/shared";

export async function generatePlaylist(
  body: GeneratePlaylistRequest,
): Promise<Playlist> {
  const res = await fetch("/api/playlists/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(
      (detail as { error?: string } | null)?.error ?? `API ${res.status}`,
    );
  }
  return res.json() as Promise<Playlist>;
}
