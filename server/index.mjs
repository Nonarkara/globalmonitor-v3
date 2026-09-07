// NOTE (F1 dual-backend drift): this file's route handlers (Express, dev/Fly.io)
// duplicate the routing/meta logic in functions/_lib/router.mjs (Cloudflare Pages
// Functions, prod). Both import the SAME server/lib/*.mjs fetchers, so fetch-level
// fixes apply to both — but response-shaping logic (e.g. X-Tech-Status derivation)
// must be edited in both places. See functions/_lib/router.mjs's matching note.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import {
    buildCopernicusUnavailablePayload,
    fetchCopernicusPreview,
    isCopernicusConfigured,
    parseCopernicusPreviewOptions
} from './lib/copernicus.mjs';
import { fetchBriefingPayload, fetchTickerPayload } from './lib/intelligence.mjs';
import { fetchMarketPayload } from './lib/marketData.mjs';
import { fetchFirmsPayload } from './lib/firms.mjs';
import { computeEscalation } from './lib/escalation.mjs';
import { computeStrikeStats } from './lib/strikeStats.mjs';
import { fetchHumanitarianPayload } from './lib/humanitarian.mjs';
import { computeInfrastructureStatus } from './lib/infrastructure.mjs';
import { fetchGdeltSentiment } from './lib/gdelt.mjs';
import { fetchFlightsPayload } from './lib/flights.mjs';
import { computeFrontStatus } from './lib/frontStatus.mjs';
import { fetchNgaWarnings } from './lib/ngaWarnings.mjs';
import { fetchUsgsQuakes } from './lib/usgsQuakes.mjs';
import { fetchAcledEvents } from './lib/acled.mjs';
import { fetchOilPriceTimeline } from './lib/eia.mjs';
import { searchStacScenes } from './lib/stacCatalog.mjs';
import { searchPlanetaryComputer } from './lib/planetaryComputer.mjs';
import { listPresets as listEvalscriptPresets } from './lib/evalscripts.mjs';
import { probeCog, isAllowedCogUrl } from './lib/cogReader.mjs';
import { recordToSheets, recordEscalation, getRecordingHealth } from './lib/sheetsRecorder.mjs';
import { ingestRegionalNews } from './lib/regionalNewsIngest.mjs';
import { startAisStream, startVesselFinderRefresh, getVesselsGeoJson, getVesselsGeoJsonForTheater } from './lib/aisVessels.mjs';
import { getRainviewerRadarTiles } from './lib/rainviewer.mjs';
import { buildForecast as buildOracleForecast } from './lib/oracle/index.mjs';
import { buildFloodOps, FLOOD_CITIES } from './lib/floodOps.mjs';
import { buildFloodDirective } from './lib/floodDirective.mjs';
import { startScheduler } from './lib/scheduler.mjs';
import {
    saveSnapshot, loadAllSnapshots, getDbHealth,
    upsertAcledEvents as dbUpsertAcled,
    upsertFirmsHotspots as dbUpsertFirms,
    upsertMarketQuotes as dbUpsertMarkets,
    upsertSentimentReadings as dbUpsertSentiment,
    upsertNewsItems as dbUpsertNews
} from './lib/localDb.mjs';
import {
    isSupabaseEnabled, getSupabaseStatusMessage,
    upsertAcledEvents, upsertFirmsHotspots, upsertMarketQuotes, upsertSentimentReadings
} from './lib/supabase.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const loadEnvFile = (filename) => {
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 4000);
const cache = new Map();
// Immutable terrarium elevation tiles for the flood simulator (Map = insertion-order LRU).
const terrainTileCache = new Map();
// Tracks in-flight refreshes per cache key so concurrent viewers hitting an
// expired key coalesce onto a single upstream fetch instead of each firing one.
const pending = new Map();
const loaderHealth = new Map();

const json = (response, statusCode, payload, meta = {}) => {
    response.writeHead(statusCode, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Tech-Status': meta.status || 'live',
        'X-Tech-Updated-At': meta.updatedAt || '',
        'X-Tech-Cache': meta.cache || 'miss',
        'X-Tech-Source': meta.source || ''
    });
    response.end(JSON.stringify(payload));
};

