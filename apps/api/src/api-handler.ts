import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "./app.js";

// Stateless by design: no Prisma client on the serverless path (M4
// brings a managed DB for auth/playlists). Quiz + health run fully.
const app = createApp(null);

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
