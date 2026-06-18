/**
 * VesselFinder AIS API — fleet overlay + account status.
 * Docs: https://api.vesselfinder.com/docs/
 *
 * Free tier: vesselslist (fleet key) for up to N fleet vessels; livedata is paid subscription.
 * Credit key (VESSELFINDER_API_KEY): per-vessel lookups via /vessels — not used for global map.
 *
 * Env: VESSELFINDER_FLEET_KEY, VESSELFINDER_API_KEY
 */
import { mapShipTypeCategory } from './shipTypes.mjs';

const API_BASE = 'https://api.vesselfinder.com';
const FLEET_CACHE_MS = 10 * 60 * 1000; // 10 min — ships move slowly

let fleet_cache = { fetchedAt: 0, vessels: [], error: null, fleetSize: 0 };
let status_cache = { fetchedAt: 0, fleet: null, api: null };

function hasFleetKey() {
    return Boolean(process.env.VESSELFINDER_FLEET_KEY);
}

function hasApiKey() {
    return Boolean(process.env.VESSELFINDER_API_KEY);
}

async function vfFetch(method, userkey, params = {}) {
    const qs = new URLSearchParams({ userkey, format: 'json', ...params });
    const url = `${API_BASE}/${method}?${qs}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = { error: text.slice(0, 200) };
    }
    if (body?.error) {
        throw new Error(String(body.error));
    }
    return { body, headers: res.headers };
}

/** HEADING 511 = not available — fall back to course */
function resolveHeading(ais) {
    const heading = Number(ais.HEADING);
    const course = Number(ais.COURSE) || 0;
    if (heading !== 511 && Number.isFinite(heading)) return heading;
    return course;
}

function vesselRecordToFeature(entry, source = 'vesselfinder-fleet') {
    const ais = entry?.AIS;
    if (!ais) return null;
    const lon = Number(ais.LONGITUDE);
    const lat = Number(ais.LATITUDE);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

    const mmsi = String(ais.MMSI || '');
    if (!mmsi) return null;

    const shipType = Number(ais.TYPE) || 0;
    const course = Number(ais.COURSE) || 0;

    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
            mmsi,
            name: (ais.NAME || '').trim() || mmsi,
            heading: resolveHeading(ais),
            course,
            speed: Number(ais.SPEED) || 0,
            shipType,
            category: mapShipTypeCategory(shipType),
            imo: ais.IMO || null,
            destination: ais.DESTINATION || null,
            source,
        },
    };
}

export async function fetchVesselFinderStatus() {
    const now = Date.now();
    if (status_cache.fetchedAt && now - status_cache.fetchedAt < FLEET_CACHE_MS) {
        return status_cache;
    }

    const result = { fetchedAt: now, fleet: null, api: null };

    if (hasFleetKey()) {
        try {
            const { body } = await vfFetch('status', process.env.VESSELFINDER_FLEET_KEY);
            result.fleet = {
                credits: body.CREDITS ?? null,
                expiration: body.EXPIRATION_DATE ?? null,
            };
        } catch (err) {
            result.fleet = { error: err.message };
        }
    }

    if (hasApiKey()) {
        try {
            const { body } = await vfFetch('status', process.env.VESSELFINDER_API_KEY);
            result.api = {
                credits: body.CREDITS ?? null,
                expiration: body.EXPIRATION_DATE ?? null,
            };
        } catch (err) {
            result.api = { error: err.message };
        }
    }

    status_cache = result;
    return result;
}

/** Fleet positions via vesselslist — returns [] when fleet is empty */
export async function fetchFleetVessels(force = false) {
    if (!hasFleetKey()) {
        return { vessels: [], error: 'VESSELFINDER_FLEET_KEY not set', fleetSize: 0 };
    }

    const now = Date.now();
    if (!force && fleet_cache.fetchedAt && now - fleet_cache.fetchedAt < FLEET_CACHE_MS) {
        return fleet_cache;
    }

    try {
        const { body } = await vfFetch('vesselslist', process.env.VESSELFINDER_FLEET_KEY, {
            interval: 60,
        });

        const list = Array.isArray(body) ? body : [];
        const vessels = list
            .map((entry) => vesselRecordToFeature(entry))
            .filter(Boolean);

        fleet_cache = {
            fetchedAt: now,
            vessels,
            error: null,
            fleetSize: list.length,
        };
        return fleet_cache;
    } catch (err) {
        fleet_cache = {
            fetchedAt: now,
            vessels: fleet_cache.vessels,
            error: err.message,
            fleetSize: fleet_cache.fleetSize,
        };
        return fleet_cache;
    }
}

/** Current fleet list IMO/MMSI from listmanager */
export async function fetchFleetList() {
    if (!hasFleetKey()) return { imo: [], mmsi: [] };
    try {
        const { body } = await vfFetch('listmanager', process.env.VESSELFINDER_FLEET_KEY);
        return {
            imo: body?.IMO || body?.imo || [],
            mmsi: body?.MMSI || body?.mmsi || [],
        };
    } catch {
        return { imo: [], mmsi: [] };
    }
}

export function getFleetFeatures() {
    return fleet_cache.vessels || [];
}

export function getFleetMeta() {
    return {
        fleetSize: fleet_cache.fleetSize,
        error: fleet_cache.error,
        fetchedAt: fleet_cache.fetchedAt ? new Date(fleet_cache.fetchedAt).toISOString() : null,
    };
}

export function getVesselFinderConfig() {
    return {
        fleetKey: hasFleetKey(),
        apiKey: hasApiKey(),
        cacheAgeMs: fleet_cache.fetchedAt ? Date.now() - fleet_cache.fetchedAt : null,
    };
}

/** Background refresh — call once at server boot */
export function startVesselFinderRefresh() {
    if (!hasFleetKey()) return;

    const tick = () => fetchFleetVessels(true).catch(() => {});
    tick();
    setInterval(tick, FLEET_CACHE_MS);
}
