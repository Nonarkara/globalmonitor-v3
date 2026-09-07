// NOTE (F1 dual-backend drift): this router (Cloudflare Pages Functions, prod)
// duplicates the routing/meta logic in server/index.mjs (Express, dev/Fly.io).
// Both import the SAME server/lib/*.mjs fetchers, so fetch-level fixes apply to
// both — but response-shaping logic (e.g. X-Tech-Status derivation) must be
// edited in both places. See server/index.mjs's matching note.
import {
    buildCopernicusUnavailablePayload,
    fetchCopernicusPreview,
    isCopernicusConfigured,
    parseCopernicusPreviewOptions
} from '../../server/lib/copernicus.mjs';
import { fetchBriefingPayload, fetchTickerPayload } from '../../server/lib/intelligence.mjs';
import { fetchMarketPayload } from '../../server/lib/marketData.mjs';
import { fetchFirmsPayload } from '../../server/lib/firms.mjs';
import { computeEscalation } from '../../server/lib/escalation.mjs';
import { computeStrikeStats } from '../../server/lib/strikeStats.mjs';
import { fetchHumanitarianPayload } from '../../server/lib/humanitarian.mjs';
import { computeInfrastructureStatus } from '../../server/lib/infrastructure.mjs';
import { fetchGdeltSentiment } from '../../server/lib/gdelt.mjs';
import { fetchFlightsPayload } from '../../server/lib/flights.mjs';
import { computeFrontStatus } from '../../server/lib/frontStatus.mjs';
import { fetchNgaWarnings } from '../../server/lib/ngaWarnings.mjs';
import { fetchUsgsQuakes } from '../../server/lib/usgsQuakes.mjs';
import { fetchAcledEvents } from '../../server/lib/acled.mjs';
import { fetchOilPriceTimeline } from '../../server/lib/eia.mjs';
import { searchStacScenes } from '../../server/lib/stacCatalog.mjs';
import { searchPlanetaryComputer } from '../../server/lib/planetaryComputer.mjs';
import { listPresets as listEvalscriptPresets } from '../../server/lib/evalscripts.mjs';
import { probeCog, isAllowedCogUrl } from '../../server/lib/cogReader.mjs';
import { ingestRegionalNews, fetchArbitraryRssQuery } from '../../server/lib/regionalNewsIngest.mjs';
import { buildForecast as buildOracleForecast } from '../../server/lib/oracle/index.mjs';
import { buildFloodOps, FLOOD_CITIES } from '../../server/lib/floodOps.mjs';
import { buildFloodDirective } from '../../server/lib/floodDirective.mjs';
import { getRainviewerRadarTilesWorker as getRainviewerRadarTiles } from './rainviewerWorker.mjs';
import {
    isSupabaseEnabled,
    getSupabaseStatusMessage,
    upsertAcledEvents,
    upsertFirmsHotspots,
    upsertMarketQuotes,
    upsertSentimentReadings
} from '../../server/lib/supabase.mjs';
import { THEATERS } from '../../server/lib/theaters.mjs';
import { getSharedCache, recordHealth, useCached, getCacheEntries, getLoaderHealth } from './cache.mjs';
import { fetchVesselsPayload } from './vessels.mjs';
import { jsonResponse, optionsResponse } from './response.mjs';

/**
 * Static ADS-B safety snapshot (public/data/flights/adsb-snapshot.geojson,
 * refreshed by `npm run refresh:flights` before every deploy). Used when no
 * live provider answers from the edge. Cut to the theater bbox so a Gulf view
 * gets Gulf aircraft, and labelled stale — never passed off as live.
 */
