/**
 * Humanitarian data — UNHCR refugee statistics and ReliefWeb reports.
 */

const COUNTRY_CENTROIDS = {
    SYR: [38.99, 34.80], IRQ: [43.68, 33.22], AFG: [67.71, 33.94],
    YEM: [48.52, 15.55], SDN: [30.22, 12.86], PSE: [35.23, 31.95],
    LBN: [35.50, 33.87], SOM: [46.20, 5.15], MMR: [96.68, 19.76],
    THA: [100.5, 13.75], KHM: [104.99, 12.56], LAO: [102.5, 17.97],
    VNM: [108.28, 14.06], PHL: [121.77, 12.88], IDN: [113.92, -0.79],
    MYS: [101.97, 4.21], IND: [78.96, 20.59], BGD: [90.36, 23.81],
    LKA: [80.77, 7.87], PAK: [69.34, 30.38], CHN: [104.19, 35.86]
};

const COUNTRY_NAMES = {
    SYR: 'Syria', IRQ: 'Iraq', AFG: 'Afghanistan', YEM: 'Yemen',
    SDN: 'Sudan', PSE: 'Palestine', LBN: 'Lebanon', SOM: 'Somalia', MMR: 'Myanmar',
    THA: 'Thailand', KHM: 'Cambodia', LAO: 'Laos', VNM: 'Vietnam', PHL: 'Philippines',
    IDN: 'Indonesia', MYS: 'Malaysia', IND: 'India', BGD: 'Bangladesh', LKA: 'Sri Lanka',
    PAK: 'Pakistan', CHN: 'China'
};

const THEATER_COUNTRY_CODES = {
    middleeast: ['SYR', 'IRQ', 'AFG', 'YEM', 'SDN', 'PSE', 'LBN'],
    indopacific: ['THA', 'MMR', 'KHM', 'LAO', 'VNM', 'PHL', 'IDN', 'MYS', 'IND', 'BGD', 'LKA', 'PAK'],
    thailand: ['THA', 'MMR', 'KHM', 'LAO', 'MYS']
};

export const fetchHumanitarianPayload = async (theater = 'middleeast') => {
    const features = [];
    let totalDisplaced = 0;
    const reports = [];
    const countryCodes = THEATER_COUNTRY_CODES[theater] || THEATER_COUNTRY_CODES.middleeast;
    const countryList = countryCodes.join(',');

    // 1. UNHCR Population API
    try {
        const url = `https://api.unhcr.org/population/v1/population/?limit=100&year=2024&coo=${countryList}&page=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const data = await res.json();
            const countryTotals = {};

            for (const item of (data.items || [])) {
                const code = item.coo_iso || item.coo;
                if (!code || !COUNTRY_CENTROIDS[code]) continue;
                if (!countryTotals[code]) countryTotals[code] = 0;
                countryTotals[code] +=
                    (Number(item.refugees) || 0) +
                    (Number(item.idps) || 0) +
                    (Number(item.asylum_seekers) || 0);
            }

            for (const [code, total] of Object.entries(countryTotals)) {
                if (total <= 0) continue;
                totalDisplaced += total;
                const coords = COUNTRY_CENTROIDS[code];
                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coords },
                    properties: {
                        country: COUNTRY_NAMES[code] || code,
                        displaced: total,
                        radius: Math.max(8, Math.min(40, Math.log10(total) * 8))
                    }
                });
            }
        }
    } catch (err) {
        console.error('UNHCR API error:', err.message);
    }

    // 2. ReliefWeb Reports API
    try {
        const reliefCountries = countryCodes.map(code => COUNTRY_NAMES[code]).filter(Boolean);
        const countryFilter = reliefCountries.map(c => `filter[value][]=${encodeURIComponent(c)}`).join('&');
        const url = `https://api.reliefweb.int/v1/reports?appname=globalmonitor&${countryFilter}&limit=5&sort[]=date:desc`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
            const data = await res.json();
            for (const item of (data.data || [])) {
                reports.push({
                    title: item.fields?.title || 'Report',
                    date: item.fields?.date?.created || '',
                    url: item.fields?.url_alias || item.href || ''
                });
            }
        }
    } catch (err) {
        console.error('ReliefWeb API error:', err.message);
    }

    const payload = {
        geojson: {
            type: 'FeatureCollection',
            features
        },
        totalDisplaced,
        topCountries: features
            .sort((a, b) => b.properties.displaced - a.properties.displaced)
            .slice(0, 5)
            .map(f => ({ name: f.properties.country, displaced: f.properties.displaced })),
        reports: reports.slice(0, 5),
        fetchedAt: new Date().toISOString(),
        theater
    };

    if (features.length === 0) {
        // Sensible fallback so panels never render empty
        return buildFallbackHumanitarian(theater);
    }

    return payload;
};

function buildFallbackHumanitarian(theater) {
    const code = theater === 'thailand' ? 'THA' : theater === 'indopacific' ? 'MMR' : 'SYR';
    const coords = COUNTRY_CENTROIDS[code];
    const name = COUNTRY_NAMES[code];
    const displaced = theater === 'thailand' ? 120000 : theater === 'indopacific' ? 1450000 : 7100000;
    const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: { country: name, displaced, radius: Math.max(8, Math.min(40, Math.log10(displaced) * 8)) }
    };
    return {
        geojson: { type: 'FeatureCollection', features: [feature] },
        totalDisplaced: displaced,
        topCountries: [{ name, displaced }],
        reports: [],
        fetchedAt: new Date().toISOString(),
        theater,
        source: 'fallback'
    };
}
