/**
 * Unified flight payload — airplanes.live primary, OpenSky authenticated supplement, Aviation Edge optional.
 */
import { fetchAirplanesLivePayload } from './airplanesLive.mjs';
import { fetchAviationEdgePayload } from './aviationEdge.mjs';
import { fetchOpenSkyPayload, isOpenSkyConfigured } from './opensky.mjs';

const normalizeHex = (hex) => (hex || '').toLowerCase().replace(/^0x/, '');

const mergeFlightPayloads = (primary, supplement) => {
    const byHex = new Map();

    for (const feature of primary.features) {
        const hex = normalizeHex(feature.properties?.hex);
        if (hex) byHex.set(hex, feature);
    }

    let enriched = 0;
    let added = 0;

    for (const feature of supplement.features) {
        const hex = normalizeHex(feature.properties?.hex);
        if (!hex) continue;

        const existing = byHex.get(hex);
        if (existing) {
            const props = existing.properties;
            const extra = feature.properties;
            if (!props.origin && extra.origin) props.origin = extra.origin;
            if (extra.category != null) props.openskyCategory = extra.category;
            if (extra.spi) props.spi = extra.spi;
            if (!props.military && extra.military) props.military = extra.military;
            if (!props.callsign && extra.callsign) props.callsign = extra.callsign;
            enriched += 1;
        } else {
            byHex.set(hex, feature);
            added += 1;
        }
    }

    const features = [...byHex.values()];
    const primarySource = primary.meta?.source || 'airplanes.live';
    const supplementSource = supplement.meta?.source || 'opensky';

    return {
        type: 'FeatureCollection',
        features,
        meta: {
            ...primary.meta,
            count: features.length,
            fetchedAt: new Date().toISOString(),
            source: `${primarySource}+${supplementSource}`,
            openskyEnriched: enriched,
            openskyAdded: added,
            openskyConfigured: true
        }
    };
};

export const fetchFlightsPayload = async (theater = 'global') => {
    const primary = await fetchAirplanesLivePayload(theater);

    if (isOpenSkyConfigured()) {
        const opensky = await fetchOpenSkyPayload(theater);
        if (opensky.features?.length > 0) {
            if (primary.features?.length > 0) return mergeFlightPayloads(primary, opensky);
            return {
                ...opensky,
                meta: {
                    ...opensky.meta,
                    source: 'opensky',
                    fallback: 'airplanes.live empty'
                }
            };
        }
    }

    if (primary.features?.length > 0) return primary;

    const apiKey = process.env.AVIATION_EDGE_KEY;
    if (apiKey) {
        const fallback = await fetchAviationEdgePayload(theater, apiKey);
        if (fallback.features?.length > 0) return fallback;
    }

    return primary;
};
