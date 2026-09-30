/**
 * Vercel build for a pnpm monorepo with framework: null.
 * Produces dist-vercel/ = static web output at the root + one
 * serverless catch-all function under api/.
 *
 * Run from apps/api (via `pnpm --filter @curator/api build:vercel`).
 */
const { rmSync, mkdirSync, cpSync } = require("node:fs");
const { join } = require("node:path");
const { build } = require("esbuild");

const root = join(__dirname, "..", "..");
const outDir = join(root, "dist-vercel");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "api", "[...path]"), { recursive: true });

// 1. Serverless function: bundle the API handler (server + deps).
//    Prisma is type-import only, so no engine files are needed here.
build({
  entryPoints: [join(__dirname, "src", "api-handler.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: join(outDir, "api", "[...path]", "index.cjs"),
  logLevel: "info",
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

// 2. Static web output at the root (index.html at dist-vercel/).
cpSync(join(root, "apps", "web", "dist"), outDir, { recursive: true });

console.log("vercel bundle written to dist-vercel/");
