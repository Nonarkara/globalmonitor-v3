# Globalmonitor (v3-global) — Live Context

Last updated: 2026-06-21 (Cloudflare Pages primary — Fly.io retired).

## VERIFY BEFORE RECOMMEND (mandatory for all agents)

**Never tell Dr Non to open a URL or run a command unless the agent verified it in the same session** (curl, browser MCP, or equivalent). If unverified, say **"I have not verified this yet"** — never "open http://localhost:5180" or "it should work now."

After verification, report the exact URL, exact command run, and HTTP status. If verification fails, say **"still broken"** with error output — do not ask the user to try opening anything.

Cursor rule: [.cursor/rules/verify-before-recommend.mdc](.cursor/rules/verify-before-recommend.mdc)

## Live URL

- **Production URL**: https://globalmonitor.pages.dev/ — Cloudflare Pages (static frontend + API via Pages Functions, same origin).
- **Current source repo**: https://github.com/Nonarkara/globalmonitor
- **Clean v3 mirror repo**: https://github.com/Nonarkara/globalmonitor-v3
- **Legacy static backup**: https://nonarkara.github.io/globalmonitor/

## GlobeWatch v8.3 (Codex pass — in repo)
- UI label: `GlobeWatch v8.3` in [src/App.jsx](src/App.jsx) / [Sidebar.jsx](src/components/Sidebar.jsx)
- Region-aware traffic interpolation ([useInterpolatedTraffic.js](src/hooks/useInterpolatedTraffic.js)), theater bboxes ([MapContainer.jsx](src/components/MapContainer.jsx))
- Sidebar groups: Basemap, Operational, Mobility, Environment, Satellite catalog, Source Agencies ([Sidebar.jsx](src/components/Sidebar.jsx))
- Rams-style human walkthrough and design audit: [docs/human-walkthrough-2026-06-20.md](docs/human-walkthrough-2026-06-20.md)
- Flatter panels, reduced blur, labeled Tools dropdown, disclosed specialist catalogs ([src/styles/index.css](src/styles/index.css))
- aviationstack supplement: Middle East bounds, 8h cache, ~3 pulls/day ([server/lib/aviationStack.mjs](server/lib/aviationStack.mjs)); template in [.env.example](.env.example)
- Ports in repo: **5180** (Vite) + **4000** (API) — not Codex 5183/4010 unless overridden by env

- **Primary eval (laptop)**: http://localhost:5180 — `npm run dev:stack` (Vite + API proxy). API direct: http://127.0.0.1:4000
- **Production**: https://globalmonitor.pages.dev/ (Cloudflare Pages project `globalmonitor` — frontend + API)
- **Legacy static backup**: https://nonarkara.github.io/globalmonitor/ (GitHub Pages)
- Fallback config: `render.yaml` (vercel.json removed from repo)
- **Fly.io**: retired as primary host (`fly.toml` kept for reference only)

## Local dev (one command)
```bash
cd /Users/nonarkara/Projects/conflict-tracker/v3-global && npm run dev:stack
```
Starts `node server/index.mjs` on **4000** and Vite on **5180** (`/api` proxied to 4000). Fly.io billing not required. **Stack must be running** — otherwise port 5180 returns connection refused (not a code bug). Agents: verify with curl before recommending the URL.

## Commit reporting
When reporting whether work is shipped, agents MUST state one of:
- **Committed on localhost** — `git commit` exists locally; not necessarily pushed or running on laptop.
- **Running on localhost: http://localhost:5180** — change is visible in local dev (`npm run dev:stack`); not on production.
- **Committed on URL: https://globalmonitor.pages.dev/** — change is live at that URL (repeat the full URL every time).

GitHub Pages backup deploys separately; if only gh-pages has the change, use `Committed on URL: https://nonarkara.github.io/globalmonitor/`. Never imply production live until push + deploy are verified (`git status` vs `origin/main`, deploy logs).

## Deploy status (2026-06-21)
- **Primary host**: Cloudflare Pages at `https://globalmonitor.pages.dev/` — static `dist/` + API via `functions/`.
- **Deploy command**: `npm run deploy:pages` (or `npx wrangler pages deploy dist --project-name globalmonitor --branch=main --commit-dirty=true`).
- **Build**: same-origin API — `VITE_API_BASE_URL` empty at build time; `/api/*` served by Pages Functions.
- **Local eval**: `npm run dev:stack` — full Node API with AIS WebSocket on port 4000.
- **Pages API caveat**: global AIS WebSocket (aisstream.io) needs long-running Node; Pages serves VesselFinder fleet overlay when `VESSELFINDER_FLEET_KEY` is bound in Cloudflare env.
- **RainViewer on Pages**: `api.rainviewer.com` may timeout from Cloudflare Workers edge (blocked or slow); weather radar layer may show stale/empty until a client-side fallback is added. `/api/flights`, `/api/health`, `/api/vessels` verified live on same origin.
- **GitHub Pages**: legacy only; manual command remains `npm run build -- --base=/globalmonitor/ && cp dist/index.html dist/404.html && npx gh-pages -d dist`.

