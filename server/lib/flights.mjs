/**
 * Unified flight payload — airplanes.live primary, Aviation Edge optional fallback.
 */
import { fetchAirplanesLivePayload } from './airplanesLive.mjs';
import { fetchAviationEdgePayload } from './aviationEdge.mjs';

export const fetchFlightsPayload = async (theater = 'global') => {
    const primary = await fetchAirplanesLivePayload(theater);
    if (primary.features?.length > 0) return primary;

    const apiKey = process.env.AVIATION_EDGE_KEY;
    if (apiKey) {
        const fallback = await fetchAviationEdgePayload(theater, apiKey);
        if (fallback.features?.length > 0) return fallback;
    }

    return primary;
};
