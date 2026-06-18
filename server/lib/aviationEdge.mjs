const THEATER_CENTERS = {
    middleeast: { lat: 30, lon: 53 },
    indopacific: { lat: 5, lon: 110 },
    thailand: { lat: 14.5, lon: 100.9925 }
};

export const fetchAviationEdgePayload = async (theater = 'middleeast', apiKey) => {
    const center = THEATER_CENTERS[theater] || THEATER_CENTERS.middleeast;
    // API docs: https://aviation-edge.com/v2/public/flights?key=[API_KEY]&lat=51.5074&lng=0.1278&distance=100
    // distance is in km, we'll use 500km to cover a good portion of the theater
    const url = `https://aviation-edge.com/v2/public/flights?key=${apiKey}&lat=${center.lat}&lng=${center.lon}&distance=500`;

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`Aviation Edge API ${res.status}`);

        const data = await res.json();
        if (data.error) throw new Error(`Aviation Edge API Error: ${data.error}`);

        const aircraftList = Array.isArray(data) ? data : [];

        const features = aircraftList
            .filter(ac => ac.geography?.latitude != null && ac.geography?.longitude != null)
            .map(ac => {
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [ac.geography.longitude, ac.geography.latitude]
                    },
                    properties: {
                        callsign: ac.flight?.iataNumber || ac.flight?.icaoNumber || 'Unknown',
                        origin: ac.departure?.iataCode || '',
                        altitude: ac.geography?.altitude || 0, // meters
                        velocity: (ac.speed?.horizontal || 0) * 0.277778, // km/h to m/s
                        heading: ac.geography?.direction || 0,
                        onGround: ac.speed?.isGround === 1.0 || ac.status !== 'en-route',
                        type: ac.aircraft?.icaoCode || 'Unknown',
                        desc: ''
                    }
                };
            });

        return {
            type: 'FeatureCollection',
            features,
            meta: {
                theater,
                count: features.length,
                fetchedAt: new Date().toISOString(),
                source: 'aviation-edge'
            }
        };
    } catch (err) {
        console.error('Aviation Edge error:', err.message);
        return {
            type: 'FeatureCollection',
            features: [],
            meta: { theater, count: 0, fetchedAt: new Date().toISOString(), source: 'aviation-edge' }
        };
    }
};
