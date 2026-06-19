/**
 * Unified flight payload — airplanes.live primary, OpenSky + aviationstack supplements, Aviation Edge fallback.
 */
import { fetchAirplanesLivePayload } from './airplanesLive.mjs';
import { fetchAviationEdgePayload } from './aviationEdge.mjs';
import { fetchAviationStackPayload, isAviationStackConfigured } from './aviationStack.mjs';
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
    const supplementSource = supplement.meta?.source || 'supplement';

    return {
        type: 'FeatureCollection',
        features,
        meta: {
            ...primary.meta,
            count: features.length,
            fetchedAt: new Date().toISOString(),
            source: `${primarySource}+${supplementSource}`,
            supplementEnriched: (primary.meta?.supplementEnriched || 0) + enriched,
            supplementAdded: (primary.meta?.supplementAdded || 0) + added,
            supplements: [
                ...(Array.isArray(primary.meta?.supplements) ? primary.meta.supplements : []),
                {
                    source: supplementSource,
                    count: supplement.features.length,
                    added,
                    enriched,
                    cache: supplement.meta?.cache || null,
                    fetchedAt: supplement.meta?.fetchedAt || null,
                    error: supplement.meta?.error || null,
                    nextRefreshAt: supplement.meta?.nextRefreshAt || null
                }
            ]
        }
    };
};

export const fetchFlightsPayload = async (theater = 'global') => {
    let payload = await fetchAirplanesLivePayload(theater);

    if (isOpenSkyConfigured()) {
        const opensky = await fetchOpenSkyPayload(theater);
        if (opensky.features?.length > 0) {
            if (payload.features?.length > 0) {
                payload = mergeFlightPayloads(payload, opensky);
            } else {
                payload = {
                    ...opensky,
                    meta: {
                        ...opensky.meta,
                        source: 'opensky',
                        fallback: 'airplanes.live empty'
                    }
                };
            }
        }
    }

    if (isAviationStackConfigured()) {
        const aviationStack = await fetchAviationStackPayload(theater);
        if (aviationStack.features?.length > 0) {
            if (payload.features?.length > 0) {
                payload = mergeFlightPayloads(payload, aviationStack);
            } else {
                payload = {
                    ...aviationStack,
                    meta: {
                        ...aviationStack.meta,
                        fallback: 'airplanes.live empty'
                    }
                };
            }
        } else {
            payload = {
                ...payload,
                meta: {
                    ...payload.meta,
                    supplements: [
                        ...(Array.isArray(payload.meta?.supplements) ? payload.meta.supplements : []),
                        {
                            source: 'aviationstack',
                            count: 0,
                            added: 0,
                            enriched: 0,
                            cache: aviationStack.meta?.cache || null,
                            error: aviationStack.meta?.error || null,
                            nextRefreshAt: aviationStack.meta?.nextRefreshAt || null
                        }
                    ]
                }
            };
        }
    }

    if (payload.features?.length > 0) return payload;

    const apiKey = process.env.AVIATION_EDGE_KEY;
    if (apiKey) {
        const fallback = await fetchAviationEdgePayload(theater, apiKey);
        if (fallback.features?.length > 0) return fallback;
    }

    return payload;
};
