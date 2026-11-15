# Rogue Forest

A browser-based, turn-based, grid-combat roguelike. The full design is in [docs/TECH_DESIGN.md](docs/TECH_DESIGN.md).

**Status:** milestones M0–M3 are done: pages and accounts, and a practice fight with enemy intents, statuses and push/pull. The map and room flow come with M4.

## Run it locally

Needs Node.js 20 or newer.

```
npm install
npm run dev
```

Then open http://localhost:5173. The API runs on port 3001 and the client proxies `/api` to it.
Local accounts and saves go into a SQLite file at `server/data/dev.db`. Delete that file to start fresh.

Add `?dev=1` to the Starter Select URL (`#/starter?dev=1`) to get a seed input.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API server and the Vite client together |
| `npm test` | Runs the Vitest tests (engine + API) |
| `npm run typecheck` | Type-checks the server, shared code and client |
| `npm run build` | Builds the client into `client/dist` |
| `npm run placeholders` | Regenerates the placeholder home page art |

## Layout

| Folder | Contents |
|---|---|
| `shared/` | Game data (JSON), the pure game engine, shared types and zod schemas |
| `client/` | Vite app: Home, Login and Starter Select pages, plus the Phaser game in `client/src/game/` |
| `server/` | Express API: accounts, sessions, saves, unlocks, badges |
| `api/` | Vercel function entry that re-exports the Express app |

## Deploy to Vercel

1. Create a database at [Turso](https://turso.tech) and copy its URL and an auth token.
2. Import the repository into Vercel.
3. In the Vercel project settings, add the environment variables `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
4. Deploy. `vercel.json` already sets the build command, the output folder and the `/api` rewrite.

The server creates its tables on first use, so there is no migration step.
