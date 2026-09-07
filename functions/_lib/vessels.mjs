import { fetchAxiomGlobalSnapshot } from './axiomOverwatch.mjs';
import { fetchFleetVessels, getVesselFinderConfig } from '../../server/lib/vesselFinder.mjs';
import { AIS_BOXES_BY_THEATER, fetchAisSnapshotWithRetry } from './aisSnapshot.mjs';
import { getSharedCache } from './cache.mjs';

const AIS_CACHE_KEY = 'vessels:ais:global:v3';
const MAX_CLIENT_VESSELS = 1200;
const FLEET_SOURCE = 'vesselfinder-fleet';

const sampleForClient = (features, max = MAX_CLIENT_VESSELS) => {
    if (features.length <= max) return features;

    const pinned = features.filter((feature) => feature.properties?.source === FLEET_SOURCE);
    if (pinned.length >= max) return pinned.slice(0, max);

    const sampleBudget = max - pinned.length;
    const remainder = features.filter((feature) => feature.properties?.source !== FLEET_SOURCE);
    const stride = remainder.length / sampleBudget;
    const sampled = Array.from(
        { length: sampleBudget },
        (_, index) => remainder[Math.floor(index * stride)],
    ).filter(Boolean);

    const selected = new Set([...pinned, ...sampled]);
    return features.filter((feature) => selected.has(feature));
};
const STATIC_SNAPSHOT_PATH = '/data/ais/ais-snapshot.json';
const AIS_CACHE_TTL_MS = 15 * 60 * 1000;
const AIS_STALE_HOLD_MS = 30 * 60 * 1000;
/** CF Pages Workers open AIS WebSocket but receive zero frames — static snapshot only. */
const IS_CF_WORKER = typeof navigator === 'undefined' && typeof globalThis.WebSocket !== 'undefined';

const THEATER_BBOXES = {
    thailand: [95, 0.5, 108, 22],
    indopacific: [90, -10, 135, 25],
    eastasia: [100, 18, 148, 47],
    southasia: [60, 5, 92, 37],
    middleeast: [24, 10, 65, 42],
};

const filterByTheater = (features, theater) => {
    const bbox = THEATER_BBOXES[theater];
    if (!bbox || theater === 'global') return features;

    const [minLon, minLat, maxLon, maxLat] = bbox;
    return features.filter((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        const [lon, lat] = coords;
        return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });
};

const mergeFeatures = (primary, supplement) => {
    const byMmsi = new Map();
    for (const feature of primary) {
        const mmsi = feature.properties?.mmsi;
        if (mmsi) byMmsi.set(mmsi, feature);
    }
    for (const feature of supplement) {
        const mmsi = feature.properties?.mmsi;
        if (!mmsi || byMmsi.has(mmsi)) continue;
        byMmsi.set(mmsi, feature);
    }
    return [...byMmsi.values()];
};

const resolveSnapshotAisSource = (staticMeta, features) => {
    const metaSource = staticMeta?.source || '';
    if (metaSource.includes('axiom-overwatch')) return 'axiom-overwatch';
    const featureSource = features?.[0]?.properties?.source || '';
    if (featureSource.includes('axiom-overwatch')) return 'axiom-overwatch';
    return 'static-snapshot';
};

/** Static snapshot baked into dist/ — fallback when Worker WebSocket collect is empty. */
async function loadStaticAisSnapshot(origin, next) {
    if (!origin) return { features: [], meta: null, error: 'no_origin' };

    const cache = getSharedCache();
    const staticKey = 'vessels:ais:static:v1';
    const cached = cache.get(staticKey);
    if (cached?.features?.length > 0) {
        return { features: cached.features, meta: cached.meta || null, cache: 'static-hit' };
    }

    try {
        const url = new URL(STATIC_SNAPSHOT_PATH, origin).href;
        const request = new Request(url, { headers: { accept: 'application/json' } });
        const resp = next
            ? await next(request)
            : await fetch(request, { cf: { cacheTtl: 300 } });
        if (!resp.ok) {
            return { features: [], meta: null, error: `static_fetch_${resp.status}` };
        }
        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
            return { features: [], meta: null, error: 'static_fetch_not_json' };
        }
        const payload = await resp.json();
        const features = Array.isArray(payload?.features) ? payload.features : [];
        const meta = payload?.meta || null;
        if (features.length > 0) {
            cache.set(staticKey, { features, meta, loadedAt: Date.now() });
        }
        return { features, meta, cache: 'static-miss' };
    } catch (err) {
        return { features: [], meta: null, error: err.message || 'static_fetch_failed' };
    }
}

