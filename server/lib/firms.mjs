/**
 * NASA FIRMS (Fire Information for Resource Management System) integration.
 * Fetches VIIRS near-real-time fire/thermal anomaly data and converts to GeoJSON.
 */

const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';

const THEATER_BBOX = {
    middleeast: '24,10,65,42',
    indopacific: '90,-10,135,25',
    thailand: '97,5,106,21'
};

const parseCsvLine = (line) => {
    const parts = line.split(',');
    return {
        latitude: parseFloat(parts[0]),
        longitude: parseFloat(parts[1]),
        bright_ti4: parseFloat(parts[2]),
        scan: parseFloat(parts[3]),
        track: parseFloat(parts[4]),
        acq_date: parts[5],
        acq_time: parts[6],
        satellite: parts[7],
        confidence: parts[8]?.trim(),
        version: parts[9],
        bright_ti5: parseFloat(parts[10]),
        frp: parseFloat(parts[11]),
        daynight: parts[12]?.trim()
    };
};

// Fallback realistic sample data for when API key is unavailable
const getMockFirmsData = (theater = 'middleeast') => {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');

    // Realistic hotspot locations in Middle East conflict zones
    const hotspots = theater === 'middleeast' ? [
        { lat: 33.5186, lon: 36.2384, name: 'Syria (Homs region)', confidence: 'high', frp: 450 },
        { lat: 33.3157, lon: 44.3661, name: 'Iraq (Baghdad region)', confidence: 'high', frp: 380 },
        { lat: 32.5355, lon: 51.4432, name: 'Iran (Gulf region)', confidence: 'high', frp: 320 },
        { lat: 33.7490, lon: 35.4732, name: 'Lebanon (Beirut region)', confidence: 'medium', frp: 290 },
        { lat: 31.9454, lon: 35.9284, name: 'Palestine (West Bank)', confidence: 'medium', frp: 210 },
        { lat: 31.0461, lon: 34.8516, name: 'Gaza (Gaza Strip)', confidence: 'high', frp: 340 },
        { lat: 31.5454, lon: 35.1892, name: 'Jordan (Border region)', confidence: 'low', frp: 150 },
        { lat: 24.4539, lon: 54.3773, name: 'UAE (Port region)', confidence: 'low', frp: 120 }
    ] : theater === 'thailand' ? [
        { lat: 13.7563, lon: 100.5018, name: 'Thailand (Bangkok)', confidence: 'low', frp: 80 },
        { lat: 19.91, lon: 99.83, name: 'Thailand (Chiang Rai)', confidence: 'low', frp: 70 },
        { lat: 6.42, lon: 101.82, name: 'Thailand (Narathiwat)', confidence: 'low', frp: 60 }
    ] : [
        { lat: 13.7563, lon: 100.5018, name: 'Thailand (Bangkok)', confidence: 'low', frp: 80 },
        { lat: 1.3521, lon: 103.8198, name: 'Singapore', confidence: 'low', frp: 60 },
        { lat: 21.0285, lon: 105.8045, name: 'Vietnam (Hanoi)', confidence: 'low', frp: 100 }
    ];

    return hotspots.map((spot, i) => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [spot.lon, spot.lat]
        },
        properties: {
            confidence: spot.confidence,
            frp: spot.frp,
            brightness: 320 + Math.random() * 40,
            acq_date: date,
            acq_time: time,
            daynight: 'D',
            satellite: i % 2 === 0 ? 'SNPP' : 'NOAA20',
            source: 'sample'
        }
    }));
};

export const fetchFirmsPayload = async (theater = 'middleeast') => {
    const bbox = THEATER_BBOX[theater] || THEATER_BBOX.middleeast;
    const days = 2;

    // Try MAP_KEY authenticated endpoint first
    if (FIRMS_MAP_KEY) {
        const urls = [
            `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/${bbox}/${days}`,
            `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_NOAA20_NRT/${bbox}/${days}`
        ];

        const allFeatures = [];

        for (const url of urls) {
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
                if (!res.ok) continue;

                const text = await res.text();
                const lines = text.trim().split('\n');

                // Skip header row
                for (let i = 1; i < lines.length; i++) {
                    const row = parseCsvLine(lines[i]);

                    if (isNaN(row.latitude) || isNaN(row.longitude)) continue;
                    if (row.confidence === 'low' || row.confidence === 'l') continue;

                    allFeatures.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [row.longitude, row.latitude]
                        },
                        properties: {
                            confidence: row.confidence,
                            frp: isNaN(row.frp) ? 0 : row.frp,
                            brightness: row.bright_ti4,
                            acq_date: row.acq_date,
                            acq_time: row.acq_time,
                            daynight: row.daynight,
                            satellite: row.satellite
                        }
                    });
                }
            } catch (err) {
                console.error(`FIRMS fetch error for ${url}:`, err.message);
            }
        }

        // If we got data, return it
        if (allFeatures.length > 0) {
            return {
                type: 'FeatureCollection',
                features: allFeatures,
                meta: {
                    theater,
                    count: allFeatures.length,
                    fetchedAt: new Date().toISOString(),
                    source: 'nasa-firms-live'
                }
            };
        }
    }

    // Fall back to mock data when API key unavailable or no results
    const features = getMockFirmsData(theater);
    return {
        type: 'FeatureCollection',
        features,
        meta: {
            theater,
            count: features.length,
            fetchedAt: new Date().toISOString(),
            source: 'sample-data',
            note: 'Using realistic sample data. Set FIRMS_MAP_KEY for live NASA data.'
        }
    };
};
