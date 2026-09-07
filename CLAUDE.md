# Global Political Dashboard — Project Instructions for Claude

This file captures everything Dr Non wants for this project suite. Read it before writing any code.

---

## Who Is Dr Non

Dr Non Arkaraprasertkul — architect (MIT), anthropologist (Harvard), smart city specialist at Thailand's depa. He does not write code. He designs systems from first principles and evaluates everything on **live deployed URLs**, never localhost. He ships constantly, context-switches between 25+ projects, and communicates through documentation. He works exclusively in Claude Code sessions.

**Co-creator**: Associate Professor Dr. Poon Thiengburanathum — public ranking model and urban performance methodology.

---

## What This Project Is

A suite of **4 real-time geopolitical intelligence dashboards** monitoring the Middle East conflict (Iran-Israel war starting 2026-02-28). Funded by PMUA (primary), depa, with execution by Axiom and ReTL.

### The 4 Dashboards

| Name | Repo | Live URL | Stack | Purpose |
|------|------|----------|-------|---------|
| **GPD** (Global Political Dashboard) | `Nonarkara/globalmonitor` | `globalmonitor.pages.dev` | React 19 + Vite + MapLibre + D3 + Pages Functions API | Flagship — 43 components, 12 live data sources, full intelligence platform |
| **MEM by NON** | `Nonarkara/mem-by-non` | `nonarkara.github.io/mem-by-non` | Vanilla HTML/JS/CSS + Leaflet | Cinematic HUD war room — full-screen map with floating glass overlays |
| **War Monitor** | `Nonarkara/middleeast-monitor` | `middleeast-monitor.pages.dev` | Vanilla HTML (8800-line monolith) + Leaflet + Chart.js + TradingView | Dense public-facing conflict tracker — Dr Non called it "gold" |
| **Static Backup (GPD)** | same repo, `gh-pages` branch | `nonarkara.github.io/globalmonitor` | Static build of GPD | Backup when dynamic hosts are down |

### Branch Structure (all in `Nonarkara/globalmonitor`)
- `main` — GPD v8+ (most complete, actively developed)
- `v5-render-original` — historical Render-era version
- `v6-batman` — historical V6 super dashboard
- `middleeast-war-monitor` — War Monitor source snapshot
- `mem-by-non` — MEM source snapshot
- `agency` — historical DEPA/agency mode

---

## Hosting Strategy (Cost-Conscious)

*Rewritten 2026-08-17. The "primary = this laptop + tunnel" arrangement below it is
gone — that tunnel went dark and served a frozen build for weeks. Nothing production
depends on a local machine any more.*

**Repo:** `Nonarkara/globalmonitor-v3` (this checkout: worktree `conflict-tracker/v3-classic`,
branch `classic` tracking `v3/main`). This is Dr Non's **flagship** — the dense Rams
instrument-panel version with per-theater live aircraft + ships, TV, Oracle, sanctions.

| Platform | Used For | Status |
|----------|----------|--------|
| **Cloudflare Pages `globalmonitor`** | GPD flagship — frontend + Pages Functions API. Domains: **globalmonitor.nonarkara.org**, globalmonitor.pages.dev | **Primary/live.** Secrets bound: AIRLABS_API_KEY, AISSTREAM_API_KEY, VESSELFINDER_FLEET_KEY (Airlabs exists ONLY here — not on disk). Deploy: `npm run deploy:pages` (refreshes the ADS-B snapshot, builds, deploys). |
| Cloudflare Pages `asiawatch` | Asia build (`Nonarkara/globalmonitor` main) → asia.nonarkara.org | Live, separate codebase |
| Cloudflare Pages `globalmonitor-me` | World console (`globalmonitor` branch `middleeast`) → global.nonarkara.org | Live, separate codebase |
| Cloudflare Pages `mem-by-non` | MEM → mem.nonarkara.org (its API base is global.nonarkara.org/api) | Live |
| Local laptop + tunnel | — | **Retired 2026-08-17.** Do not point production at a tunnel again. |
| Fly.io / Render / Vercel / Netlify | — | Dead or retired |

**Live flight data on the edge:** airplanes.live now 403s unregistered callers; the
loader falls through to **adsb.lol** (same readsb v2 API, keyless, answers from the
Cloudflare edge). Each theater fetch has an 11 s wall (partial live beats a browser
timeout); if nothing answers, `/api/flights` serves the committed
`public/data/flights/adsb-snapshot.geojson`, cut to the theater and labelled
`stale: true`. Ships: Axiom Overwatch REST + VesselFinder fleet + committed AIS asset.

**Rule**: Always have a deployment plan that doesn't require payment — and one that
doesn't require a laptop to be awake.


---

## Sponsor Logo Requirements

