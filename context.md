# Globalmonitor (v3-global) — Live Context

Last updated: 2026-06-18.

## VERIFY BEFORE RECOMMEND (mandatory for all agents)

**Never tell Dr Non to open a URL or run a command unless the agent verified it in the same session** (curl, browser MCP, or equivalent). If unverified, say **"I have not verified this yet"** — never "open http://localhost:5180" or "it should work now."

After verification, report the exact URL, exact command run, and HTTP status. If verification fails, say **"still broken"** with error output — do not ask the user to try opening anything.

Cursor rule: [.cursor/rules/verify-before-recommend.mdc](.cursor/rules/verify-before-recommend.mdc)

## Live URL
- **Primary eval (laptop, no Fly billing)**: http://localhost:5180 — `npm run dev:stack` (Vite + API proxy). API direct: http://127.0.0.1:4000
- **Production (optional)**: https://globalmonitor.fly.dev/ (Fly.io — deploy not required for dev)
- **Static backup**: https://nonarkara.github.io/globalmonitor/ (GitHub Pages)
- Fallback configs: `render.yaml`, `vercel.json`

## Local dev (one command)
```bash
cd /Users/nonarkara/Projects/conflict-tracker/v3-global && npm run dev:stack
```
Starts `node server/index.mjs` on **4000** and Vite on **5180** (`/api` proxied to 4000). Fly.io billing not required. **Stack must be running** — otherwise port 5180 returns connection refused (not a code bug). Agents: verify with curl before recommending the URL.

## Commit reporting
When reporting whether work is shipped, agents MUST state one of:
- **Committed on localhost** — `git commit` exists locally; not necessarily pushed or running on laptop.
- **Running on localhost: http://localhost:5180** — change is visible in local dev (`npm run dev:stack`); not on fly.dev.
- **Committed on URL: https://globalmonitor.fly.dev/** — change is live at that URL (repeat the full URL every time).

GitHub Pages backup deploys separately from Fly.io; if only gh-pages has the change, use `Committed on URL: https://nonarkara.github.io/globalmonitor/`. Never imply fly.dev live until push + deploy are verified (`git status` vs `origin/main`, deploy logs).

## Deploy status (2026-06-18)
- **Git**: `origin/main` = `310742b` (includes `97034c3` flight layer + clock jitter fixes)
- **Local**: verified — http://localhost:5180 loads; `/api/flights?theater=middleeast` returns 68+ features; `flights-glow` + `airplanes.live` in source bundle
- **Fly**: **not deployed** — billing blocked; **optional** for dev. Stale bundle `assets/index-C9kO43wa.js` — no `flights-glow`, still OpenSky-era copy
- **Fly unblock (when wanted)**: `npm run build && fly deploy --local-only -a globalmonitor` or add billing → `fly deploy -a globalmonitor`

## Three-Region Theater Nav
Global Monitor now has three theaters: Middle East, Indo-Pacific, Thailand.

- Switcher lives in the header bar (top-right). Selecting a region:
  - moves the camera to that region's preset viewState,
  - swaps the Live TV channel grid to the region's curated set,
  - swaps the right-sidebar + bottom-bar panels to region-relevant content,
  - resets the selected country/province (CountryNewsPanel re-defaults to the first item).

Single source of truth: [src/data/regions.js](src/data/regions.js) — viewStates, dot data, news queries, TV channels all live here. Add/edit a theater there and it propagates.

## Map Stack — what changed in this audit
- **Satellite basemap fixed**: previously pointed at MapTiler with the literal docs placeholder key (`get_your_own_OpIi9ZULNHzrESv6T2vL`) — rendered blank in production. Replaced with an inline ESRI World Imagery raster style (no key required).
- **Tile error handler**: `map.on('error')` is now wired in [MapContainer.jsx](src/components/MapContainer.jsx). Failed sources surface as a small amber "N layers unavailable" badge bottom-right.
- **NASA GIBS redundancy**: every GIBS layer in [eoTiles.js](src/services/eoTiles.js) now uses 3 subdomain mirrors (`gibs`, `gibs-a`, `gibs-b`) for round-robin tile loads.
- **Cursor lat/lng readout**: bottom-left of map. Mono, hairline cyan border, copy-to-clipboard button.

## Per-Country News
- ASEAN-10 capitals + 8 Thai sub-regions are rendered as clickable dots when in Indo-Pacific / Thailand mode.
- Click a dot → CountryNewsPanel switches to that country/province → tech + urgent news appear.
- LocalStorage cache: previously-visited countries show cached items instantly while a fresh fetch happens in the background.

## Supabase — Systematic Data Collection

Globalmonitor reuses the existing **geopolitics-dashboard** Supabase project to keep cost at $0 (free tier permits 2 projects per org). Tables are namespaced with `gm_` prefix to avoid colliding with the geopolitics-dashboard schema.

- **Project URL**: https://qbatksnulitgrhigzbta.supabase.co
- **Project ref**: `qbatksnulitgrhigzbta`
- **Tier**: Free (shared org with geopolitics-dashboard)

