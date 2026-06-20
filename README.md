# Globalmonitor v3

Global Political Dashboard / GlobeWatch v8.3: a React + Vite geopolitical intelligence dashboard with a lightweight Node API cache layer for the most time-sensitive panels.

It combines live map layers, flight and vessel tracking, market context, humanitarian indicators, regional news, and structured intelligence briefings so planners can read conflict, climate, mobility, and policy signals as one operating picture.

## Live Status

- Current source repo: `Nonarkara/globalmonitor`
- Clean v3 mirror: `Nonarkara/globalmonitor-v3`
- Live static frontend: `https://globalmonitor.pages.dev`
- API backend: `https://globalmonitor.fly.dev`

As of 2026-06-20, the Cloudflare Pages frontend is current, but the Fly backend is still an older deployment because Fly blocks new releases until billing/payment information is added. Local development is the authoritative full-stack verification path until Fly is unblocked.

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
- Ship positions via AIS/VesselFinder feeds, with map heading vectors
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

Primary evaluation: `npm run dev:stack` (frontend **5180**, API **4000**). Do not treat `globalmonitor.fly.dev` as current until a Fly release succeeds.

If you want to run them separately:

```bash
npm run api
npm run dev
```

Build for production:

```bash
npm run build
```

Deploy the current static frontend to Cloudflare Pages:

```bash
VITE_API_BASE_URL=https://globalmonitor.fly.dev npm run build
npx wrangler pages deploy dist --project-name=globalmonitor --branch=main --commit-dirty=true
```

Deploy the full backend/frontend image to Fly after billing is unblocked:

```bash
fly deploy --remote-only -a globalmonitor
```

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

- Key live panels now prefer the backend API at `/api/*`, which adds caching and returns live or stale payloads explicitly.
- The frontend still has browser-side fallbacks, so the dashboard keeps working while the backend is unavailable.
- Flight traffic uses a conservative cache-first strategy to protect free API quotas. aviationstack is Middle-East bounded and cached server-side.
- Heavy panels and the map are code-split with `React.lazy` so the initial app bundle stays small while the map chunk loads separately.
