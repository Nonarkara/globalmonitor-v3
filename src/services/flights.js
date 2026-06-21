import { fetchBackendJson } from './backendClient.js';

const CLIENT_CACHE_PREFIX = 'tech-monitor:last-good-flights';

const hasFlightFeatures = (payload) => (
    payload?.type === 'FeatureCollection'
    && Array.isArray(payload.features)
    && payload.features.length > 0
);

const withMeta = (payload, meta) => {
    if (!payload || typeof payload !== 'object') return payload;

    Object.defineProperty(payload, '__meta', {
        value: meta,
        enumerable: false,
        configurable: true
    });

    return payload;
};

const readLastGoodFlights = (theater) => {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(`${CLIENT_CACHE_PREFIX}:${theater}`);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!hasFlightFeatures(parsed?.data)) return null;

        return withMeta(parsed.data, {
            status: 'stale',
            updatedAt: parsed.lastUpdated || null,
            cache: 'client-flight-fallback'
        });
    } catch {
        return null;
    }
};

const writeLastGoodFlights = (theater, payload) => {
    if (typeof window === 'undefined' || !hasFlightFeatures(payload)) return;

    try {
        const updatedAt = payload.__meta?.updatedAt || new Date().toISOString();
        window.localStorage.setItem(`${CLIENT_CACHE_PREFIX}:${theater}`, JSON.stringify({
            data: payload,
            lastUpdated: updatedAt
        }));
    } catch {
        // If storage is unavailable, keep the live response and let the map render.
    }
};

export const fetchFlights = async (theater = 'middleeast') => {
    try {
        const payload = await fetchBackendJson('/api/flights', { theater });

        if (hasFlightFeatures(payload)) {
            writeLastGoodFlights(theater, payload);
            return payload;
        }

        return readLastGoodFlights(theater) || payload;
    } catch (error) {
        const fallback = readLastGoodFlights(theater);
        if (fallback) return fallback;
        throw error;
    }
};