const cacheAisResult = (cache, now, features, aisSource, staticMeta, error, aisAttempt) => {
    cache.set(AIS_CACHE_KEY, {
        features,
        error: error || null,
        expiresAt: now + AIS_CACHE_TTL_MS,
        staleHoldUntil: now + AIS_STALE_HOLD_MS,
        collectedAt: now,
        aisSource,
        staticMeta,
    });
};

/** One global AIS collect per cache TTL — static snapshot first on CF (WS never delivers frames). */
async function getGlobalAisFeatures(apiKey, origin, next) {
    const cache = getSharedCache();
    const now = Date.now();
    const hit = cache.get(AIS_CACHE_KEY);
    if (hit && hit.expiresAt > now) {
        return {
            features: hit.features || [],
            error: hit.error || null,
            cache: 'hit',
            aisSource: hit.aisSource || null,
            staticMeta: hit.staticMeta || null,
        };
    }

    let features = [];
    let error = null;
    let aisSource = null;
    let staticMeta = null;
    let staticCache = null;
    let aisAttempt = null;

    const staticResult = await loadStaticAisSnapshot(origin, next);
    staticCache = staticResult.cache;
    staticMeta = staticResult.meta;
    if (staticResult.features.length > 0) {
        features = staticResult.features;
        aisSource = resolveSnapshotAisSource(staticMeta, features);
    } else if (staticResult.error) {
        error = staticResult.error;
    }

    if (features.length === 0 && !IS_CF_WORKER && apiKey) {
        const aisResult = await fetchAisSnapshotWithRetry(apiKey, {
            boundingBoxes: AIS_BOXES_BY_THEATER.global,
            timeoutMs: 22000,
            maxVessels: 8000,
            maxAttempts: 2,
        });
        aisAttempt = aisResult.attempt;
        if (aisResult.features?.length > 0) {
            features = aisResult.features;
            aisSource = 'live-ws';
            error = null;
        } else if (!error) {
            error = aisResult.error || 'empty_ais_snapshot';
        }
    } else if (features.length === 0 && IS_CF_WORKER && !error) {
        error = 'empty_ais_snapshot';
    }

    if (features.length === 0) {
        const axiomResult = await fetchAxiomGlobalSnapshot();
        if (axiomResult.features?.length > 0) {
            features = axiomResult.features;
            aisSource = 'axiom-overwatch';
            staticMeta = {
                collectedAt: axiomResult.meta?.updated_at ?? new Date().toISOString(),
                vesselCount: axiomResult.features.length,
                source: 'axiom-overwatch.io',
                truncated: axiomResult.truncated ?? false,
            };
            error = null;
        } else if (!error) {
            error = axiomResult.error || 'empty_ais_snapshot';
        }
    }

    if (features.length > 0) {
        cacheAisResult(cache, now, features, aisSource, staticMeta, null, aisAttempt);
        return {
            features,
            error: null,
            cache: aisSource === 'static-snapshot' ? 'static-fallback' : 'miss',
            aisAttempt,
            aisSource,
            staticMeta,
            staticCache,
        };
    }

    if (hit?.features?.length > 0 && (hit.staleHoldUntil ?? hit.expiresAt) > now) {
        return {
            features: hit.features,
            error,
            cache: 'stale-hold',
            aisAttempt,
            aisSource: hit.aisSource || null,
            staticMeta: hit.staticMeta || null,
        };
    }

    return {
        features: [],
        error,
        cache: 'bypass',
        aisAttempt,
        aisSource: null,
        staticMeta,
        staticCache,
    };
}

