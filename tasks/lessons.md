# Lessons · Globalmonitor / Conflict Tracker v3

Corrections log. Updated after every mistake. **Read at the start of every session.**
Per §13: the same mistake never happens twice.

---

## 2026-05-26 · Bootstrap: §13 adopted

- **What went wrong:** n/a — first entry
- **Correct behaviour:** Log every correction here. Read before each session.
- **How to recognise:** Any time you repeat a fix you've already made.

---

## 2026-05-26 · Single source of truth for theater config is src/data/regions.js

- **What went wrong:** n/a — reminder
- **Correct behaviour:** All three theater regions (Middle East, Indo-Pacific, Thailand) are defined in `src/data/regions.js`: viewStates, dot data, news queries, TV channels. Edit there and it propagates. Never hardcode region data elsewhere.
- **How to recognise:** New theater region added elsewhere but not in regions.js = data inconsistency.

---

## 2026-05-26 · Supabase tables prefixed gm_ (shared with geopolitics project)

- **What went wrong:** n/a — reminder
- **Correct behaviour:** Globalmonitor reuses the geopolitics-dashboard Supabase project (qbatksnulitgrhigzbta). All tables are prefixed `gm_` to avoid collisions. The GM_SUPABASE_SERVICE_KEY is in the geopolitics .env file.
- **How to recognise:** Supabase queries touch geopolitics tables = missing `gm_` prefix.

---

## 2026-05-26 · ESRI basemap requires no key — MapTiler placeholder was broken in prod

- **What went wrong:** Satellite basemap used MapTiler with a literal docs placeholder key (`get_your_own_OpIi9ZULNHzrESv6T2vL`). Rendered blank in production.
- **Correct behaviour:** Use the inline ESRI World Imagery raster style which requires no API key. Already fixed in MapContainer.jsx.
- **How to recognise:** Blank basemap in production despite working locally = key placeholder issue.

---

<!-- FORMAT for future entries:
## YYYY-MM-DD · [short title of the mistake]
- **What went wrong:** ...
- **Correct behaviour:** ...
- **How to recognise this pattern:** ...
-->
## 2026-06-20 · "Stale deploy" mis-call from grepping the wrong chunk
- **What went wrong:** Concluded the live Cloudflare deploy was stale (missing the animated ships/flights work) after grepping only `index-*.js` for layer-ID markers (`flight-paths-lines`, etc.) and finding them absent.
- **Correct behaviour:** Vite code-splits — `MapContainer.jsx` ships as its own lazy chunk. The markers were in `MapContainer-*.js`, not `index`. Fetching the live MapContainer chunk showed it byte-identical (same SHA) to a fresh build: the deploy was current, not stale.
- **How to recognise:** Before declaring a bundle stale, grep ALL `dist/assets/*.js` for the feature marker to find its real chunk, then compare that chunk's hash/SHA to the live one. Same hash = same code. The index chunk rarely contains route/lazy-loaded component code.

## 2026-06-20 · Why the ships/flights "wow" was never visible
- **Root cause (two layers):** (1) Live frontend is fine, but it calls the Fly backend, which runs STALE code — `/api/flights` works, `/api/vessels` does not exist there (vessel endpoint added in later commits; `fly deploy` is billing-blocked). So ships show "Awaiting AIS feed" live while flights flow. (2) `eo-aerosol` was in the default `activeLayers` (App.jsx) at 0.55 opacity over bright MODIS-AOD tiles — an opaque orange blanket that buried the (working) flight icons.
- **Correct behaviour:** Diagnose the live data path end-to-end (curl each /api endpoint WITH the prod Origin, check CORS + content-type) before touching rendering. A `200` is hollow if content-type is text/html (SPA fallback).
- **How to recognise:** "Feature invisible on live but works locally" → first suspect the deployed backend lacks the endpoint (stale host) or the frontend points at a dead same-origin API, not the rendering code.
