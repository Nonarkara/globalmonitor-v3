# GlobeWatch preview repair — draft review

Base: `Nonarkara/globalmonitor-v3` main at `c59e2000`. Scope is the flagship, not AsiaWatch or the historical host. No deploy, scheduled run, production setting, dependency upgrade, or reporting endpoint.

The grid uses a 52px identity/action strip, a map track that gets the remaining working height, and the existing theater dock. Intel and Layers mount on request. The full board, ticker, clock, history controls, research, Manual, Papers, About and map layers remain available. Sources is a disclosure; credit and cursor occupy separate bottom slots. This follows decision geometry: the no-signal state cannot determine the map's vertical position.

## Evidence

- Chromium local Vite preview, 390×844, synthetic unavailable API responses: map top moved from about 402px on the base checkout to 52px; map rectangle grew from about 338px to 744px. In the same short sample the number of requested API calls fell from 76 to 10; this is a failure-state comparison, not a live network benchmark. A separate live smoke test found the same class of problem with the map starting at 684px.
- `scripts/check-preview-layout.mjs`: widths 320, 375, 390, 768, 1023, 1024, 1025, 1440; header 52px, dock 49px, geometric map share 84.6–88.8%, sampled clear map share 83.5–89.5%. Tested Sources, Layers, Intel, Tools, keyboard focus and Escape. Reintroduced a 120px map in the browser; the same gate rejected it.
- `npm test`: 19 pass, including the 24h archive boundary, absent timestamp, inactive fallback timestamp, unavailable rate-limit response and a compiled fixture with deliberately restored official-use wording that the guard rejects. The production build invokes the compiled-bundle guard after build.
- Aircraft popup class normalization was already present in this base; no MapLibre migration or new popup implementation was made. Existing PR #6 overlaps MapContainer and must be integration-tested before merge. Live traffic payloads, actual hover over live features, and live feed freshness are not certified.
- The flagship README already names its canonical host. The AsiaWatch-only scheduled snapshot workflow is not in this repo. No homepage, workflow, or CDN setting changed.

## Independent review and dispositions

1. **Closed:** at narrow widths the initial refactor hid critical escalation. The compact alert slot restores it; reviewer observed synthetic score 80 at 390, 1024, 1025 and 1440px.
2. **Closed for tested viewport:** enlarged text previously clipped labels. At 320×568 with a doubled root text size, the title stays visible, the dock scrolls within itself and labels fit their targets without page overflow.
3. **Closed for tested viewports:** at 320×844 the cursor ends 2px above attribution (cursor bottom 740, attribution top 742). At 1025/1440 the old desktop board intercepted Sources and the ticker covered attribution. After using the same docked grid on desktop, the reviewer confirmed both controls hit and toggled independently with fixture tiles, and the clock and ticker were present inside Intel. Public tile interaction was not fully verified.
4. **Closed:** Layers and Intel focus their Close buttons and restore the trigger on Escape.

## Before merge

Verify public basemap/traffic-layer interaction after integration with PR #6, check a returning service-worker session, and exercise print and physical-device paths. The owner must separately approve any merge or deployment. No live fix is claimed by a draft PR. Community intake stays out of scope.
