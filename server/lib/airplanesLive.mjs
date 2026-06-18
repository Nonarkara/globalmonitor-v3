/**
 * Airplanes.live — live ADS-B positions (github.com/airplanes-live/api).
 * Free, no API key. Rate limit: 1 req/sec. Max radius: 250 nm per point.
 * Middle East theater uses multiple query points for coverage.
 */

const MAX_RADIUS_NM = 250;
const REQUEST_GAP_MS = 1500;

const THEATER_BOUNDS = {
    global: { lamin: -90, lomin: -180, lamax: 90, lomax: 180 },
    worldwide: { lamin: -90, lomin: -180, lamax: 90, lomax: 180 },
    middleeast: { lamin: 10, lomin: 24, lamax: 42, lomax: 65 },
    indopacific: { lamin: -10, lomin: 90, lamax: 25, lomax: 135 },
    thailand: { lamin: 5, lomin: 97, lamax: 21, lomax: 106 }
};

/** Overlapping 250 nm circles to cover each theater bbox. */
const THEATER_QUERY_POINTS = {
    global: [
        { lat: 40.0, lon: -100.0 },  // North America central
        { lat: 45.0, lon: -70.0 },   // US East / Atlantic
        { lat: 60.0, lon: -150.0 },  // Alaska / North Pacific
        { lat: 51.0, lon: 0.0 },       // UK / Western Europe
        { lat: 48.0, lon: 10.0 },      // Central Europe
        { lat: 55.0, lon: 37.0 },      // Eastern Europe / Russia west
        { lat: 25.0, lon: 55.0 },      // Gulf / Middle East
        { lat: 30.0, lon: 80.0 },      // South Asia
        { lat: 35.0, lon: 135.0 },     // Japan
        { lat: 20.0, lon: 110.0 },     // Southeast Asia
        { lat: 10.0, lon: -75.0 },     // Caribbean / northern South America
        { lat: -25.0, lon: 135.0 },    // Australia
        { lat: -15.0, lon: -50.0 },    // Brazil
        { lat: -35.0, lon: 25.0 }      // South Africa
    ],
    worldwide: null, // alias → global
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

const fetchPoint = async (lat, lon, attempt = 0) => {
    const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${MAX_RADIUS_NM}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (res.status === 429 && attempt < 3) {
        await sleep(1500 * (attempt + 1));
        return fetchPoint(lat, lon, attempt + 1);
    }
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

const resolveTheater = (theater) => {
    if (theater === 'worldwide') return 'global';
    return THEATER_BOUNDS[theater] ? theater : 'global';
};

export const fetchAirplanesLivePayload = async (theater = 'global') => {
    const resolved = resolveTheater(theater);
    const bounds = THEATER_BOUNDS[resolved];
    const points = THEATER_QUERY_POINTS[resolved] || THEATER_QUERY_POINTS.global;
    const byHex = new Map();
    const pointErrors = [];

    try {
        for (let i = 0; i < points.length; i++) {
            if (i > 0) await sleep(REQUEST_GAP_MS);
            try {
                const aircraft = await fetchPoint(points[i].lat, points[i].lon);
                for (const ac of aircraft) {
                    if (ac.lat == null || ac.lon == null) continue;
                    if (!inBounds(ac.lat, ac.lon, bounds)) continue;
                    const key = ac.hex || `${ac.lat},${ac.lon},${ac.flight || ''}`;
                    if (!byHex.has(key)) byHex.set(key, toFeature(ac));
                }
            } catch (pointErr) {
                pointErrors.push(pointErr.message);
            }
        }

        const features = [...byHex.values()];
        return {
            type: 'FeatureCollection',
            features,
            meta: {
                theater: resolved,
                count: features.length,
                fetchedAt: new Date().toISOString(),
                source: 'airplanes.live',
                coverage: resolved === 'global' ? 'worldwide' : resolved,
                ...(features.length === 0 && pointErrors.length ? { error: pointErrors[0] } : {})
            }
        };
    } catch (err) {
        console.error('Airplanes.live error:', err.message);
        return {
            type: 'FeatureCollection',
            features: [],
            meta: {
                theater: resolved,
                count: 0,
                fetchedAt: new Date().toISOString(),
                source: 'airplanes.live',
                coverage: resolved === 'global' ? 'worldwide' : resolved,
                error: err.message
            }
        };
    }
};
