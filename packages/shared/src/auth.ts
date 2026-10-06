import { z } from "zod";

// ---- auth contracts (SPEC.md §7) ------------------------------------------

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().max(80).nullable(),
  avatarUrl: z.string().url().nullable(),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const RegisterRequestSchema = z.object({
  email: z.email().max(200),
  /** bcrypt cost 12 downstream; 8+ keeps the worst passwords out. */
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(80).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(100),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** The browser hands us Google's authorization code (and the signed
 * state that guards the redirect); the server exchanges it so the
 * client secret never leaves the backend. */
export const GoogleAuthRequestSchema = z.object({
  code: z.string().min(5).max(500),
  state: z.string().min(10).max(2000).optional(),
});
export type GoogleAuthRequest = z.infer<typeof GoogleAuthRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(10),
  user: UserPublicSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const GoogleAuthUrlResponseSchema = z.object({
  url: z.string().url(),
});

// ---- user library ----------------------------------------------------------

export const MePlaylistsItemSchema = z.object({
  id: z.string().uuid(),
  shareId: z.string().min(1),
  title: z.string(),
  vibeSummary: z.string(),
  trackCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type MePlaylistsItem = z.infer<typeof MePlaylistsItemSchema>;

export const MePlaylistsResponseSchema = z.object({
  playlists: z.array(MePlaylistsItemSchema),
});
export type MePlaylistsResponse = z.infer<typeof MePlaylistsResponseSchema>;
