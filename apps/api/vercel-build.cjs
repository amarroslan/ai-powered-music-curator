/**
 * Vercel build for a pnpm monorepo with framework: null.
 *
 * Static web output -> apps/web/dist (outputDirectory).
 * Serverless API     -> <repo-root>/api/[...path].cjs, a self-contained
 * esbuild bundle. Vercel executes files in the root api/ directory;
 * anything inside outputDirectory is served statically (which is why
 * the first deploy leaked the bundle source instead of running it).
 *
 * Run from apps/api (via `pnpm --filter @curator/api build:vercel`).
 */
const { rmSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { build } = require("esbuild");

const root = join(__dirname, "..", "..");
// Single well-known function name; vercel.json rewrites /api/* onto
// it (rewrites preserve the original URL, so Express sees the real
// path). Bracket catch-all names ([...x].js) proved unreliable for
// framework:null projects.
const apiOut = join(root, "api", "index.js");

rmSync(join(root, "api"), { recursive: true, force: true });
mkdirSync(join(root, "api"), { recursive: true });

// Serverless function: bundle the API handler (server + deps).
// Prisma is type-import only, so no engine files are needed here.
build({
  entryPoints: [join(__dirname, "src", "api-handler.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: apiOut,
  logLevel: "info",
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

console.log("serverless bundle written to api/[...path].cjs");
