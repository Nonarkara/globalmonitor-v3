# Global Political Dashboard — Project Instructions for Codex

This file captures everything Dr Non wants for this project suite. Read it before writing any code.

---

## Who Is Dr Non

Dr Non Arkaraprasertkul — architect (MIT), anthropologist (Harvard), smart city specialist at Thailand's depa. He does not write code. He designs systems from first principles and evaluates everything on **live deployed URLs**, never localhost. He ships constantly, context-switches between 25+ projects, and communicates through documentation. He works exclusively in Codex sessions.

**Co-creator**: Associate Professor Dr. Poon Thiengburanathum — public ranking model and urban performance methodology.

---

## What This Project Is

A suite of **4 real-time geopolitical intelligence dashboards** monitoring the Middle East conflict (Iran-Israel war starting 2026-02-28). Funded by PMUA (primary), depa, with execution by Axiom and ReTL.

### The 4 Dashboards

| Name | Repo | Live URL | Stack | Purpose |
|------|------|----------|-------|---------|
| **GPD** (Global Political Dashboard) | `Nonarkara/globalmonitor` | `globalmonitor.fly.dev` | React 19 + Vite + MapLibre + D3 + Node API | Flagship — 43 components, 12 live data sources, full intelligence platform |
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

Dr Non uses free tiers exclusively while testing. Vercel and Netlify have both been exhausted (402/503). Current working hosts:

| Platform | Used For | Status |
|----------|----------|--------|
| **Fly.io** | GPD full stack (frontend + API) | Active, free tier (3 shared VMs) |
| **Cloudflare Pages** | War Monitor static | Active, free, no limits |
| **GitHub Pages** | MEM, GPD static backup | Active, free |
| **Render** | GPD (original host) | Suspended — one-click resume available |
| **Vercel** | All projects deleted — fair use exhausted | Dead |
| **Netlify** | All projects — free tier exhausted | Dead |

**Rule**: Always have a deployment plan that doesn't require payment. If one host dies, deploy to another immediately. Static backups on GitHub Pages are the last resort.

---

## Sponsor Logo Requirements

All dashboards MUST display these logos in the header:
1. **PMUA** (`pmua-logo.webp`) — PRIMARY funder, largest logo
2. **depa** (`Logo depa-01.png`)
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

### What Dr Non Wants
- **Bauhaus meets data** — form follows function, every element earns its place
- **Dark theme** for data dashboards (reduces eye strain, makes data pop)
- **Glass morphism** — `backdrop-filter: blur(20px)`, frosted glass panels, subtle borders
- **No rounded corners** — sharp corners or 1-2px max radius. Exceptions: logo pills, tags, buttons (functional radius)
- **No template aesthetics** — no Bootstrap/Tailwind default look, no "AI blue" (#3B82F6), no icon grids
- **Visual hierarchy through typography** — weight contrast (ultralight to bold), not just size
- **Real data only** — every number sourced, no placeholder content, no hallucinated data
- **Inter** for body, **JetBrains Mono** for data/mono

### Anti-Patterns (Hard Rejects)
- White logo box that clashes with dark theme → use transparent or very subtle container
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
External APIs (ACLED, NASA FIRMS, GDELT, EIA, RSS feeds, Yahoo Finance)
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
- GPD also has `server/lib/sheetsRecorder.mjs` — direct Sheets API recording (needs `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_KEY` env vars on Fly.io)
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
# GPD → Fly.io
npm run build && fly deploy --remote-only -a globalmonitor

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
    fly.toml                    # Fly.io config
    Dockerfile                  # Docker build (Fly.io + Render)
    AGENTS.md                   # THIS FILE
  mem-by-non/                   # MEM by NON (vanilla)
    index.html, app.js, style.css
  middleeast-monitor/           # War Monitor (vanilla monolith)
    index.html                  # 8800+ lines, everything inline
```
