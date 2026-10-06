import { z } from "zod";

export const PLATFORMS = ["spotify", "youtube", "apple_music"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PlatformSchema = z.enum(PLATFORMS);
