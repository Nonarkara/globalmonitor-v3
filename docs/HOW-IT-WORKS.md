# How Global Monitor v3 works

Companion to the public [README](../README.md). This page is the longer architecture note so the README can stay civic, not a dump of endpoints. Only fetchers and routes that exist in `server/` and `functions/` are listed.

This is the **GlobeWatch** flagship tree (`Nonarkara/globalmonitor-v3`). The sibling [`Nonarkara/globalmonitor`](https://github.com/Nonarkara/globalmonitor) is a separate codebase (AsiaWatch / independent OSINT map). Do not copy deploy project names, env templates, or npm scripts from one tree onto the other.

## Shape

```
External open feeds
  ACLED, NASA FIRMS, NASA GIBS, GDELT, EIA, USGS,
  ADS-B (airplanes.live → adsb.lol → committed snapshot),
  AIS (aisstream WebSocket locally; Axiom Overwatch REST + snapshot on Pages),
  RSS / ReliefWeb / UNHCR, Open-Meteo, Copernicus (optional)
        │
        ▼
server/lib/*.mjs          local Node API (port 4000)
functions/_lib/*.mjs      Cloudflare Pages Functions (same-origin /api)
        │
        ▼
useCached(key, ttl, loader, validator)
  in-memory Map, TTL, stale fallback, X-Tech-* headers
        │
        ▼
/api/* JSON
        │
        ▼
src/services/*.js  →  useLiveResource (localStorage, retry, stale badge)
        │
        ▼
MapLibre map + React panels
  DataStatus shells stay visible when a feed is down
```

Production: Cloudflare Pages serves `dist/` and `functions/` for project **`globalmonitor`**. Local: `npm run dev:stack` (Vite **5180**, API **4000**, `/api` proxied). The frontend keeps browser-side fallbacks so the layout does not punch holes when the API is away.

`server/index.mjs` and `functions/_lib/router.mjs` duplicate response-shaping; both import the same `server/lib/*.mjs` fetchers. Fetch-level fixes apply to both backends; header/status shaping must be edited in both places.

## Theaters

Single source of truth: [`src/data/regions.js`](../src/data/regions.js).

| Theater id | Label | Default hostname |
| --- | --- | --- |
| `middleeast` | Middle East | `globalmonitor.nonarkara.org` |
| `indopacific` | Indo-Pacific | — |
| `thailand` | Thailand | — |
| `global` | Global | `global.nonarkara.org` |

`VITE_DEFAULT_THEATER` in [`.env.example`](../.env.example) is only a fallback when the hostname is unrecognized (local preview). One build serves every domain.

## What is measured, what is modelled

| Kind | Examples in this repo | Treat as |
| --- | --- | --- |
| Observation | NASA FIRMS, NASA GIBS tiles, USGS quakes, AIS, ADS-B, Open-Meteo | Measured, with sensor and reporting bias |
| Coded event | ACLED, ReliefWeb / UNHCR, GDELT tone | Human- or machine-coded from public reporting |
| Compiled | Sanctions, nuclear sites, actor networks, war-economy JSON under `src/data/` | Analyst-curated snapshots |
| Modelled | Oracle Monte-Carlo forecast (`server/lib/oracle/`), escalation composite, TimesFM event-count files (`public/data/timefm/`), AlphaEarth change (`public/data/alphaearth/`) | Model output — not official intelligence |

Oracle narration is a deterministic template by default. An optional Groq rewrite exists in code when a host key is bound; that key is **not** in `.env.example` and is not required to run the panel.

The in-app Data Provenance modal reads [`src/data/dataSources.json`](../src/data/dataSources.json). Reliability ratings there are editorial, not a government grade.

## Optional credentials

All keys are optional. Template: [`.env.example`](../.env.example). Obtain them from the named public providers; do not scrape or guess.

| Variable | In `.env.example` | Enables when set |
| --- | --- | --- |
| `COPERNICUS_CLIENT_ID` / `COPERNICUS_CLIENT_SECRET` | yes | Sentinel-2 L2A area preview (`/api/copernicus/preview`) — otherwise the UI uses public EO fallbacks |
| `AISSTREAM_API_KEY` | yes | Live AIS WebSocket on the **local** Node API only |
| `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | yes | Authenticated OpenSky |
| `AVIATIONSTACK_API_KEY`, `AVIATION_EDGE_KEY` | yes | Quota-limited flight supplements, cached server-side |
| `ACLED_API_KEY` / `ACLED_EMAIL` | yes | Direct ACLED pulls (both required); without them, theaters serve demo/fallback events |
| `EIA_API_KEY`, `FIRMS_MAP_KEY` | yes | Direct provider pulls (public or snapshot fallbacks exist) |
| `GM_SUPABASE_*`, `GOOGLE_SHEETS_*` | yes | Optional recording — not required to render the map |
| `VESSELFINDER_FLEET_KEY` | no | Pages fleet overlay. Bind it in the Cloudflare dashboard if you have a VesselFinder fleet subscription; it is not templated in `.env.example` |

Never expose secrets as `VITE_*`. Pages Functions read host-dashboard bindings. Production may bind additional provider keys that are not on disk; they are not required to fork.

Copernicus preview query params that exist in code: `theater` (`middleeast` or `depa`), `bbox` (`west,south,east,north` in EPSG:4326), `preset` (`true-color` or `ndvi`), optional `from` / `to` / `lookbackDays` / `maxCloudCoverage` / `width` / `height`. It is an area preview, not a slippy-map tile service. Cache TTL is 20 minutes on the local API.

## Production caveats (as implemented)

- **AIS WebSocket** needs a long-running Node process (`npm run dev:stack`). Cloudflare Pages uses the Axiom Overwatch REST snapshot (CC-BY 4.0, [axiomoverwatch.io](https://axiomoverwatch.io)) when that collector is unavailable; VesselFinder is an optional fleet overlay, not a global map; a committed AIS asset lives under `public/data/ais/`.
- **Flights.** airplanes.live may 403 unregistered callers; the loader falls through to **adsb.lol** (same readsb v2 API, keyless). Each theater fetch has a wall-clock deadline; if nothing answers, `/api/flights` serves `public/data/flights/adsb-snapshot.geojson`, cut to the theater bbox and labelled `stale: true`. `npm run refresh:flights` rewrites that snapshot (wired into `deploy:pages`).
- Isolate memory on Pages is empty on a cold start. Heavy layers therefore also ship snapshot files under `public/data/`.
- **RainViewer.** `api.rainviewer.com` may timeout from the Workers edge; the weather-radar layer can show stale or empty from Pages even when local Node is fine.

Deploy: GitHub Actions (`.github/workflows/cloudflare-pages.yml`) builds with empty `VITE_API_BASE_URL` and deploys to Pages project **`globalmonitor`**. The npm script `deploy:pages` uses the same project name.

## Related notes in this tree

- [`docs/RAMS-STYLE.md`](RAMS-STYLE.md) — Dieter Rams operating-system tokens
- [`docs/human-walkthrough-2026-06-20.md`](human-walkthrough-2026-06-20.md) — Rams-style usability pass
- [`src/data/originEssay.js`](../src/data/originEssay.js) — origin essay and four-system identity card
- [`src/data/dataSources.json`](../src/data/dataSources.json) — provenance table the Source Health modal reads