/** Worker-safe vessel feed — AIS one-shot snapshot + VesselFinder fleet REST. */
export async function fetchVesselsPayload(theater = 'global', { origin, next } = {}) {
    const vfConfig = getVesselFinderConfig();
    const aisKey = process.env.AISSTREAM_API_KEY || '';
    const hasAisKey = Boolean(aisKey);

    const fleetResult = vfConfig.fleetKey ? await fetchFleetVessels() : { vessels: [], fleetSize: 0, error: null };
    const fleet = fleetResult.vessels || [];

    let aisFeatures = [];
    let aisError = null;
    let aisCache = null;
    let aisAttempt = null;
    let aisSource = null;
    let staticMeta = null;
    if (hasAisKey) {
        try {
            const aisResult = await getGlobalAisFeatures(aisKey, origin, next);
            aisFeatures = aisResult.features;
            aisError = aisResult.error;
            aisCache = aisResult.cache;
            aisAttempt = aisResult.aisAttempt ?? null;
            aisSource = aisResult.aisSource ?? null;
            staticMeta = aisResult.staticMeta ?? null;
        } catch (err) {
            aisError = err.message;
        }
    } else {
        const staticResult = await loadStaticAisSnapshot(origin, next);
        if (staticResult.features.length > 0) {
            aisFeatures = staticResult.features;
            staticMeta = staticResult.meta;
            aisSource = resolveSnapshotAisSource(staticMeta, aisFeatures);
            aisCache = staticResult.cache;
        } else {
            const axiomResult = await fetchAxiomGlobalSnapshot();
            if (axiomResult.features?.length > 0) {
                aisFeatures = axiomResult.features;
                aisSource = 'axiom-overwatch';
                staticMeta = {
                    collectedAt: axiomResult.meta?.updated_at ?? new Date().toISOString(),
                    vesselCount: axiomResult.features.length,
                    source: 'axiom-overwatch.io',
                    truncated: axiomResult.truncated ?? false,
                };
            } else {
                aisError = axiomResult.error || staticResult.error || 'empty_ais_snapshot';
            }
        }
    }

    const merged = mergeFeatures(fleet, aisFeatures);
    const filtered = filterByTheater(merged, theater);
    const clientFeatures = sampleForClient(filtered);
    const theaterAisCount = filterByTheater(aisFeatures, theater).length;
    const sources = [];
    // A committed snapshot file is credited as a snapshot, never as the live
    // provider whose data happened to be in it. The provenance of a file's
    // contents is not the provenance of the file.
    const fromStaticSnapshot = aisSource === 'static-snapshot';
    if (aisSource === 'axiom-overwatch' && theaterAisCount > 0) sources.push('axiom-overwatch.io');
    else if (fromStaticSnapshot && theaterAisCount > 0) sources.push('ais-snapshot');
    else if (hasAisKey && theaterAisCount > 0) sources.push('aisstream.io');
    if (vfConfig.fleetKey) sources.push('vesselfinder-fleet');
    const fleetEmpty = vfConfig.fleetKey && fleet.length === 0;

    return {
        type: 'FeatureCollection',
        features: clientFeatures,
        meta: {
            count: filtered.length,
            deliveredCount: clientFeatures.length,
            sampled: clientFeatures.length < filtered.length,
            fetchedAt: new Date().toISOString(),
            source: sources.length ? sources.join('+') : 'none',
            sources,
            // `connected` means a live feed answered. A snapshot off disk is not
            // connected — the route stamps it STALE and the legend shows its age.
            connected: ((hasAisKey && !fromStaticSnapshot) || aisSource === 'axiom-overwatch') && theaterAisCount > 0 || (vfConfig.fleetKey && !fleetResult.error),
            staticSnapshot: fromStaticSnapshot,
            coverage: (hasAisKey || aisSource === 'static-snapshot' || aisSource === 'axiom-overwatch')
                ? (vfConfig.fleetKey ? 'ais-snapshot+fleet' : 'ais-snapshot')
                : (vfConfig.fleetKey ? 'fleet-only' : 'none'),
            requiresKey: !hasAisKey && !vfConfig.fleetKey,
            runtime: 'cloudflare-pages',
            aisGlobalCount: aisFeatures.length,
            aisCache,
            aisSource,
            staticSnapshotAt: staticMeta?.collectedAt ?? null,
            aisNote: aisSource === 'axiom-overwatch'
                ? 'Axiom Overwatch REST fallback (CC-BY 4.0, axiomoverwatch.io) — 15 min cache, no API key'
                : hasAisKey
                    ? (aisSource === 'static-snapshot'
                        ? 'Static AIS snapshot fallback (Worker WS empty) — refresh via scripts/refresh-ais-snapshot.mjs'
                        : 'Global AIS snapshot (15 min cache, 22s+8s collect + stale hold) filtered by theater bbox')
                    : null,
            aisError,
            aisKeyPresent: hasAisKey,
            aisAttempt,
            vesselfinder: {
                fleetKey: vfConfig.fleetKey,
                apiKey: vfConfig.apiKey,
                fleetCount: fleet.length,
                fleetEmpty,
                fleetHint: fleetEmpty
                    ? 'Add vessels to your VesselFinder fleet (up to 10 on free plan) for tracked overlay'
                    : null,
                livedataNote: 'Worldwide area queries (LiveData) require paid VesselFinder subscription',
            },
            keyHint: (hasAisKey || vfConfig.fleetKey) ? null
                : 'Set AISSTREAM_API_KEY (aisstream.io) and/or VESSELFINDER_FLEET_KEY (vesselfinder.com)',
        },
    };
}
