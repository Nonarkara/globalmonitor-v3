/**
 * Airplanes.live — live ADS-B positions (github.com/airplanes-live/api).
 * Free, no API key. Rate limit: 1 req/sec. Max radius: 250 nm per point.
 * Middle East theater uses multiple query points for coverage.
 */

const MAX_RADIUS_NM = 250;
const REQUEST_GAP_MS = 1100;

const THEATER_BOUNDS = {
    middleeast: { lamin: 10, lomin: 24, lamax: 42, lomax: 65 },
    indopacific: { lamin: -10, lomin: 90, lamax: 25, lomax: 135 },
    thailand: { lamin: 5, lomin: 97, lamax: 21, lomax: 106 }
};

/** Overlapping 250 nm circles to cover each theater bbox. */
const THEATER_QUERY_POINTS = {
    middleeast: [
        { lat: 26.0, lon: 50.0 },  // Gulf
        { lat: 32.0, lon: 53.0 },  // Iran
        { lat: 33.5, lon: 36.0 },  // Levant
        { lat: 22.0, lon: 38.0 },  // Red Sea
        { lat: 34.0, lon: 61.0 }   // Eastern theater
    ],
    indopacific: [
        { lat: 5.0, lon: 110.0 },
        { lat: 14.0, lon: 100.0 },
        { lat: -2.0, lon: 118.0 }
    ],
    thailand: [{ lat: 14.5, lon: 100.9925 }]
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const inBounds = (lat, lon, bounds) =>
    lat >= bounds.lamin && lat <= bounds.lamax && lon >= bounds.lomin && lon <= bounds.lomax;

const fetchPoint = async (lat, lon) => {
    const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${MAX_RADIUS_NM}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Airplanes.live ${res.status}`);
    const data = await res.json();
    return data.ac || [];
};

const toFeature = (ac) => {
    let alt = ac.alt_geom ?? ac.alt_baro;
    if (alt === 'ground') alt = 0;

    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [ac.lon, ac.lat]
        },
        properties: {
            callsign: (ac.flight || '').trim() || ac.r || ac.hex,
            hex: ac.hex || '',
            origin: '',
            altitude: (Number(alt) || 0) * 0.3048,
            velocity: (ac.gs || 0) * 0.514444,
            heading: ac.track ?? ac.true_heading ?? ac.mag_heading ?? 0,
            onGround: ac.alt_baro === 'ground' || (Number(alt) || 0) < 50,
            type: ac.t || 'Unknown',
            desc: ac.desc || '',
            military: Boolean(ac.mil)
        }
    };
};

export const fetchAirplanesLivePayload = async (theater = 'middleeast') => {
    const bounds = THEATER_BOUNDS[theater] || THEATER_BOUNDS.middleeast;
    const points = THEATER_QUERY_POINTS[theater] || THEATER_QUERY_POINTS.middleeast;
    const byHex = new Map();

    try {
        for (let i = 0; i < points.length; i++) {
            if (i > 0) await sleep(REQUEST_GAP_MS);
            const aircraft = await fetchPoint(points[i].lat, points[i].lon);
            for (const ac of aircraft) {
                if (ac.lat == null || ac.lon == null) continue;
                if (!inBounds(ac.lat, ac.lon, bounds)) continue;
                const key = ac.hex || `${ac.lat},${ac.lon},${ac.flight || ''}`;
                if (!byHex.has(key)) byHex.set(key, toFeature(ac));
            }
        }

        const features = [...byHex.values()];
        return {
            type: 'FeatureCollection',
            features,
            meta: {
                theater,
                count: features.length,
                fetchedAt: new Date().toISOString(),
                source: 'airplanes.live'
            }
        };
    } catch (err) {
        console.error('Airplanes.live error:', err.message);
        return {
            type: 'FeatureCollection',
            features: [],
            meta: {
                theater,
                count: 0,
                fetchedAt: new Date().toISOString(),
                source: 'airplanes.live',
                error: err.message
            }
        };
    }
};
