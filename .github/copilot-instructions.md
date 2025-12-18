# AI Agent Instructions for Daily Roll API

These instructions help AI coding agents work productively in this repo. Focus on documented, current patterns.

## Overview
- Purpose: Vercel-hosted API for Fossabot to return randomized “daily roll” stats (IQ, height, Overwatch hero) with smart cooldowns.
- Core logic: hero/insult generation and response formatting in `api/lib/game.js`. Twitch stream status in `api/lib/twitch.js`. HTTP handler and cooldown logic in `api/dailyroll.js`.
- Storage: Upstash Redis for per-user cooldowns and cached tokens/data.
- Runtime: Node 18+ ESM, serverless on Vercel.

## Key Files
- Handler: `api/dailyroll.js` — validates Fossabot request, enforces cooldowns, emits Fossabot-friendly responses.
- Game logic: `api/lib/game.js` — generates IQ, height, hero by tier; formats tier-specific responses; insult list.
- Twitch integration: `api/lib/twitch.js` — app token management, stream start time (5 min cache).
- Data: `api/data/heroes.json` — tiered hero roster (validated at module load).
- Tests: `api/lib/game.test.js` — Vitest characterization tests for `game.js` behavior.
- Vercel config: `vercel.json` — function limits for `api/dailyroll.js`.
- Project overview and deploy steps: `README.md`.

## Environment & Dependencies
- Required env vars (Vercel): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `STREAMER_NAME` (uppercase display name used for channel gating).
- Node 18+ (uses global `fetch`). ESM modules (`"type": "module"`).
- Redis client: `@upstash/redis` using `Redis.fromEnv()` (always use this in serverless functions - auto-reads UPSTASH_* env vars).

## Developer Workflows
- Install and run locally:
  - Install: `npm install`
  - Dev (Vercel): `vercel dev` (see `README.md` for env handling)
- Tests (unit only for `game.js`):
  - Watch: `npm test`
  - CI-style: `npm run test:run`
- Deploy:
  - Vercel CLI: `npm run deploy` or push to the connected repo

## Request/Response Conventions
- Input: Requires Fossabot headers. Handler rejects non-Fossabot/bad channel requests.
  - Channel gating: compares `x-fossabot-channeldisplayname` (uppercased) to `STREAMER_NAME`.
  - Token validation: calls Fossabot context API to resolve `user`/`channel` info.
- Output for Fossabot:
  - Success: prefixed with `me ...` so Fossabot emits as an emote line.
  - Cooldown spam (>=2 attempts): returns `timeout <username> 60s <insult>` so Fossabot issues a timeout.

## Cooldown Logic & Redis Keys
- Keys and payloads:
  - `dailyroll:<userId>` → `{ lastRoll: <ms>, spamCount: <int> }` (TTL: 48h)
  - `twitch:app_token` → `<access_token>` (TTL: 50 days)
  - `stream:<providerId>:start_time` → ISO string (TTL: 5 min)
- Live stream: allow 1 roll per stream using actual `started_at` (Twitch API).
- Offline or missing `started_at`: 24-hour cooldown window.

## Game Logic Patterns
- IQ: integer 0–200. Height: 0'0"–9'11". Tier is percentile-based: normalizes IQ (0-200) and height (0-119 inches), averages them, then bins into 5 ranges via `calculateTier()`.
- Hero tiers: defined in `api/data/heroes.json` (must include `hamster`, `unga`, `normal`, `bigbrain`, `overqualified`). On load, `game.js` validates presence and non-empty `heroes`.
- Responses: `formatRollResponse()` varies by tier; includes special Reinhardt "CHUNGUS" flourish in tier 2 (meme/easter egg).
- Insults: `INSULTS` array in `game.js`; `getRandomInsult()` selects one at random.

## Project-Specific Conventions
- Keep `api/dailyroll.js` stateless per-request (no global state between invocations). Use console logging already present for traceability.
- Prefer adding heroes via `api/data/heroes.json`; avoid hardcoding into `game.js` (it reads from JSON and validates tiers).
- Only modify cooldown behavior in `api/dailyroll.js` (offline window) and `api/lib/twitch.js` (cache TTL) as documented in `README.md`.
- Tests are characterization tests documenting current behavior. When intentionally changing tier logic, response formats, or hero selection, update corresponding tests in `api/lib/game.test.js` to match new expected behavior.

## Safe Change Examples
- Add an insult: edit `INSULTS` in `api/lib/game.js`.
- Tweak offline cooldown: adjust `OFFLINE_COOLDOWN_MS` in `api/dailyroll.js`.
- Change Twitch cache window: edit `FIVE_MINUTES_SECONDS` in `api/lib/twitch.js`.
- Update roster: modify `api/data/heroes.json` and ensure tiers remain valid.

## Gotchas
- Do not call the API directly from a browser; Fossabot headers are required.
- `STREAMER_NAME` must match the uppercased display name; otherwise handler rejects requests.
- Breaking `heroes.json` structure throws at module import time.
