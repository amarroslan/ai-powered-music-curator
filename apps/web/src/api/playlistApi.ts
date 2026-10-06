import type { GeneratePlaylistRequest, Playlist } from "@curator/shared";
import { getAccessToken } from "./authApi";

export async function generatePlaylist(
  body: GeneratePlaylistRequest,
): Promise<Playlist> {
  const token = getAccessToken();
  const res = await fetch("/api/playlists/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
