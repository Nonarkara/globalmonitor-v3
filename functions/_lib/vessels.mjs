import { fetchFleetVessels, getVesselFinderConfig } from '../../server/lib/vesselFinder.mjs';
import { fetchAisSnapshot } from './aisSnapshot.mjs';

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

/** Worker-safe vessel feed — AIS one-shot snapshot + VesselFinder fleet REST. */
export async function fetchVesselsPayload(theater = 'global') {
    const vfConfig = getVesselFinderConfig();
    const aisKey = process.env.AISSTREAM_API_KEY || '';
    const hasAisKey = Boolean(aisKey);

    const fleetResult = vfConfig.fleetKey ? await fetchFleetVessels() : { vessels: [], fleetSize: 0, error: null };
    const fleet = fleetResult.vessels || [];

    let aisFeatures = [];
    let aisError = null;
    if (hasAisKey) {
        try {
            aisFeatures = await fetchAisSnapshot(aisKey);
        } catch (err) {
            aisError = err.message;
        }
    }

    const merged = mergeFeatures(fleet, aisFeatures);
    const filtered = filterByTheater(merged, theater);
    const sources = [];
    if (hasAisKey && aisFeatures.length > 0) sources.push('aisstream.io');
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
            connected: (hasAisKey && aisFeatures.length > 0) || (vfConfig.fleetKey && !fleetResult.error),
            coverage: hasAisKey
                ? (vfConfig.fleetKey ? 'ais-snapshot+fleet' : 'ais-snapshot')
                : (vfConfig.fleetKey ? 'fleet-only' : 'none'),
            requiresKey: !hasAisKey && !vfConfig.fleetKey,
            runtime: 'cloudflare-pages',
            aisNote: hasAisKey
                ? 'AIS snapshot via one-shot WebSocket (Pages-safe); refreshes every cache TTL'
                : null,
            aisError,
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
                : 'Set AISSTREAM_API_KEY (aisstream.io) and/or VESSELFINDER_FLEET_KEY (vesselfinder.com)'
        }
    };
}
