/**
 * OpenSky Network — authenticated ADS-B supplement (OAuth2 client credentials).
 * https://opensky-network.org/api/states/all
 */

const TOKEN_URL =
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const STATES_URL = 'https://opensky-network.org/api/states/all';

const THEATER_BOUNDS = {
    global: { lamin: -90, lomin: -180, lamax: 90, lomax: 180 },
    worldwide: { lamin: -90, lomin: -180, lamax: 90, lomax: 180 },
    middleeast: { lamin: 10, lomin: 24, lamax: 42, lomax: 65 },
    indopacific: { lamin: -10, lomin: 90, lamax: 25, lomax: 135 },
    thailand: { lamin: 5, lomin: 97, lamax: 21, lomax: 106 }
};

const CATEGORY_LABELS = {
    0: 'Unknown',
    1: 'No emitter category',
    2: 'Light',
    3: 'Small',
    4: 'Large',
    5: 'High vortex large',
    6: 'Heavy',
    7: 'High performance',
    8: 'Rotorcraft',
    9: 'Glider',
    10: 'Lighter-than-air',
    11: 'Parachutist',
    12: 'Ultralight',
    14: 'UAV',
    15: 'Space / trans-atmospheric',
    16: 'Surface emergency',
    17: 'Surface service'
};

let tokenCache = { token: null, expiresAt: 0 };

export const isOpenSkyConfigured = () =>
    Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

const resolveTheater = (theater) => {
    if (theater === 'worldwide') return 'global';
    return THEATER_BOUNDS[theater] ? theater : 'global';
};

const inBounds = (lat, lon, bounds) =>
    lat >= bounds.lamin && lat <= bounds.lamax && lon >= bounds.lomin && lon <= bounds.lomax;

const getAccessToken = async () => {
    const now = Date.now();
    if (tokenCache.token && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.OPENSKY_CLIENT_ID,
        client_secret: process.env.OPENSKY_CLIENT_SECRET
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`OpenSky auth ${res.status}`);

    const data = await res.json();
    tokenCache = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 1800) * 1000
    };
    return tokenCache.token;
};

const stateToFeature = (state) => {
    const lon = state[5];
    const lat = state[6];
    if (lon == null || lat == null) return null;

    const category = state[17];
    const spi = Boolean(state[15]);
    const callsign = (state[1] || '').trim();

    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
            callsign: callsign || state[0] || 'Unknown',
            hex: (state[0] || '').toLowerCase(),
            origin: state[2] || '',
            altitude: state[7] ?? state[13] ?? 0,
            velocity: state[9] ?? 0,
            heading: state[10] ?? 0,
            onGround: Boolean(state[8]),
            type: CATEGORY_LABELS[category] || 'Unknown',
            desc: category != null ? `OpenSky cat ${category}` : '',
            military: spi || category === 15,
            spi,
            category
        }
    };
};

export const fetchOpenSkyPayload = async (theater = 'global') => {
    const resolved = resolveTheater(theater);
    const bounds = THEATER_BOUNDS[resolved];

    if (!isOpenSkyConfigured()) {
        return {
            type: 'FeatureCollection',
            features: [],
            meta: {
                theater: resolved,
                count: 0,
                fetchedAt: new Date().toISOString(),
                source: 'opensky',
                configured: false
            }
        };
    }

    const query = new URLSearchParams({ extended: '1' });
    if (resolved !== 'global') {
        query.set('lamin', String(bounds.lamin));
        query.set('lomin', String(bounds.lomin));
        query.set('lamax', String(bounds.lamax));
        query.set('lomax', String(bounds.lomax));
    }

    try {
        const token = await getAccessToken();
        const res = await fetch(`${STATES_URL}?${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15000)
        });

        if (res.status === 401) {
            tokenCache = { token: null, expiresAt: 0 };
            throw new Error('OpenSky auth expired');
        }
        if (!res.ok) throw new Error(`OpenSky ${res.status}`);

        const data = await res.json();
        const states = data.states || [];
        const features = [];

        for (const state of states) {
            const feature = stateToFeature(state);
            if (!feature) continue;
            const [lon, lat] = feature.geometry.coordinates;
            if (!inBounds(lat, lon, bounds)) continue;
            features.push(feature);
        }

        return {
            type: 'FeatureCollection',
            features,
            meta: {
                theater: resolved,
                count: features.length,
                fetchedAt: new Date().toISOString(),
                source: 'opensky',
                configured: true,
                coverage: resolved === 'global' ? 'worldwide' : resolved
            }
        };
    } catch (err) {
        console.error('OpenSky error:', err.message);
        return {
            type: 'FeatureCollection',
            features: [],
            meta: {
                theater: resolved,
                count: 0,
                fetchedAt: new Date().toISOString(),
                source: 'opensky',
                configured: true,
                error: err.message
            }
        };
    }
};