export const fetchFlightSnapshot = async (request, livePayload, next, theater = 'global') => {
    const snapshotUrl = new URL('/data/flights/adsb-snapshot.geojson', request.url);
    const snapshotRequest = new Request(snapshotUrl, {
        headers: { accept: 'application/geo+json, application/json' }
    });
    let response;
    try {
        response = next
            ? await next(snapshotRequest)
            : await fetch(snapshotRequest, { signal: AbortSignal.timeout(5000) });
    } catch {
        return livePayload;
    }
    if (!response?.ok) return livePayload;
    const snapshot = await response.json();
    if (!Array.isArray(snapshot?.features) || snapshot.features.length < 50) return livePayload;

    const bounds = THEATERS[theater]?.bounds || THEATERS.global.bounds;
    const features = snapshot.features.filter((f) => {
        const [lon, lat] = f?.geometry?.coordinates || [];
        return lat >= bounds.lamin && lat <= bounds.lamax && lon >= bounds.lomin && lon <= bounds.lomax;
    });
    return {
        ...snapshot,
        features,
        meta: {
            ...snapshot.meta,
            theater,
            count: features.length,
            source: 'adsb-snapshot',
            stale: true,
            liveError: livePayload?.meta?.error || 'Live flight providers unavailable'
        }
    };
};

const applyEnv = (env = {}) => {
    for (const [key, value] of Object.entries(env)) {
        if (value != null && value !== '') {
            process.env[key] = String(value);
        }
    }
};

const parseSourceIds = (searchParams) => {
    const raw = searchParams.get('sourceIds');
    if (!raw) return null;
    return raw.split(',').map((value) => value.trim()).filter(Boolean);
};

