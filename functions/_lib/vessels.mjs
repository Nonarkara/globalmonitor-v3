import { fetchFleetVessels, getVesselFinderConfig } from '../../server/lib/vesselFinder.mjs';

const THEATER_BBOXES = {
    thailand: [97, 5, 106, 21],
    indopacific: [90, -10, 135, 25],
    middleeast: [24, 10, 65, 42]
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

/** Worker-safe vessel feed — VesselFinder fleet REST; no persistent AIS WebSocket on Pages. */
export async function fetchVesselsPayload(theater = 'global') {
    const vfConfig = getVesselFinderConfig();
    const hasAisKey = Boolean(process.env.AISSTREAM_API_KEY);
    const fleetResult = vfConfig.fleetKey ? await fetchFleetVessels() : { vessels: [], fleetSize: 0, error: null };
    const fleet = fleetResult.vessels || [];
    const filtered = filterByTheater(fleet, theater);
    const sources = [];

    if (vfConfig.fleetKey) sources.push('vesselfinder-fleet');
    const fleetEmpty = vfConfig.fleetKey && fleet.length === 0;

    return {
        type: 'FeatureCollection',
        features: filtered,
        meta: {
            count: filtered.length,
            fetchedAt: new Date().toISOString(),
            source: sources.length ? sources.join('+') : 'none',
            sources,
            connected: vfConfig.fleetKey && !fleetResult.error,
            coverage: hasAisKey ? 'fleet+ais-unavailable-on-pages' : (vfConfig.fleetKey ? 'fleet-only' : 'none'),
            requiresKey: !hasAisKey && !vfConfig.fleetKey,
            runtime: 'cloudflare-pages',
            aisNote: hasAisKey
                ? 'AISSTREAM_API_KEY is set but global AIS WebSocket requires a long-running Node host; Pages serves VesselFinder fleet overlay only.'
                : null,
            vesselfinder: {
                fleetKey: vfConfig.fleetKey,
                apiKey: vfConfig.apiKey,
                fleetCount: fleet.length,
                fleetEmpty,
                fleetHint: fleetEmpty
                    ? 'Add vessels to your VesselFinder fleet (up to 10 on free plan) for tracked overlay'
                    : null,
                livedataNote: 'Worldwide area queries (LiveData) require paid VesselFinder subscription'
            },
            keyHint: (hasAisKey || vfConfig.fleetKey) ? null
                : 'Set VESSELFINDER_FLEET_KEY (vesselfinder.com) for ship overlay on Cloudflare Pages'
        }
    };
}
