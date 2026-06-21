# Globalmonitor v3

Global Political Dashboard / GlobeWatch v8.3: a React + Vite geopolitical intelligence dashboard with a lightweight Node API cache layer for the most time-sensitive panels.

It combines live map layers, flight and vessel tracking, market context, humanitarian indicators, regional news, and structured intelligence briefings so planners can read conflict, climate, mobility, and policy signals as one operating picture.

## Live Status

- Current source repo: `Nonarkara/globalmonitor`
- Clean v3 mirror: `Nonarkara/globalmonitor-v3`
- **Production URL**: `https://globalmonitor.pages.dev` — static frontend + API via Cloudflare Pages Functions (same origin)
- Legacy static backup: `https://nonarkara.github.io/globalmonitor/`

## Design / Human Walkthrough

The 2026-06-20 Rams-style usability pass is documented in [`docs/human-walkthrough-2026-06-20.md`](docs/human-walkthrough-2026-06-20.md).

Key outcomes:

- Header utility controls now live behind a labeled Tools menu instead of icon-only discovery or a crowded header.
- Basemaps, operational layers, mobility layers, environmental layers, satellite catalogs, and source agencies are separated into clearer control groups.
- Satellite and source-agency catalogs are behind deliberate disclosure controls to reduce first-load command overload.
- Panels and modals use flatter surfaces, sharper geometry, and natural-color sponsor logos on white pills.
- Source Health and Settings modals now expose modal-specific close labels for keyboard, screen-reader, and QA automation paths.

## What It Tracks

- Conflict and humanitarian hotspots via ACLED, curated fallbacks, UNHCR, and ReliefWeb
- Flight positions via airplanes.live, OpenSky, and optional aviationstack supplement
- Ship positions via VesselFinder fleet overlay (Pages) or AIS WebSocket (local Node API)
- NASA FIRMS thermal anomalies and NASA GIBS environmental/satellite overlays
- Weather and air quality via Open-Meteo
- Seismic activity via USGS
- Market radar, energy/oil indicators, sanctions, and defense panels
- Topic-based intelligence briefings for:
  - Middle East conflict, Hormuz, energy, and diplomacy
  - Southeast Asia / Indo-Pacific security and maritime issues
  - Thailand security, border, depa, MDES, and tech ecosystem monitoring

## Run Locally

```bash
npm install
npm run dev:stack
```

This starts:

- frontend on `http://127.0.0.1:5180`
- API cache layer on `http://127.0.0.1:4000`

Primary evaluation: `npm run dev:stack` (frontend **5180**, API **4000**).

If you want to run them separately:

```bash
npm run api
npm run dev
```

Build for production:

```bash
npm run build
```

Deploy to Cloudflare Pages (frontend + API):

```bash
npm run deploy:pages
```

Or manually:

```bash
npm run build
npx wrangler pages deploy dist --project-name=globalmonitor --branch=main --commit-dirty=true
```

The build uses same-origin `/api/*` (empty `VITE_API_BASE_URL`). Pages Functions in `functions/` serve the API layer.

## Copernicus Sentinel Starter

The dashboard now includes a sidebar Sentinel control that automatically chooses between:

- `LIVE`: Copernicus Data Space Sentinel Hub Process API when credentials exist
- `PUBLIC`: built-in public EO fallback layers for optical and vegetation views when credentials are missing

Set these environment variables before starting the Node API:

```bash
export COPERNICUS_CLIENT_ID=your-client-id
export COPERNICUS_CLIENT_SECRET=your-client-secret
```

The backend exposes:

- `GET /api/copernicus/preview?theater=middleeast&preset=true-color`
- `GET /api/copernicus/preview?bbox=99.65,13.2,101.55,14.45&preset=ndvi`

Supported query params:

- `theater`: `middleeast` or `depa`
- `bbox`: `west,south,east,north` in `EPSG:4326`
- `preset`: `true-color` or `ndvi`
- `from`, `to`: ISO datetimes
- `lookbackDays`, `maxCloudCoverage`, `width`, `height`

Notes:

- It uses `sentinel-2-l2a`.
- Results are cached in the local API for 20 minutes.
- When credentials are missing, the UI still works by switching to the public fallback overlays.
- Strategic reference corridors/zones are now behind a dedicated `Strategic Context` toggle.
- The Copernicus branch is an area preview, not a slippy-map tile service.

## Current Architecture Notes

- Key live panels prefer the backend API at `/api/*`, which adds caching and returns live or stale payloads explicitly.
- Production: Cloudflare Pages serves static assets from `dist/` and API routes from `functions/` (same origin at `globalmonitor.pages.dev`).
- Local dev: Node server on port 4000 with full AIS WebSocket support; Vite proxies `/api` on port 5180.
- The frontend still has browser-side fallbacks, so the dashboard keeps working while the backend is unavailable.
- Flight traffic uses a conservative cache-first strategy to protect free API quotas. aviationstack is Middle-East bounded and cached server-side.
- Heavy panels and the map are code-split with `React.lazy` so the initial app bundle stays small while the map chunk loads separately.

## Cloudflare Pages API caveats

- **Flights, markets, ACLED, FIRMS, rainviewer, etc.**: served by Pages Functions (`functions/_lib/router.mjs`).
- **Global AIS WebSocket** (aisstream.io): requires long-running Node process — available in `npm run dev:stack` only. On Pages, configure `VESSELFINDER_FLEET_KEY` for fleet ship overlay.
- **Secrets**: bind env vars in Cloudflare Pages project settings (OpenSky, Supabase, Copernicus, VesselFinder, etc.).
