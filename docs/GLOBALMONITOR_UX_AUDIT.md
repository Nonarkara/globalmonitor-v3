# Globalmonitor UX Audit — Principles from COMMERCIAL_AUDIT.md

**Date:** 2026-06-21  
**Scope:** Production dashboard at https://globalmonitor.pages.dev/  
**Method:** Human click-through + API verification (Horizon45 audit methodology, adapted)

---

## Portable Principles Applied

| COMMERCIAL_AUDIT principle | Globalmonitor application | Status |
|---|---|---|
| **Phase 1 ship blockers — verify every control** | Manual walkthrough of header, sidebar layers, map toggles, modals | Done (see table below) |
| **Toggle/state sync** (like double-submit prevention) | Single `activeLayers` source in `App.jsx`; sidebar mini-actions, layer cards, FlightRadarEmbed, map legend share one state | Fixed |
| **Skip-link / a11y** | `#main-content` + `.skip-link` in `index.html`; focus position accounts for classification banner | Pass |
| **Fixed layout slots** — no expanding boxes | Header `min-height`/`overflow: visible`; `#root` padded for classification bands; grid panel heights constrained | Fixed |
| **Verify before claim** | All counts verified via `curl` on production URL in deploy session | Done |

**Not imported from Horizon45:** Elo quiz, repo library, GAS script, AdaptiveQuizView, onboarding modals, sound design.

---

## Root Causes (2026-06-21)

### Planes not showing
1. **API:** Sequential airplanes.live fetches (1.5 s gaps × 5 points) exceeded Cloudflare Workers wall-clock; cache stored sparse payloads (1 aircraft for Middle East).
2. **Fix:** Staggered parallel fetches in `server/lib/airplanesLive.mjs`; cache key `flights:v2:*` with minimum count validator in `functions/_lib/router.mjs`.
3. **Map:** Icon load race before `onLoad` — fixed with `handleMapLoad` + `loadMapIcons` callback in `MapContainer.jsx`.
4. **Follow-up, 2026-06-21:** The live endpoint stayed healthy during an 85 s production watch, but the UI could still flash an error on cold reloads or transient bad polls because the frontend accepted only the current request result. `src/services/flights.js` now persists the last valid FeatureCollection per theater and returns it as a clearly marked `client-flight-fallback` snapshot when a request times out, errors, or returns an empty collection. `MapContainer.jsx` labels this as `ADS-B stale` instead of removing the aircraft layer.

### Ships not showing
1. **API:** Pages has no long-running AIS WebSocket; production had no `AISSTREAM_API_KEY` or `VESSELFINDER_FLEET_KEY` bound.
2. **Fix:** One-shot AIS WebSocket snapshot in `functions/_lib/aisSnapshot.mjs` (Pages-safe, 6 s collect window).
3. **Remaining:** Bind `AISSTREAM_API_KEY` in Cloudflare Pages project secrets for live vessel overlay on production.

### Header cut off / imbalance
1. **Layout:** Fixed classification banners (18 px) overlapped grid row 1; header used rigid 60 px + `overflow: hidden`.
2. **Fix:** `#root` padding for classification bands; header grid uses `minmax(0, …)` columns and `overflow: visible`.

---

## Production API Verification

```bash
curl -sf "https://globalmonitor.pages.dev/api/flights?theater=middleeast" \
  | jq '{n: (.features|length), source: .meta.source}'
# → n: 204, source: airplanes.live

curl -sf "https://globalmonitor.pages.dev/api/vessels?theater=middleeast" \
  | jq '{n: (.features|length), requiresKey: .meta.requiresKey}'
# → n: 0, requiresKey: true (awaiting Cloudflare secret bind)
```

---

## Human Walkthrough (Production)

| Control | Expected | Result |
|---|---|---|
| Homepage load | HTTP 200, map + panels visible | **Pass** |
| Classification banner | Top + bottom FOUO strip, content not clipped | **Pass** (after padding fix) |
| Skip link (Tab) | Focus moves to `#main-content` below banner | **Pass** |
| Region tabs (ME / Indo-Pacific / Thailand) | Camera + panels swap | **Pass** |
| Sidebar → Flights layer card | Toggles ADS-B layer; legend + map dots sync | **Pass** |
| Sidebar → Ships layer card | Toggles AIS layer; legend shows key hint when unconfigured | **Pass** (data pending secret) |
| Sidebar → Flights / Ships mini-buttons | Same state as layer cards | **Pass** |
| FlightRadarEmbed toggle | Syncs with flights layer + sidebar | **Pass** |
| Live Airspace count | Matches API aircraft count when layer on | **Pass** (204 aircraft) |
| Map traffic legend | Shows aircraft count when flights on | **Pass** |
| Flight transient-failure fallback | Holds last valid aircraft snapshot instead of clearing layer | **Pass** |
| Tools → About modal | Opens credits + legal | **Pass** |
| Tools → Manual | Opens system manual | **Pass** |
| Reset defaults (sidebar) | Restores conflicts/firms/flights/vessels | **Pass** |

---

## Next Ship Blocker

Bind `AISSTREAM_API_KEY` on Cloudflare Pages (`wrangler pages secret put AISSTREAM_API_KEY --project-name globalmonitor`) to enable vessel snapshot on production. Local dev already works via `npm run dev:stack`.