## Three-Region Theater Nav
Global Monitor now has three theaters: Middle East, Indo-Pacific, Thailand.

- Switcher lives in the header bar (top-right). Selecting a region:
  - moves the camera to that region's preset viewState,
  - swaps the Live TV channel grid to the region's curated set,
  - swaps the right-sidebar + bottom-bar panels to region-relevant content,
  - resets the selected country/province (CountryNewsPanel re-defaults to the first item).

Single source of truth: [src/data/regions.js](src/data/regions.js) — viewStates, dot data, news queries, TV channels all live here. Add/edit a theater there and it propagates.

## Region-aware data plumbing (Phase 3)
- Backend endpoints now accept `?theater=` for ACLED, humanitarian, FIRMS, USGS quakes, and GDELT sentiment.
  - `server/lib/acled.mjs` — theater-specific country lists + curated fallback events.
  - `server/lib/humanitarian.mjs` — theater-specific UNHCR / ReliefWeb country sets + fallback data.
  - `server/lib/firms.mjs` — Thailand bbox + sample hotspots.
  - `server/lib/usgsQuakes.mjs` — Thailand bbox.
  - `server/lib/gdelt.mjs` — Thailand query branch.
- Frontend panels receive `viewMode` and pass it to fetchers:
  - `HumanitarianPanel`, `AcledAnalytics`, `SentimentChart`, `SeismicPanel` fetch per-theater endpoints.
  - `RefugeePanel` and `ArmsDefensePanel` show region-appropriate fallback / snapshot outside Middle East.
  - `RegionalNewsPanel` and `MaritimeWarningsPanel` use `viewMode` to tune slices and empty-state copy.
- `MapContainer.jsx` passes `viewMode` to FIRMS and ACLED live resources (in addition to flights/vessels).

## Map Stack — what changed in this audit
- **Satellite basemap fixed**: previously pointed at MapTiler with the literal docs placeholder key (`get_your_own_OpIi9ZULNHzrESv6T2vL`) — rendered blank in production. Replaced with an inline ESRI World Imagery raster style (no key required).
- **Tile error handler**: `map.on('error')` is now wired in [MapContainer.jsx](src/components/MapContainer.jsx). Failed sources surface as a small amber "N layers unavailable" badge bottom-right.
- **NASA GIBS redundancy**: every GIBS layer in [eoTiles.js](src/services/eoTiles.js) now uses 3 subdomain mirrors (`gibs`, `gibs-a`, `gibs-b`) for round-robin tile loads.
- **Cursor lat/lng readout**: bottom-left of map. Mono, hairline cyan border, copy-to-clipboard button.
- **Flight & vessel heading vectors**: [MapContainer.jsx](src/components/MapContainer.jsx) renders short course/heading look-ahead lines for flights (yellow/red, 3 min) and ships (category-colored, 2 min). Ships use `course` when available, fall back to `heading`.
- **Vessel backend cache**: `/api/vessels?theater=` now uses a 15-second `useCached` layer to smooth polling and provide a stale snapshot on restart.

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
2. Run migrations in order:
   - [supabase/migrations/001_globalmonitor_news.sql](supabase/migrations/001_globalmonitor_news.sql)
   - [supabase/migrations/002_globalmonitor_loaders.sql](supabase/migrations/002_globalmonitor_loaders.sql)
   - [supabase/migrations/003_globalmonitor_dedup.sql](supabase/migrations/003_globalmonitor_dedup.sql)
3. Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD CONSTRAINT IF NOT EXISTS`).

### Tables created
- `gm_news_items` — per-country/province news cache, de-duped by URL
- `gm_ingestion_runs` — heartbeat log per loader run (for source-health surface)
- `gm_region_visits` — region tab visit telemetry (drives render-prioritisation)
- `gm_acled_events`, `gm_firms_hotspots`, `gm_market_quotes`, `gm_sentiment_readings` — archive tables

All tables have public-read RLS policies. Writes restricted to `service_role`.

### Duplicate-row fix (003 migration)
- `gm_market_quotes` now has a unique constraint on `symbol`; `server/lib/supabase.mjs` upserts instead of inserting duplicates.
- `gm_sentiment_readings` now has a unique constraint on `(query, reading_date)`; upsert keeps one tone reading per query + date.

### Backend ingestion
- [server/lib/supabase.mjs](server/lib/supabase.mjs) — Supabase client singleton + helpers
- [server/lib/regionalNewsIngest.mjs](server/lib/regionalNewsIngest.mjs) — fetches RSS, persists, returns
- API endpoint: `GET /api/regional-news?region=indopacific&code=TH` (or `region=thailand&code=BKK`)
- Health: `GET /api/supabase-health`

### Frontend integration
- [src/services/regionalCountryNews.js](src/services/regionalCountryNews.js) prefers the backend route. Falls back to direct Google News via `allorigins → codetabs → corsproxy.io` if backend is unreachable.

### Adding more loaders to Supabase
Pattern: extend [server/lib/supabase.mjs](server/lib/supabase.mjs) with an `upsertX` function, write an ingestion lib that calls it + `recordIngestionRun()`, add the route to `server/index.mjs`. Existing loaders (FIRMS, ACLED, weather) are good next candidates — they already have `useCached` wrappers in `index.mjs`; piping the cached payload through `upsert` is a one-liner per loader.

## Bundle & dependencies (Phase 4)
- `npm audit` is clean (esbuild pinned to `0.27.2` via `package.json` `overrides` to avoid the Windows-only dev-server advisory; all other moderate+ advisories resolved by `npm audit fix`).
- `App.jsx` and the heavy panel set are code-split with `React.lazy` + `Suspense` via `src/components/LazyPanels.jsx`.
  - Main bundle dropped from ~12.9 MB gzipped to ~350 KB gzipped.
  - `MapContainer` lazy-loads as its own chunk (~12.5 MB gzipped, dominated by map data/layers).
- Build command: `npm run build` (Vite 7 + React Compiler ESLint).

## Human-centered UI polish (v4 usability pass)
- **Operator-first header**: removed visitor count, version string, and `GlobeWatch` code name; collapsed `Sources`, `Log`, `Print`, `About`, `Refresh`, and `Settings` into a single **Tools** dropdown; theater tabs remain the dominant control.
- **Plain-language layers**: sidebar descriptions rewritten as "Aircraft positions", "Ship positions", "Heat signatures", "Conflict events", etc.
- **Clearer toggle states**: active layer cards show a cyan checkmark and filled background; basemap selection uses the same accent treatment.
- **Focus area navigation**: bottom-center region dots get a "Focus area" label and stronger active underline.
- **Map surface cleaned up**: cursor lat/lng readout removed from the default view; failed-source badge shows a human message instead of raw source IDs; `LIVE` pills gently pulse.
- **Settings simplified**: dead `GENERAL`/`PANELS` tabs removed; modal renamed to **News Sources**.
- **Golden-ratio spacing/typography scale** introduced in `src/styles/index.css` (`--phi`, `--sp-phi-*`, `--type-caption/body/title/hero`).

## CI
- `.github/workflows/ci.yml` runs on every push/PR:
  - `npm ci`
  - `npm audit --audit-level=moderate`
  - `npm run lint`
  - `npm run build`
- `.github/workflows/cloudflare-pages.yml` deploys `dist` + `functions/` to Cloudflare Pages project `globalmonitor` (same-origin API, empty `VITE_API_BASE_URL`).
- GitHub Actions may be disabled on the account; if so, deploy Cloudflare manually with Wrangler.

## Ship tracking (AIS)
- Layer wired: toggle **Ship Tracking** in sidebar → `/api/vessels` → merged feed
- **Primary (global)**: `server/lib/aisVessels.mjs` — WebSocket to aisstream.io — worldwide coverage
- **Fleet overlay**: `server/lib/vesselFinder.mjs` — VesselFinder `vesselslist` API for user-tracked fleet
- **GitHub repo (aisstream)**: https://github.com/aisstream/aisstream — free global AIS WebSocket API
- **VesselFinder docs**: https://api.vesselfinder.com/docs/ — `vesselslist` (fleet key), `vessels` (credit key), `livedata` (paid area subscription)
- **Coverage**: aisstream worldwide `[-180,-90] → [180,90]`; VesselFinder free tier = fleet only (0–10 vessels), NOT worldwide LiveData
- **Requires env vars**:
  - `AISSTREAM_API_KEY` — free at https://aisstream.io/authenticate (global map)
  - `VESSELFINDER_FLEET_KEY` — fleet subscription key for vesselslist overlay
  - `VESSELFINDER_API_KEY` — credit-based container key (per-vessel lookups; optional, not used for map)
- Local: keys in `.env.local` (gitignored via `*.local`) — restart `npm run dev:stack`, allow ~60s AIS WebSocket warmup
- Without keys: layer shows legend "AIS key required"; API returns empty FeatureCollection with `meta.requiresKey: true`
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