All dashboards MUST display these logos in the header:
1. **PMUA** (`pmua-logo.webp`) — PRIMARY funder, largest logo
2. **depa** (`depa-logo.png` — renamed 2026-08-17; the old name had a space and 404'd behind SPA fallbacks)
3. **Axiom** (`axiom-logo.png`) — execution partner
4. **ReTL** (`retl-logo.svg`) — execution partner (The Reason to Live Company)

**Logo display rules:**
- White rounded pill container (`background: #fff; padding: 3px 8px; border-radius: 5px`)
- NO CSS filter hacks (`brightness`, `invert`) — they make logos invisible on dark backgrounds
- Natural colors on white background, always visible
- Logo assets hosted on GitHub Pages: `https://nonarkara.github.io/globalmonitor/`
- MEM and War Monitor load logos from that URL (cross-origin)
- GPD loads from local `/` paths with `import.meta.env.BASE_URL` prefix (for GitHub Pages base path)
- Only ONE logo strip — in the header bar. NOT duplicated in the sidebar.

---

## About Modal (Required on All Dashboards)

Every dashboard has an `ℹ` or `i` button that opens a modal with:

### Structure:
1. **"FUNDED BY"** — PMUA logo large + full name
2. **Supporting organizations** — depa, MDES, Smart City Thailand logos
3. **"EXECUTED BY"** — Axiom + ReTL logos
4. **Project description** — title + version
5. **Credits paragraph** — mentions PMU A, depa, Axiom, ReTL
6. **Creator bios**:
   - Dr. Non Arkaraprasertkul — architect, urban designer, smart city specialist; Harvard-affiliated doctoral researcher in anthropology and cities focused on human-centered smart cities and real-world implementation
   - Associate Professor Dr. Poon Thiengburanathum — public ranking model designed to explore alternative ways of understanding urban performance
7. **Intersection statement**: "Their work sits at the intersection of urban design, data, and human behavior, bringing a distinctly people-centered perspective to how cities are measured and experienced."
8. **Legal fine print**:
   - IP owned by Dr. Non + Dr. Poon, all rights reserved
   - OSINT disclaimer (not official government intelligence)
   - No liability for decisions made based on this information
   - No unauthorized reproduction, redistribution, reverse engineering, or bad faith use
   - May be subject to legal action under applicable IP laws

---

## Design Philosophy

> **DESIGN SYSTEM (current): Dieter Rams "Operating System".** As of 2026-06-21 the
> suite was overhauled from the old dark tactical-glass look to a light, warm-neutral,
> near-monochrome Rams instrument-panel system. The full spec lives in
> `RAMS-STYLE.md` (Downloads). This supersedes the dark-theme / glass guidance below.
> If you are tempted to add a dark panel, a gradient, a shadow, or a second accent
> colour — don't. Less, but better.

### What Dr Non Wants (Rams system)
- **Less, but better** — every element earns its place; the hairline grid does the work
- **Light, warm-neutral, near-monochrome** — paper `#faf9f7`, white cells, ink `#191712`
  text, hairlines `#e7e5dd`. Tokens are in `src/styles/index.css` `:root`
  (`--paper --panel --ink --ink-2 --ink-3 --line --line-2 --green --red`)
- **One signal colour** — Braun green `#1f6e43` (live / positive / primary action).
  Red `#a23a26` for loss / severity ONLY. Everything else is grey/ink. No other hue.
- **No glass** — no `backdrop-filter`, no shadows, no gradients, no blur
- **Square corners** — 0px (the `--radius-*` tokens are 0; `50%` only for dots)
- **Hairline cell grids** — the signature: line-coloured background, 1px gaps, white cells
- **Helvetica Neue** grotesque everywhere, **tabular-nums** so figures align in columns
- **Labels** = small + UPPERCASE + letterspaced (700 / 0.16em); big numbers ≤ weight 600
- **Real data only** — every number sourced, no placeholder/hallucinated content
- The map is the light **positron** ("Paper") basemap; traffic icons are ink/green

### Anti-Patterns (Hard Rejects)
- Reverting to the dark theme / glass morphism / blur / shadows / gradients
- A second accent colour, or decorative colour where grey + weight would do
- Rounded corners (except dots), pills with glow, AI-blue (#3B82F6)
- Duplicate UI elements (two logo strips, redundant panels)
- Logos with CSS filter hacks that make them invisible
- Empty panels / blank space (fill everything or remove the panel)
- "Awaiting data..." forever with no fallback
- `return null` when data unavailable (creates grid holes) — always render a shell

### 72-Inch Display Optimization
All dashboards use fluid font scaling:
```css
html { font-size: clamp(13px, 1.15vw, 24px); }
@media (min-width: 2560px) { html { font-size: clamp(16px, 1.1vw, 28px); } }
@media (min-width: 3840px) { html { font-size: clamp(20px, 1vw, 32px); } }
```
This scales ALL rem-based elements proportionally for any screen size.

---

## Technical Architecture

### GPD Data Flow
```
External APIs (ACLED, NASA FIRMS, GDELT, EIA, RSS feeds, Yahoo Finance, HII/ThaiWater flood telemetry)
    ↓
server/lib/*.mjs (fetcher modules)
    ↓
server/index.mjs → useCached(key, ttl, loader, validator)
    ↓ (in-memory Map cache with TTL + stale fallback)
/api/* endpoints (JSON + X-Tech-* headers)
    ↓
src/services/*.js (frontend proxies via backendClient.js)
    ↓
useLiveResource hook (localStorage cache, retry, stale detection)
    ↓
DataStatus wrapper (loading skeleton, error state, stale badge)
    ↓
Component renders
```

### Key Constants
- `WAR_START = new Date('2026-02-28T00:00:00Z')` — defined in `src/data/warConstants.js`
- All components import from there (no duplicate definitions)

### Satellite / Aerosol Layers
- NASA GIBS tile layers (12 types) defined in `src/services/eoTiles.js`
- Aerosol layer: MODIS Combined AOD — use **2 days ago** date (not yesterday) due to processing lag
- Tile URL: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Combined_Value_Added_AOD/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`
- No API key needed. Free public endpoint. Max zoom: 6.
- MEM and War Monitor also have this aerosol layer via Leaflet

### Google Sheets Recording
- Apps Script webhook at: `https://script.google.com/macros/s/AKfycbyfdZwRQY6HNBUAyAQQjRW8H9EGCKqMbSEg0IIbPW2y1HLMXV5C19zPaLbj-nEkUAVGrw/exec`
- Sheet ID: `15wcRoWX-qMsusROgPAablSxV0CgT_Yql5EbQNXsJR90` (original)
- Sheet ID: `11bLVCnRk1tnUH1h1c122gP6JYzeJi3rTFS3FYeIGgS8` (new, for demo)
- GPD also has `server/lib/sheetsRecorder.mjs` — direct Sheets API recording (needs `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_KEY` env vars on Cloudflare Pages)
- Visitor tracking on all 3 dashboards sends: dashboard name, page URL, referrer, country, city, IP, user agent, language, screen size, timezone

### Government Best Practices (Applied to GPD)
- Classification banner: `UNCLASSIFIED // FOR OFFICIAL USE ONLY` (top + bottom, configurable level)
- Data Provenance modal: 12 sources with reliability ratings, methodology, cache TTL
- Print/Export briefing: landscape A4 print stylesheet
- Session Activity Log: timestamped audit trail with export
- PWA/Offline: service worker caches app shell + last-known API responses
- Accessibility: `:focus-visible` outlines, `aria-label` on all buttons, skip-link, `role="main"`

---

## Deployment Checklist

When deploying any dashboard:

1. **Build passes** (`npm run build` for GPD)
2. **Logos visible** — check white pill with PMUA, depa, Axiom, ReTL
3. **About modal works** — ℹ button opens, shows all credits + legal
4. **No broken images** — all `src` URLs return 200
5. **Aerosol layer loads** — faint haze visible on map
6. **Visitor tracking fires** — check Google Sheet for new row
7. **72" display** — text scales proportionally (check with browser zoom to 200-300%)
8. **Mobile** — layout doesn't break at 375px width

### Deploy Commands
```bash
# GPD → Cloudflare Pages project `globalmonitor` (primary; serves globalmonitor.nonarkara.org)
npm run deploy:pages

# GPD → GitHub Pages (static backup, needs --base flag)
npm run build -- --base=/globalmonitor/ && cp dist/index.html dist/404.html && npx gh-pages -d dist

# MEM → GitHub Pages
cd mem-by-non && git push origin main && gh api repos/Nonarkara/mem-by-non/pages/builds -X POST

# War Monitor → Cloudflare Pages
cd middleeast-monitor && wrangler pages deploy . --project-name middleeast-monitor --commit-dirty=true
```

---

## What Dr Non Will Say "Good" To

- Clean, minimal design that reveals complexity progressively
- Real data, real photos, real sources
- Something that looks like a human designer spent weeks on it
- Mathematical rigor behind the aesthetics
- A live URL that loads fast and works perfectly
- Dense information displays that use every pixel
- Logos clearly visible, credits properly attributed
- Working on first visit — no "Loading..." forever

## What Dr Non Will Reject

- Placeholder content, stock descriptions, hallucinated data
- Template aesthetics (rounded corners, blue gradients, icon grids)
- Logos that are invisible, broken, or duplicated
- Empty space that could show data
- "It works on localhost" — only the deployed site counts
- Panels that return null and create layout holes
- Any design that looks "generated by AI in 30 seconds"

---

## File Locations

```
dashboards/
  middle-eastern-dashboard/     # GPD (main codebase)
    src/                        # React frontend
    server/                     # Node.js API backend
    public/                     # Static assets (logos, favicon, manifest)
    netlify/                    # Netlify functions (backup)
    google-apps-script/         # Visitor tracking Apps Script
    wrangler.toml              # Cloudflare Pages config
    functions/                 # Pages Functions API layer
    CLAUDE.md                   # THIS FILE
  mem-by-non/                   # MEM by NON (vanilla)
    index.html, app.js, style.css
  middleeast-monitor/           # War Monitor (vanilla monolith)
    index.html                  # 8800+ lines, everything inline
```
