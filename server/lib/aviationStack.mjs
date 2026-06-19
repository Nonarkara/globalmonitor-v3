/**
 * aviationstack quota-safe flight supplement.
 *
 * Free plan is 100 requests/month. Keep this to one network pull per theater
 * every 8 hours (3/day max) and return stale in-memory data between pulls.
 */

const API_BASE = 'http://api.aviationstack.com/v1/flights';
const CACHE_MS = 8 * 60 * 60 * 1000;
const MAX_RESULTS = 100;

const THEATER_FILTERS = {
    middleeast: { depIata: null, arrIata: null },
    indopacific: { depIata: null, arrIata: null },
    thailand: { depIata: 'BKK', arrIata: null },
    global: { depIata: null, arrIata: null },
    worldwide: { depIata: null, arrIata: null },
};

const cache = new Map();

const THEATER_BOUNDS = {
    middleeast: { lamin: 10, lomin: 24, lamax: 42, lomax: 65 },
};

const getApiKey = () => process.env.AVIATIONSTACK_API_KEY || process.env.AVIATION_STACK_KEY || '';

const numberOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const normalizeStatus = (status) => String(status || '').toLowerCase();

const toFeature = (flight) => {
    const live = flight?.live || {};
    const aircraft = flight?.aircraft || {};
    const airline = flight?.airline || {};
    const departure = flight?.departure || {};
    const arrival = flight?.arrival || {};
    const lat = numberOrNull(live.latitude);
    const lon = numberOrNull(live.longitude);

    if (lat == null || lon == null) return null;

    const callsign = flight?.flight?.icao || flight?.flight?.iata || flight?.flight?.number || aircraft?.icao24 || 'Unknown';
    const altitudeM = numberOrNull(live.altitude) ?? 0;
    const speedKmh = numberOrNull(live.speed_horizontal) ?? 0;

    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [lon, lat],
        },
        properties: {
            callsign,
            hex: aircraft?.icao24 ? String(aircraft.icao24).toLowerCase() : `as-${callsign}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
            origin: departure?.iata || departure?.icao || '',
            destination: arrival?.iata || arrival?.icao || '',
            airline: airline?.name || airline?.iata || airline?.icao || '',
            altitude: altitudeM,
            velocity: speedKmh * 0.277778,
            heading: numberOrNull(live.direction) ?? 0,
            onGround: normalizeStatus(flight?.flight_status) !== 'active' || altitudeM < 50,
            type: aircraft?.icao || aircraft?.iata || aircraft?.registration || 'Unknown',
            desc: aircraft?.registration || '',
            military: false,
            source: 'aviationstack',
        },
    };
};

const buildUrl = (theater, apiKey) => {
    const params = new URLSearchParams({
        access_key: apiKey,
        flight_status: 'active',
        limit: String(MAX_RESULTS),
    });
    const filters = THEATER_FILTERS[theater] || THEATER_FILTERS.global;
    if (filters.depIata) params.set('dep_iata', filters.depIata);
    if (filters.arrIata) params.set('arr_iata', filters.arrIata);
    return `${API_BASE}?${params}`;
};

const buildPayload = (theater, features, meta = {}) => ({
    type: 'FeatureCollection',
    features,
    meta: {
        theater,
        count: features.length,
        fetchedAt: new Date().toISOString(),
        source: 'aviationstack',
        quotaPolicy: '8h-cache',
        ...meta,
    },
});

export const isAviationStackConfigured = () => Boolean(getApiKey());

const inBounds = (feature, theater) => {
    const bounds = THEATER_BOUNDS[theater];
    if (!bounds) return true;
    const [lon, lat] = feature.geometry.coordinates;
    return lat >= bounds.lamin && lat <= bounds.lamax && lon >= bounds.lomin && lon <= bounds.lomax;
};

export const fetchAviationStackPayload = async (theater = 'global', { force = false } = {}) => {
    const resolved = theater === 'worldwide' ? 'global' : theater;
    const apiKey = getApiKey();
    const cached = cache.get(resolved);
    const now = Date.now();

    if (resolved !== 'middleeast') {
        return buildPayload(resolved, [], {
            configured: Boolean(apiKey),
            skipped: 'aviationstack reserved for Middle East focus to protect 100/month quota',
        });
    }

    if (!apiKey) {
        return buildPayload(resolved, [], { configured: false, error: 'AVIATIONSTACK_API_KEY not set' });
    }

    if (!force && cached && now - cached.fetchedAt < CACHE_MS) {
        return {
            ...cached.payload,
            meta: {
                ...cached.payload.meta,
                cache: 'hit',
                nextRefreshAt: new Date(cached.fetchedAt + CACHE_MS).toISOString(),
            },
        };
    }

    try {
        const res = await fetch(buildUrl(resolved, apiKey), {
            signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();

        if (!res.ok || data?.error) {
            const message = data?.error?.message || data?.error?.info || `aviationstack ${res.status}`;
            throw new Error(message);
        }

        const features = (Array.isArray(data?.data) ? data.data : [])
            .map(toFeature)
            .filter(Boolean)
            .filter((feature) => inBounds(feature, resolved));

        const payload = buildPayload(resolved, features, {
            configured: true,
            cache: 'refresh',
            pagination: data?.pagination || null,
            nextRefreshAt: new Date(now + CACHE_MS).toISOString(),
        });

        cache.set(resolved, { fetchedAt: now, payload });
        return payload;
    } catch (err) {
        if (cached) {
            return {
                ...cached.payload,
                meta: {
                    ...cached.payload.meta,
                    cache: 'stale',
                    error: err.message,
                    nextRefreshAt: new Date(cached.fetchedAt + CACHE_MS).toISOString(),
                },
            };
        }

        return buildPayload(resolved, [], {
            configured: true,
            error: err.message,
            cache: 'miss',
        });
    }
};