export async function handleApiRequest(request, env, next) {
    applyEnv(env);

    if (request.method === 'OPTIONS') {
        return optionsResponse();
    }

    if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed' }, 405, { status: 'offline' });
    }

    const url = new URL(request.url);
    const sourceIds = parseSourceIds(url.searchParams);
    const cache = getSharedCache();

    try {
        if (url.pathname === '/api/health') {
            return jsonResponse({
                ok: true,
                now: new Date().toISOString(),
                runtime: 'cloudflare-pages',
                cacheEntries: getCacheEntries(),
                loaderHealth: Object.fromEntries(getLoaderHealth().entries())
            });
        }

        if (url.pathname === '/api/supabase-health') {
            return jsonResponse({
                enabled: isSupabaseEnabled(),
                message: getSupabaseStatusMessage()
            });
        }

        if (url.pathname === '/api/ticker') {
            const result = await useCached(
                `ticker:${sourceIds?.join(',') || 'default'}`,
                180000,
                () => fetchTickerPayload(sourceIds),
                (payload) => Array.isArray(payload) && payload.length > 0
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname.startsWith('/api/briefings/')) {
            const briefingId = decodeURIComponent(url.pathname.replace('/api/briefings/', ''));
            const result = await useCached(
                `briefing:${briefingId}:${sourceIds?.join(',') || 'default'}`,
                120000,
                () => fetchBriefingPayload(briefingId, sourceIds),
                (payload) => Array.isArray(payload?.items) && payload.items.length > 0
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/news-rss') {
            const q = url.searchParams.get('q');
            const hl = url.searchParams.get('hl') || 'en-US';
            if (!q) {
                return jsonResponse({ error: 'Missing required ?q param' }, 400);
            }
            try {
                const result = await useCached(
                    `news-rss:${q}:${hl}`,
                    5 * 60 * 1000,
                    () => fetchArbitraryRssQuery(q, hl),
                    (items) => Array.isArray(items) && items.length > 0
                );
                recordHealth('news-rss', !!result.payload?.length, result.payload?.length ? null : 'empty RSS result');
                return jsonResponse(result.payload, 200, result.meta);
            } catch (error) {
                recordHealth('news-rss', false, error.message);
                return jsonResponse([], 200, { status: 'error', updatedAt: new Date().toISOString(), cache: 'miss' });
            }
        }

        if (url.pathname === '/api/regional-news') {
            const region = url.searchParams.get('region') || 'indopacific';
            const code = (url.searchParams.get('code') || '').toUpperCase();
            if (!code) {
                return jsonResponse({ error: 'Missing required ?code param' }, 400);
            }
            const result = await useCached(
                `regional-news:${region}:${code}`,
                5 * 60 * 1000,
                () => ingestRegionalNews(region, code),
                (payload) => Array.isArray(payload?.items) && payload.items.length > 0
            );
            recordHealth('regional-news', !!result.payload?.items?.length, result.payload?.status || null);
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/firms') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `firms:${theater}`,
                10 * 60 * 1000,
                () => fetchFirmsPayload(theater),
                (payload) => payload?.type === 'FeatureCollection'
            );
            if (result.meta.cache !== 'hit' && result.payload?.meta?.source === 'nasa-firms-live') upsertFirmsHotspots(result.payload, theater).catch(() => {});
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/escalation') {
            // The FIRMS band follows the theater on screen; it used to be pinned
            // to the Middle East regardless of what the client asked for.
            const theater = url.searchParams.get('theater') || 'middleeast';
            const payload = computeEscalation(cache, theater);
            // A null score means every upstream was silent — don't stamp that 'live'.
            return jsonResponse(payload, 200, {
                status: payload.score === null ? 'stale' : 'live',
                source: 'composite_index',
                updatedAt: payload.updatedAt,
                cache: 'miss'
            });
        }

        if (url.pathname === '/api/strike-stats') {
            const payload = computeStrikeStats(cache);
            // Zero headlines in cache is silence, not a week with zero strikes.
            return jsonResponse(payload, 200, {
                status: payload.headlineCount > 0 ? 'live' : 'stale',
                source: payload.source,
                updatedAt: new Date().toISOString(),
                cache: 'miss'
            });
        }

        if (url.pathname === '/api/humanitarian') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `humanitarian:${theater}`,
                60 * 60 * 1000,
                () => fetchHumanitarianPayload(theater),
                (p) => p?.geojson?.type === 'FeatureCollection'
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/infrastructure') {
            const payload = computeInfrastructureStatus(cache);
            return jsonResponse(payload, 200, { status: 'live', updatedAt: payload.updatedAt, cache: 'miss' });
        }

        if (url.pathname === '/api/fronts') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const payload = computeFrontStatus(cache, theater);
            // An empty cache is silence, not seven STABLE fronts.
            return jsonResponse(payload, 200, {
                status: payload.fronts?.length ? 'live' : 'stale',
                source: payload.reason || 'composite_index',
                updatedAt: payload.updatedAt,
                cache: 'miss'
            });
        }

        if (url.pathname === '/api/nga-warnings') {
            try {
                const result = await useCached(
                    'nga-warnings',
                    30 * 60 * 1000,
                    () => fetchNgaWarnings(),
                    (p) => Array.isArray(p?.warnings)
                );
                return jsonResponse(result.payload, 200, result.meta);
            } catch (error) {
                recordHealth('nga-warnings', false, error.message);
                return jsonResponse(
                    { warnings: [], total: 0, highThreat: 0, elevatedThreat: 0, updatedAt: null, error: error.message },
                    200,
                    { status: 'error', updatedAt: new Date().toISOString(), cache: 'miss' }
                );
            }
        }

        if (url.pathname === '/api/quakes') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `quakes:${theater}`,
                10 * 60 * 1000,
                () => fetchUsgsQuakes(theater),
                (p) => p?.summary != null
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/sentiment') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(
                `gdelt:${theater}`,
                30 * 60 * 1000,
                () => fetchGdeltSentiment(theater),
                (p) => Array.isArray(p?.timeline) && p.timeline.length > 0
            );
            if (result.meta.cache !== 'hit') upsertSentimentReadings(result.payload).catch(() => {});
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/flights') {
            const theater = url.searchParams.get('theater') || 'global';
            const minCount = theater === 'global' ? 50 : 3;
            const result = await useCached(
                `flights:v3:${theater}`,
                10 * 60 * 1000,
                async () => {
                    const live = await fetchFlightsPayload(theater);
                    if ((live.features?.length ?? 0) >= minCount) return live;
                    // Live ADS-B providers are often unreachable from the Cloudflare
                    // edge. Serve the committed snapshot, cut to this theater and
                    // labelled stale, rather than a 500 that empties the map.
                    return fetchFlightSnapshot(request, live, next, theater);
                },
                (p) => p?.type === 'FeatureCollection' && (p.features?.length ?? 0) >= minCount
            );
            // A committed snapshot served in place of live ADS-B is stale by
            // definition — never stamp it live with a fresh timestamp (ported
            // from the classic branch, which already refused to).
            return jsonResponse(result.payload, 200, {
                ...result.meta,
                status: result.payload?.meta?.stale ? 'stale' : (result.meta?.status || 'live')
            });
        }

        if (url.pathname === '/api/vessels') {
            const theater = url.searchParams.get('theater') || 'global';
            const cacheKey = `vessels:v7:${theater}`;
            const ttlMs = 15 * 60 * 1000;
            const now = Date.now();
            const cached = getSharedCache().get(cacheKey);
            if (cached && cached.expiresAt > now) {
                recordHealth(cacheKey, true, null);
                const payload = cached.payload;
                return jsonResponse(payload, 200, {
                    // A committed snapshot is stale by definition; its age is the file's, not the cache's.
                    status: payload.meta?.connected ? 'live' : (payload.meta?.requiresKey && !payload.meta?.staticSnapshot ? 'unconfigured' : 'stale'),
                    source: payload.meta?.source,
                    cache: 'hit',
                    updatedAt: payload.meta?.staticSnapshot ? (payload.meta?.staticSnapshotAt || cached.updatedAt) : cached.updatedAt,
                });
            }

            const payload = await fetchVesselsPayload(theater, { origin: url.origin, next });
            const count = payload.features?.length ?? 0;
            const usable = payload?.type === 'FeatureCollection' && (count > 0 || payload.meta?.requiresKey);
            if (usable) {
                const updatedAt = new Date().toISOString();
                getSharedCache().set(cacheKey, { payload, updatedAt, expiresAt: now + ttlMs });
                recordHealth(cacheKey, true, null);
            } else if (cached?.payload?.features?.length > 0) {
                // Upstream blipped: hold the last good snapshot rather than empty the map.
                recordHealth(cacheKey, true, payload.meta?.aisError || 'stale hold');
                return jsonResponse(cached.payload, 200, {
                    status: 'stale',
                    cache: 'stale-hold',
                    updatedAt: cached.updatedAt,
                });
            } else {
                recordHealth(cacheKey, false, payload.meta?.aisError || 'empty vessel snapshot');
            }

            return jsonResponse(payload, 200, {
                status: payload.meta?.connected ? 'live' : (payload.meta?.requiresKey && !payload.meta?.staticSnapshot ? 'unconfigured' : 'stale'),
                source: payload.meta?.source,
                cache: usable ? 'miss' : 'bypass',
                updatedAt: payload.meta?.staticSnapshot ? (payload.meta?.staticSnapshotAt || payload.meta?.fetchedAt) : payload.meta?.fetchedAt,
            });
        }

        if (url.pathname === '/api/oracle') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const scenario = url.searchParams.get('scenario') || null;
            const escDeltaRaw = url.searchParams.get('escDelta');
            const escalationDelta = escDeltaRaw != null ? Number(escDeltaRaw) : undefined;
            const pRaw = url.searchParams.get('p');
            let postureDeltas = null;
            if (pRaw) {
                postureDeltas = {};
                for (const pair of pRaw.split(',')) {
                    const [id, delta] = pair.split(':');
                    if (id && delta != null && Number.isFinite(Number(delta))) {
                        postureDeltas[id] = Number(delta);
                    }
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
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/flood') {
            const requestedCity = url.searchParams.get('city');
            const cityId = FLOOD_CITIES[requestedCity] ? requestedCity : 'ayutthaya';
            const result = await useCached(
                `flood:${cityId}`,
                10 * 60 * 1000,
                () => buildFloodOps(cityId),
                (p) => Array.isArray(p?.geo?.stations?.features) && p.geo.stations.features.length > 0
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/flood/directive') {
            const requestedCity = url.searchParams.get('city');
            const cityId = FLOOD_CITIES[requestedCity] ? requestedCity : 'ayutthaya';
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
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/rainviewer') {
            const result = await useCached(
                'rainviewer:radar',
                5 * 60 * 1000,
                () => getRainviewerRadarTiles(),
                (p) => Array.isArray(p?.tiles) && p.tiles.length > 0
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/acled') {
            const since = url.searchParams.get('since');
            const theater = url.searchParams.get('theater') || 'middleeast';
            const cacheKey = since ? `acled:${theater}:${since}` : `acled:${theater}`;
            const result = await useCached(
                cacheKey,
                60 * 60 * 1000,
                () => fetchAcledEvents(since ? { since, theater } : { theater }),
                (p) => p?.type === 'FeatureCollection'
            );
            if (result.meta.cache !== 'hit' && result.payload?.source === 'acled') upsertAcledEvents(result.payload).catch(() => {});
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/oil-prices') {
            const result = await useCached(
                'oil-prices',
                30 * 60 * 1000,
                () => fetchOilPriceTimeline(),
                (p) => Array.isArray(p?.brent)
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/markets') {
            const result = await useCached(
                'markets',
                60000,
                () => fetchMarketPayload(),
                (payload) => Array.isArray(payload) && payload.length > 0
            );
            if (result.meta.cache !== 'hit') upsertMarketQuotes(result.payload).catch(() => {});
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/stac/search') {
            const bbox = url.searchParams.get('bbox');
            if (!bbox) {
                return jsonResponse({ error: 'bbox parameter required (west,south,east,north)' }, 400);
            }
            const bboxArr = bbox.split(',').map(Number);
            if (bboxArr.length !== 4 || bboxArr.some((n) => !Number.isFinite(n))) {
                return jsonResponse({ error: 'bbox must be 4 comma-separated numbers' }, 400);
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
            return jsonResponse(result.payload, 200, result.meta);
        }

        if (url.pathname === '/api/stac/presets') {
            return jsonResponse(listEvalscriptPresets());
        }

        if (url.pathname === '/api/cog/probe') {
            const cogUrl = url.searchParams.get('url');
            if (!cogUrl) {
                return jsonResponse({ error: 'url parameter required' }, 400);
            }
            if (!isAllowedCogUrl(cogUrl)) {
                return jsonResponse({ error: 'url host not allowed' }, 400);
            }
            const probeResult = await probeCog(cogUrl);
            return jsonResponse(probeResult);
        }

        if (url.pathname === '/api/copernicus/preview') {
            const options = parseCopernicusPreviewOptions(url.searchParams);

            if (!isCopernicusConfigured()) {
                return jsonResponse(
                    buildCopernicusUnavailablePayload(options),
                    200,
                    { status: 'live', updatedAt: '', cache: 'miss' }
                );
            }

            const cacheKey = `copernicus:${JSON.stringify(options)}`;
            const result = await useCached(
                cacheKey,
                20 * 60 * 1000,
                () => fetchCopernicusPreview(options),
                (payload) => payload?.available === true
                    && typeof payload?.imageDataUrl === 'string'
                    && payload.imageDataUrl.startsWith('data:image/')
            );
            return jsonResponse(result.payload, 200, result.meta);
        }

        return jsonResponse({ error: 'Not found' }, 404, { status: 'offline' });
    } catch (error) {
        return jsonResponse(
            { error: error.message || 'Internal server error' },
            500,
            { status: 'offline' }
        );
    }
}
