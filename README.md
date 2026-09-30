# Music Curator (working title)

AI-powered playlist curator: an adaptive 20+ question vibe check → a validated ~25-track playlist where every song deep-links to Spotify, YouTube, or Apple Music. Full product/engineering details in [SPEC.md](./SPEC.md).

## Monorepo layout

| Path | What it is |
|---|---|
| `apps/web` | React 18 + Vite + Tailwind v4 frontend |
| `apps/api` | Node + Express + Prisma backend |
| `packages/shared` | zod schemas + shared types (Question, Track, Playlist, Health) |

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm — pinned via the root `packageManager` field. If `pnpm` isn't on your PATH, run commands through `corepack pnpm …` (or `corepack enable` once).
- Docker — only needed for the local Postgres database.

## Quickstart

```bash
corepack pnpm install
corepack pnpm -r build          # builds shared → api → web (shared must exist for dev too)

docker compose up -d db         # optional: local Postgres
corepack pnpm --filter @curator/api db:migrate   # once the DB is up

corepack pnpm dev:api           # terminal 1 → http://localhost:4000
corepack pnpm dev:web           # terminal 2 → http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm -r typecheck` | Typecheck all packages (topological order) |
| `pnpm -r build` | Build shared → api → web |
| `pnpm dev:api` / `pnpm dev:web` | Watch mode for each app |
| `pnpm db:up` / `db:down` | Start/stop local Postgres |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Apply pending migrations |

## Environment

Copy `apps/api/.env.example` → `apps/api/.env`. Defaults point at the local Docker Postgres.