### Required env vars (server-side only)
```
GM_SUPABASE_URL=https://qbatksnulitgrhigzbta.supabase.co
GM_SUPABASE_SERVICE_KEY=<service_role JWT — see /Users/nonarkara/Projects/shared/.secrets-backup/dashboards_geopolitics-dashboard_.env>
```

If either env var is missing, the Supabase client silently no-ops and the dashboard falls back to direct Google News fetches via the CORS proxy chain. Local dev still works without Supabase configured.

### One-time DB setup (Supabase has no CLI for ad-hoc DDL without DB password)
1. Open https://supabase.com/dashboard/project/qbatksnulitgrhigzbta/sql/new
2. Paste contents of [supabase/migrations/001_globalmonitor_news.sql](supabase/migrations/001_globalmonitor_news.sql)
3. Click Run. Migration is idempotent (`CREATE TABLE IF NOT EXISTS`).

### Tables created
- `gm_news_items` — per-country/province news cache, de-duped by URL
- `gm_ingestion_runs` — heartbeat log per loader run (for source-health surface)
- `gm_region_visits` — region tab visit telemetry (drives render-prioritisation)

All tables have public-read RLS policies. Writes restricted to `service_role`.

### Backend ingestion
- [server/lib/supabase.mjs](server/lib/supabase.mjs) — Supabase client singleton + helpers
- [server/lib/regionalNewsIngest.mjs](server/lib/regionalNewsIngest.mjs) — fetches RSS, persists, returns
- API endpoint: `GET /api/regional-news?region=indopacific&code=TH` (or `region=thailand&code=BKK`)
- Health: `GET /api/supabase-health`

### Frontend integration
- [src/services/regionalCountryNews.js](src/services/regionalCountryNews.js) prefers the backend route. Falls back to direct Google News via `allorigins → codetabs → corsproxy.io` if backend is unreachable.

### Adding more loaders to Supabase
Pattern: extend [server/lib/supabase.mjs](server/lib/supabase.mjs) with an `upsertX` function, write an ingestion lib that calls it + `recordIngestionRun()`, add the route to `server/index.mjs`. Existing loaders (FIRMS, ACLED, weather) are good next candidates — they already have `useCached` wrappers in `index.mjs`; piping the cached payload through `upsert` is a one-liner per loader.

## Ship tracking (AIS)
- Layer wired: toggle **Ship Tracking** in sidebar → `/api/vessels` → `server/lib/aisVessels.mjs` (WebSocket to aisstream.io)
- **GitHub repo**: https://github.com/aisstream/aisstream — free global AIS WebSocket API (like airplanes-live for flights)
- **Coverage**: worldwide bounding box `[-180,-90] → [180,90]` plus Hormuz/Malacca/Taiwan Strait supplements
- **Requires env var**: `AISSTREAM_API_KEY` — free registration at https://aisstream.io/authenticate
- Local: put key in `.env.local` (gitignored via `*.local`). Also in `shared/.secrets-backup/dashboards_2026-Dashboard_.env.local`
- Without key: layer shows legend "AIS key required"; API returns empty FeatureCollection with `meta.requiresKey: true`
- Default layers: flights + vessels both on at startup

## Flight tracking (ADS-B)
- **Primary**: https://github.com/airplanes-live/api — free REST API, no key
- **Supplement**: OpenSky Network — OAuth2 client credentials (`OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET`). Authenticated tier: 4,000 daily credits per endpoint bucket; worldwide `/states/all` costs 4 credits per request.
- **Coverage**: airplanes.live uses 15 overlapping 250 nm query points worldwide when `theater=global` or `theater=worldwide`; OpenSky adds origin-country, emitter category, and SPI metadata when configured.
- Endpoint: `GET /api/flights?theater=global` (default). Map always fetches global regardless of theater nav
- Rate limit: airplanes.live 1 req/sec; server caches 2 min
- **Local env template** (`.env.local` — gitignored):
```
OPENSKY_CLIENT_ID=nonarkara-api-client
OPENSKY_CLIENT_SECRET=<from OpenSky account page or Reset Credential>
```
If secret missing: log in at https://opensky-network.org → Account → API Clients → Reset Credential for `nonarkara-api-client`.

## RainViewer radar (2026-06-18 fix)
- Legacy URL `/v2/radar/nowcast/…` returns **404** → MapLibre grey "Zoom Level Not Supported" tiles when Weather layer on
- Fixed: `GET /api/rainviewer` fetches latest hash path from `api.rainviewer.com/public/weather-maps.json`
- Weather layer in MapContainer loads tiles dynamically from that endpoint (5 min cache)

Read [CLAUDE.md](CLAUDE.md) before editing this project. Hard rules:
- Live world-map visualization stays — do not replace with static.
- Tactical color palette only (amber/obsidian/cyan). Zero pastels, gradients, round corners.
- `[EVENT_ID]` mono incident tags + monospaced coordinate readouts preserved.
- Global scope — do not regress to Middle East only. V1 and V2 exist for that.