// Any payload whose own `source` says it is not a live observation — a curated
// demo set, a sample, a fallback literal, a "no key configured" shell — must
// never leave the API stamped X-Tech-Status: live. Mirrors functions/_lib/cache.mjs.
const NON_LIVE_SOURCE = /sample|fallback|curated|mock|demo|unconfigured|no_[a-z_]*key/i;
const describeSource = (payload) => payload?.meta?.source ?? payload?.source ?? null;
const statusForPayload = (payload, fallback = 'live') => {
    const source = describeSource(payload);
    return source && NON_LIVE_SOURCE.test(String(source)) ? 'sample' : fallback;
};

const recordHealth = (key, ok, message = null, source = null) => {
    loaderHealth.set(key, {
        ok,
        status: !ok ? 'error' : source && NON_LIVE_SOURCE.test(String(source)) ? 'demo' : 'live',
        source,
        checkedAt: new Date().toISOString(),
        message
    });
};

const useCached = async (key, ttlMs, loader, isUsable) => {
    const now = Date.now();
    const current = cache.get(key);

    if (current && current.expiresAt > now) {
        recordHealth(key, true, null, describeSource(current.payload));
        return {
            payload: current.payload,
            meta: {
                status: statusForPayload(current.payload),
                source: describeSource(current.payload),
                updatedAt: current.updatedAt,
                cache: 'hit'
            }
        };
    }

    // Coalesce concurrent refreshes: if a load for this key is already running,
    // await it rather than firing a second upstream request. This bounds upstream
    // concurrency to one fetch per key no matter how many viewers race an expiry.
    const inFlight = pending.get(key);
    if (inFlight) {
        return inFlight;
    }

    const load = (async () => {
        try {
            const payload = await loader();

            if (!isUsable(payload)) {
                throw new Error('No usable payload returned');
            }

            const updatedAt = new Date().toISOString();
            cache.set(key, {
                payload,
                updatedAt,
                expiresAt: now + ttlMs
            });
            recordHealth(key, true, null, describeSource(payload));
            // Persist snapshot to local SQLite so cache survives server restart
            saveSnapshot(key, payload, updatedAt);
            // Fire-and-forget: record to Google Sheets
            recordToSheets(key, payload, updatedAt).catch(() => {});

            return {
                payload,
                meta: {
                    status: statusForPayload(payload),
                    source: describeSource(payload),
                    updatedAt,
                    cache: current ? 'refresh' : 'miss'
                }
            };
        } catch (error) {
            recordHealth(key, false, error.message);

            if (current) {
                // Stale fallback: serve the last good value on loader failure.
                return {
                    payload: current.payload,
                    meta: {
                        status: 'stale',
                        updatedAt: current.updatedAt,
                        cache: 'stale'
                    }
                };
            }

            throw error;
        } finally {
            pending.delete(key);
        }
    })();

    pending.set(key, load);
    return load;
};

const parseSourceIds = (searchParams) => {
    const raw = searchParams.get('sourceIds');
    if (!raw) return null;

    return raw.split(',').map((value) => value.trim()).filter(Boolean);
};

