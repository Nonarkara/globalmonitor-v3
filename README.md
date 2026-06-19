# Tech Monitor

A React + Vite dashboard for urban operations monitoring, with a lightweight Node API cache layer for the most time-sensitive panels.

It combines map layers, market context, and structured intelligence briefings so planners can read transport, climate, conflict, and policy signals as one operating picture.

## What It Tracks

- Natural disasters via NASA EONET
- Conflict and humanitarian hotspots via curated signals plus ReliefWeb fallback
- Weather and air quality via Open-Meteo
- Macro growth baselines via the World Bank API
- Crypto, FX, and reference commodities
- Topic-based intelligence briefings for:
  - Iran flight and conflict disruption
  - Thailand digital and city programs
  - Urban systems and mobility
  - Urban politics and governance

## Run Locally

```bash
npm install
npm run dev:stack
```

This starts:

- the frontend on `http://127.0.0.1:5180`
- the API cache layer on `http://127.0.0.1:4000`

Primary evaluation: `npm run dev:stack` (frontend **5180**, API **4000**). `globalmonitor.fly.dev` is optional and stale unless you deploy (Fly billing). Static backup: build with `--base=/globalmonitor/` then `npx gh-pages -d dist` (no npm script in package.json yet).

If you want to run them separately:

```bash
npm run api
npm run dev
```

Build for production:

```bash
npm run build
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
- For production-grade flight and traffic monitoring, add dedicated APIs such as OpenSky, FlightAware, GTFS Realtime, and TomTom instead of relying only on media feeds.
