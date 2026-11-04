import { fetchBackendJson } from './backendClient.js';

// A position older than this is a last-known fix, not a vessel "at sea now".
// Free terrestrial AIS leaves most ships last-heard days ago (see research/ paper,
// Sec. "The free ship feed is blind where it matters"), so we mark them instead of
// letting stale ships pose as live ones.
export const AIS_STALE_HOURS = 6;

export const annotateVesselAge = (payload, now = Date.now()) => {
    if (!payload?.features?.length) return payload;
    const limit = AIS_STALE_HOURS * 3600 * 1000;
    let fresh = 0;
    const features = payload.features.map((feature) => {
        const t = Date.parse(feature.properties?.timestamp);
        const stale = Number.isFinite(t) ? now - t > limit : false;
        if (!stale) fresh += 1;
        return { ...feature, properties: { ...feature.properties, stale } };
    });
    const next = { ...payload, features, ageSummary: { fresh, total: features.length, staleHours: AIS_STALE_HOURS } };
    // fetchBackendJson attaches a non-enumerable __meta; spreading drops it, so re-attach.
    if (payload.__meta) Object.defineProperty(next, '__meta', { value: payload.__meta, enumerable: false, configurable: true });
    return next;
};

export const fetchVessels = async (theater = 'middleeast') =>
    annotateVesselAge(await fetchBackendJson('/api/vessels', { theater }));