const server = http.createServer(async (request, response) => {
    if (!request.url) {
        json(response, 400, { error: 'Missing request URL' }, { status: 'offline' });
        return;
    }

    // Reject path traversal attempts before URL normalization collapses them.
    const rawRequestUrl = request.url;
    if (rawRequestUrl.includes('..') || decodeURIComponent(rawRequestUrl).includes('..')) {
        json(response, 403, { error: 'Forbidden' }, { status: 'offline' });
        return;
    }

    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        response.end();
        return;
    }

    if (request.method === 'POST' && request.url?.startsWith('/api/refresh-all')) {
        // Bust the server-side in-memory cache for all live data keys.
        const BUST_PREFIXES = ['ticker:', 'briefing:', 'firms:', 'acled:', 'markets', 'gdelt:', 'flights:', 'vessels:', 'quakes:', 'nga-warnings', 'oil-prices', 'humanitarian:', 'regional-news:'];
        let cleared = 0;
        for (const key of cache.keys()) {
            if (BUST_PREFIXES.some((p) => key.startsWith(p))) {
                cache.delete(key);
                cleared++;
            }
        }
        json(response, 200, { ok: true, cleared }, { status: 'live', updatedAt: new Date().toISOString(), cache: 'miss' });
        return;
    }

    if (request.method !== 'GET') {
        json(response, 405, { error: 'Method not allowed' }, { status: 'offline' });
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
    const sourceIds = parseSourceIds(url.searchParams);

    try {
        if (url.pathname === '/api/sheets-health') {
            json(response, 200, getRecordingHealth(), { status: 'live', updatedAt: new Date().toISOString(), cache: 'miss' });
            return;
        }

        if (url.pathname === '/api/db-health') {
            json(response, 200, getDbHealth(), { status: 'live', updatedAt: new Date().toISOString(), cache: 'miss' });
            return;
        }

        if (url.pathname === '/api/health') {
            const entries = Array.from(cache.entries()).map(([key, value]) => ({
                key,
                updatedAt: value.updatedAt,
                expiresInMs: Math.max(0, value.expiresAt - Date.now())
            }));

            json(response, 200, {
                ok: true,
                now: new Date().toISOString(),
                cacheEntries: entries,
                loaderHealth: Object.fromEntries(loaderHealth.entries())
            });
            return;
        }

        if (url.pathname === '/api/ticker') {
            const result = await useCached(
                `ticker:${sourceIds?.join(',') || 'default'}`,
                180000,  // 3 min — ticker changes slowly; 60s caused unnecessary re-fetches
                () => fetchTickerPayload(sourceIds),
                (payload) => Array.isArray(payload) && payload.length > 0
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname.startsWith('/api/briefings/')) {
            const briefingId = decodeURIComponent(url.pathname.replace('/api/briefings/', ''));
            const result = await useCached(
                `briefing:${briefingId}:${sourceIds?.join(',') || 'default'}`,
                120000,  // 2 min — balances freshness vs server load
                () => fetchBriefingPayload(briefingId, sourceIds),
                (payload) => Array.isArray(payload?.items) && payload.items.length > 0
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        // Regional country news — backed by Supabase when configured.
        // ?region=indopacific|thailand&code=TH (or BKK / VN / SG / etc.)
        if (url.pathname === '/api/regional-news') {
            const region = url.searchParams.get('region') || 'indopacific';
            const code = (url.searchParams.get('code') || '').toUpperCase();
            if (!code) {
                json(response, 400, { error: 'Missing required ?code param' });
                return;
            }
            const result = await useCached(
                `regional-news:${region}:${code}`,
                5 * 60 * 1000,
                () => ingestRegionalNews(region, code, { persistLocal: dbUpsertNews }),
                (payload) => Array.isArray(payload?.items) && payload.items.length > 0
            );
            recordHealth('regional-news', !!result.payload?.items?.length, result.payload?.status || null);
            json(response, 200, result.payload, result.meta);
            return;
        }

        // Supabase wiring health check.
        if (url.pathname === '/api/supabase-health') {
            json(response, 200, {
                enabled: isSupabaseEnabled(),
                message: getSupabaseStatusMessage()
            });
            return;
        }

        if (url.pathname === '/api/firms') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `firms:${theater}`,
                10 * 60 * 1000,
                () => fetchFirmsPayload(theater),
                (payload) => payload?.type === 'FeatureCollection'
            );
            if (result.meta.cache !== 'hit' && result.payload?.meta?.source === 'nasa-firms-live') {
                upsertFirmsHotspots(result.payload, theater).catch(() => {});
                dbUpsertFirms(result.payload, theater);
            }
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/escalation') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const payload = computeEscalation(cache, theater);
            recordEscalation(payload).catch(() => {});
            // A null score means every upstream was silent — don't stamp that 'live'.
            json(response, 200, payload, {
                status: payload.score === null ? 'stale' : 'live',
                source: 'composite_index',
                updatedAt: payload.updatedAt,
                cache: 'miss'
            });
            return;
        }

        if (url.pathname === '/api/strike-stats') {
            const payload = computeStrikeStats(cache);
            json(response, 200, payload, {
                status: payload.headlineCount > 0 ? 'live' : 'stale',
                source: payload.source,
                updatedAt: new Date().toISOString(),
                cache: 'miss'
            });
            return;
        }

        if (url.pathname === '/api/humanitarian') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `humanitarian:${theater}`,
                60 * 60 * 1000,
                () => fetchHumanitarianPayload(theater),
                (p) => p?.geojson?.type === 'FeatureCollection'
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/infrastructure') {
            const payload = computeInfrastructureStatus(cache);
            json(response, 200, payload, { status: 'live', updatedAt: payload.updatedAt, cache: 'miss' });
            return;
        }

        if (url.pathname === '/api/fronts') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const payload = computeFrontStatus(cache, theater);
            json(response, 200, payload, {
                status: payload.fronts?.length ? 'live' : 'stale',
                source: payload.reason || 'composite_index',
                updatedAt: payload.updatedAt,
                cache: 'miss'
            });
            return;
        }

        if (url.pathname === '/api/nga-warnings') {
            const result = await useCached(
                'nga-warnings',
                30 * 60 * 1000,
                () => fetchNgaWarnings(),
                (p) => Array.isArray(p?.warnings)
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/quakes') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `quakes:${theater}`,
                10 * 60 * 1000,
                () => fetchUsgsQuakes(theater),
                (p) => p?.summary != null
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/sentiment') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `gdelt:${theater}`,
                30 * 60 * 1000,
                () => fetchGdeltSentiment(theater),
                (p) => Array.isArray(p?.timeline)
            );
            if (result.meta.cache !== 'hit') {
                upsertSentimentReadings(result.payload).catch(() => {});
                dbUpsertSentiment(result.payload);
            }
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/flights') {
            const theater = url.searchParams.get('theater') || 'global';
            const result = await useCached(
                `flights:${theater}`,
                35 * 1000,  // 35s — must exceed the scheduler's 30s warm interval so a
                            // proactive refresh always lands before expiry, keeping
                            // viewer requests on the warm cache (never cold upstream).
                () => fetchFlightsPayload(theater),
                (p) => p?.type === 'FeatureCollection'
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/vessels') {
            const theater = url.searchParams.get('theater') || 'global';
            const result = await useCached(
                `vessels:${theater}`,
                15000,  // 15s — vessels are live, but cache smooths polling spikes
                () => typeof getVesselsGeoJsonForTheater === 'function'
                    ? getVesselsGeoJsonForTheater(theater)
                    : getVesselsGeoJson(),
                (p) => p?.type === 'FeatureCollection'
            );
            const payload = result.payload;
            json(response, 200, payload, {
                ...result.meta,
                status: payload.meta.connected ? 'live' : (payload.meta.requiresKey ? 'unconfigured' : 'stale'),
                updatedAt: payload.meta.fetchedAt
            });
            return;
        }

        if (url.pathname === '/api/oracle') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const scenario = url.searchParams.get('scenario') || null;
            const escDeltaRaw = url.searchParams.get('escDelta');
            const escalationDelta = escDeltaRaw != null ? Number(escDeltaRaw) : undefined;
            const pRaw = url.searchParams.get('p'); // compact sliders: "iran:0.2,israel:-0.1"
            let postureDeltas = null;
            if (pRaw) {
                postureDeltas = {};
                for (const pair of pRaw.split(',')) {
                    const [id, d] = pair.split(':');
                    if (id && d != null && Number.isFinite(Number(d))) postureDeltas[id] = Number(d);
                }
            }
            const injection = (scenario || escalationDelta != null || postureDeltas)
                ? { scenario, escalationDelta, postureDeltas }
                : null;
            const isSlider = Boolean(postureDeltas);
            const cacheKey = `oracle:${theater}:${scenario || 'base'}:${escDeltaRaw || 0}:${pRaw || ''}`;
            const result = await useCached(
                cacheKey,
                injection ? 2 * 60 * 1000 : 5 * 60 * 1000,
                () => buildOracleForecast(cache, theater, injection, { narrate: !isSlider }),
                (p) => p && Array.isArray(p?.forecast?.outcomes)
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/flood') {
            const cityId = FLOOD_CITIES[url.searchParams.get('city')] ? url.searchParams.get('city') : 'ayutthaya';
            const result = await useCached(
                `flood:${cityId}`,
                10 * 60 * 1000, // matches HII 10-min telemetry cadence
                () => buildFloodOps(cityId),
                (p) => Array.isArray(p?.geo?.stations?.features) && p.geo.stations.features.length > 0
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/flood/directive') {
            const cityId = FLOOD_CITIES[url.searchParams.get('city')] ? url.searchParams.get('city') : 'ayutthaya';
            // Simulation summary comes from the client's terrain run (God's Mode).
            const deltaM = Number(url.searchParams.get('delta'));
            const floodedKm2 = Number(url.searchParams.get('km2'));
            const pois = (url.searchParams.get('pois') || '').split('|').filter(Boolean).slice(0, 8);
            const sim = Number.isFinite(deltaM)
                ? { deltaM, floodedKm2: Number.isFinite(floodedKm2) ? floodedKm2 : 0, floodedPois: pois }
                : null;
            const opsResult = await useCached(
                `flood:${cityId}`,
                10 * 60 * 1000,
                () => buildFloodOps(cityId),
                (p) => Array.isArray(p?.geo?.stations?.features)
            );
            const simKey = sim ? `${sim.deltaM}:${sim.floodedKm2}:${pois.join(',')}` : 'live';
            const result = await useCached(
                `flood-directive:${cityId}:${simKey}`,
                5 * 60 * 1000,
                () => buildFloodDirective(opsResult.payload, sim),
                (p) => typeof p?.directive === 'string' && p.directive.length > 20
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/rainviewer') {
            const result = await useCached(
                'rainviewer:radar',
                5 * 60 * 1000,
                () => getRainviewerRadarTiles(),
                (p) => Array.isArray(p?.tiles) && p.tiles.length > 0
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/acled') {
            const since = url.searchParams.get('since');
            const theater = url.searchParams.get('theater') || 'middleeast';
            const cacheKey = since ? `acled:${theater}:${since}` : `acled:${theater}`;
            const result = await useCached(
                cacheKey,
                60 * 60 * 1000,  // 1 hour cache
                () => fetchAcledEvents(since ? { since, theater } : { theater }),
                (p) => p?.type === 'FeatureCollection'
            );
            // Demo data has no place in the longitudinal archive; the envelope
            // already stamps it X-Tech-Status: sample.
            if (result.meta.cache !== 'hit' && result.payload?.source === 'acled') {
                upsertAcledEvents(result.payload).catch(() => {});
                dbUpsertAcled(result.payload, theater);
            }
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/oil-prices') {
            const result = await useCached(
                'oil-prices',
                30 * 60 * 1000,
                () => fetchOilPriceTimeline(),
                (p) => Array.isArray(p?.brent)
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/markets') {
            const result = await useCached(
                'markets',
                60000,  // 60s — markets update every minute, 30s was unnecessary churn
                () => fetchMarketPayload(),
                (payload) => Array.isArray(payload) && payload.length > 0
            );
            if (result.meta.cache !== 'hit') {
                upsertMarketQuotes(result.payload).catch(() => {});
                dbUpsertMarkets(result.payload);
            }
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/stac/search') {
            const bbox = url.searchParams.get('bbox');
            if (!bbox) {
                json(response, 400, { error: 'bbox parameter required (west,south,east,north)' });
                return;
            }
            const bboxArr = bbox.split(',').map(Number);
            if (bboxArr.length !== 4 || bboxArr.some(n => !Number.isFinite(n))) {
                json(response, 400, { error: 'bbox must be 4 comma-separated numbers' });
                return;
            }
            const datetime = url.searchParams.get('datetime') || undefined;
            const maxCloudCover = Number(url.searchParams.get('maxCloudCover') || 20);
            const source = url.searchParams.get('source') || 'copernicus';

            const cacheKeySuffix = `${bbox}_${datetime || 'latest'}_${maxCloudCover}_${source}`;
            const result = await useCached(
                `stac:${cacheKeySuffix}`,
                30 * 60 * 1000,
                async () => {
                    if (source === 'planetary-computer') {
                        return searchPlanetaryComputer({ bbox: bboxArr, datetime, maxCloudCover });
                    }
                    return searchStacScenes({ bbox: bboxArr, datetime, maxCloudCover });
                },
                (p) => p?.type === 'FeatureCollection'
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/stac/presets') {
            json(response, 200, listEvalscriptPresets());
            return;
        }

        if (url.pathname === '/api/cog/probe') {
            const cogUrl = url.searchParams.get('url');
            if (!cogUrl) {
                json(response, 400, { error: 'url parameter required' });
                return;
            }
            if (!isAllowedCogUrl(cogUrl)) {
                json(response, 400, { error: 'url host not allowed' });
                return;
            }
            const probeResult = await probeCog(cogUrl);
            json(response, 200, probeResult);
            return;
        }

        if (url.pathname === '/api/copernicus/preview') {
            const options = parseCopernicusPreviewOptions(url.searchParams);

            if (!isCopernicusConfigured()) {
                json(
                    response,
                    200,
                    buildCopernicusUnavailablePayload(options),
                    { status: 'live', updatedAt: '', cache: 'miss' }
                );
                return;
            }

            const cacheKey = `copernicus:${JSON.stringify(options)}`;
            const result = await useCached(
                cacheKey,
                20 * 60 * 1000,
                () => fetchCopernicusPreview(options),
                (payload) => payload?.available === true && typeof payload?.imageDataUrl === 'string' && payload.imageDataUrl.startsWith('data:image/')
            );
            json(response, 200, result.payload, result.meta);
            return;
        }

        if (url.pathname === '/api/terrain') {
            // Terrarium elevation tiles (AWS Open Data) don't send CORS headers,
            // so God's Mode reads them through this proxy. Tiles are immutable —
            // cache aggressively in memory and in the browser.
            const z = Number(url.searchParams.get('z'));
            const x = Number(url.searchParams.get('x'));
            const y = Number(url.searchParams.get('y'));
            const maxIndex = 2 ** z;
            if (!Number.isInteger(z) || z < 0 || z > 15
                || !Number.isInteger(x) || x < 0 || x >= maxIndex
                || !Number.isInteger(y) || y < 0 || y >= maxIndex) {
                json(response, 400, { error: 'Bad tile coordinates' }, { status: 'offline' });
                return;
            }
            const tileKey = `terrain:${z}/${x}/${y}`;
            let buf = terrainTileCache.get(tileKey);
            if (!buf) {
                const upstream = await fetch(
                    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
                    { signal: AbortSignal.timeout(15000) }
                );
                if (!upstream.ok) {
                    json(response, 502, { error: `terrain tile upstream ${upstream.status}` }, { status: 'offline' });
                    return;
                }
                buf = Buffer.from(await upstream.arrayBuffer());
                terrainTileCache.set(tileKey, buf);
                if (terrainTileCache.size > 600) { // ~18MB ceiling; drop oldest
                    terrainTileCache.delete(terrainTileCache.keys().next().value);
                }
            }
            response.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': buf.length,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
            });
            response.end(buf);
            return;
        }

        // Unknown API routes should 404, not fall through to the SPA fallback.
        if (url.pathname.startsWith('/api/')) {
            json(response, 404, { error: 'Not found' }, { status: 'offline' });
            return;
        }

        // --- Static file serving for production ---
        if (fs.existsSync(DIST_DIR)) {
            const MIME_TYPES = {
                '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
                '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
                '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
                '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webp': 'image/webp',
                '.webm': 'video/webm', '.mp4': 'video/mp4',
            };

            const rawPath = url.pathname === '/' ? 'index.html' : url.pathname;
            const resolvedPath = path.normalize(path.join(DIST_DIR, rawPath));
            if (!resolvedPath.startsWith(path.normalize(DIST_DIR + path.sep))) {
                json(response, 403, { error: 'Forbidden' }, { status: 'offline' });
                return;
            }

            let filePath = resolvedPath;
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                filePath = path.join(DIST_DIR, 'index.html');
            }

            try {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                const data = fs.readFileSync(filePath);

                const headers = { 'Content-Type': contentType, 'Content-Length': data.length };
                // Cache static assets aggressively, but not index.html
                if (ext !== '.html') {
                    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
                }

                response.writeHead(200, headers);
                response.end(data);
                return;
            } catch {
                // fall through to 404
            }
        }

        json(response, 404, { error: 'Not found' }, { status: 'offline' });
    } catch (error) {
        json(response, 502, {
            error: 'Upstream fetch failed',
            message: error.message
        }, { status: 'offline' });
    }
});

const HOST = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`Tech Monitor API listening on http://${HOST}:${PORT}`);
    if (fs.existsSync(DIST_DIR)) {
        console.log(`Serving static files from ${DIST_DIR}`);
    }

    // Warm in-memory cache from local SQLite so first request is instant
    const snapshots = loadAllSnapshots();
    if (snapshots.length > 0) {
        const now = Date.now();
        for (const { cache_key, payload, updated_at } of snapshots) {
            try {
                const parsed = JSON.parse(payload);
                // Mark snapshot entries as expired so they refresh eagerly,
                // but still serve them as stale while fresh data loads.
                cache.set(cache_key, {
                    payload: parsed,
                    updatedAt: updated_at,
                    expiresAt: now - 1  // expired → triggers refresh on first hit
                });
            } catch (_) { /* skip malformed snapshot */ }
        }
        console.log(`[localDb] warmed ${snapshots.length} cache entries from SQLite`);
    }

    startAisStream();
    startVesselFinderRefresh();
    startScheduler(PORT);
});
