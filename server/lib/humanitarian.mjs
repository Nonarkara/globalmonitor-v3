/**
 * Humanitarian data — UNHCR refugee statistics and ReliefWeb reports.
 *
 * No invented figures. The previous fallback returned 7,100,000 displaced for
 * Syria, 1,450,000 for Myanmar, 120,000 for Thailand and 6,500,000 for the
 * global view as literals, stamped with the current time, whenever UNHCR
 * returned nothing — numbers about real populations with no source behind
 * them. When UNHCR has no rows the payload now carries `totalDisplaced: null`
 * and says why; when UNHCR is unreachable this throws so useCached serves the
 * last good payload as STALE.
 */
import { THEATERS, getTheater, resolveTheater } from './theaters.mjs';

const COUNTRY_CENTROIDS = {
    SYR: [38.99, 34.80], IRQ: [43.68, 33.22], AFG: [67.71, 33.94],
    YEM: [48.52, 15.55], SDN: [30.22, 12.86], PSE: [35.23, 31.95],
    LBN: [35.50, 33.87], SOM: [46.20, 5.15], MMR: [96.68, 19.76],
    THA: [100.5, 13.75], KHM: [104.99, 12.56], LAO: [102.5, 17.97],
    VNM: [108.28, 14.06], PHL: [121.77, 12.88], IDN: [113.92, -0.79],
    MYS: [101.97, 4.21], IND: [78.96, 20.59], BGD: [90.36, 23.81],
    LKA: [80.77, 7.87], PAK: [69.34, 30.38], CHN: [104.19, 35.86],
    // Global theater additions — major displacement origins outside
    // the original three theaters.
    UKR: [31.17, 48.38], RUS: [90.0, 60.0], SSD: [29.70, 7.86],
    ETH: [39.75, 9.02], NGA: [8.68, 9.08], MLI: [-3.99, 17.57],
    BFA: [-1.56, 12.24], NER: [8.08, 17.61], TCD: [18.73, 15.45],
    HTI: [-72.71, 18.97], COL: [-72.95, 4.57], MEX: [-102.55, 23.63],
    COD: [23.66, -2.88], CMR: [12.28, 5.70], LBY: [17.23, 26.34]
};

const COUNTRY_NAMES = {
    SYR: 'Syria', IRQ: 'Iraq', AFG: 'Afghanistan', YEM: 'Yemen',
    SDN: 'Sudan', PSE: 'Palestine', LBN: 'Lebanon', SOM: 'Somalia', MMR: 'Myanmar',
    THA: 'Thailand', KHM: 'Cambodia', LAO: 'Laos', VNM: 'Vietnam', PHL: 'Philippines',
    IDN: 'Indonesia', MYS: 'Malaysia', IND: 'India', BGD: 'Bangladesh', LKA: 'Sri Lanka',
    PAK: 'Pakistan', CHN: 'China',
    UKR: 'Ukraine', RUS: 'Russia', SSD: 'South Sudan', ETH: 'Ethiopia',
    NGA: 'Nigeria', MLI: 'Mali', BFA: 'Burkina Faso', NER: 'Niger',
    TCD: 'Chad', HTI: 'Haiti', COL: 'Colombia', MEX: 'Mexico',
    COD: 'Democratic Republic of the Congo', CMR: 'Cameroon', LBY: 'Libya'
};

// UNHCR's population API publishes annual totals; the most recent complete
// year is what we ask for, and the year travels with every number so the
// panel can print "UNHCR 2024" instead of implying today.
const UNHCR_YEAR = 2024;
const UNHCR_PAGE_LIMIT = 100;
const UNHCR_MAX_PAGES = 5;

const emptyPayload = (theater, source, note) => ({
    geojson: { type: 'FeatureCollection', features: [] },
    totalDisplaced: null,
    topCountries: [],
    reports: [],
    fetchedAt: new Date().toISOString(),
    theater,
    year: UNHCR_YEAR,
    source,
    note
});

export const fetchHumanitarianPayload = async (theater = 'middleeast') => {
    // An unknown theater must not silently receive the default theater's numbers.
    if (theater !== 'worldwide' && !THEATERS[theater]) {
        return emptyPayload(theater, 'no_coverage_for_theater',
            `No UNHCR country list is defined for theater "${theater}".`);
    }

    const features = [];
    const reports = [];
    // ISO3 origin lists come from the shared theater registry; 'global' is a
    // curated set of major displacement-origin countries. Codes missing from
    // COUNTRY_CENTROIDS above are filtered silently when features are built.
    const resolved = resolveTheater(theater);
    const countryCodes = getTheater(resolved).unhcrCountries;
    const countryList = countryCodes.join(',');
    let totalDisplaced = 0;
    let unhcrAnswered = false;
    let unhcrTruncated = false;

    // 1. UNHCR Population API — paginate; a single 100-row page silently
    //    truncated per-country sums for the larger theaters.
    try {
        const countryTotals = {};
        for (let page = 1; page <= UNHCR_MAX_PAGES; page++) {
            const url = `https://api.unhcr.org/population/v1/population/?limit=${UNHCR_PAGE_LIMIT}&year=${UNHCR_YEAR}&coo=${countryList}&page=${page}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) break;
            unhcrAnswered = true;
            const data = await res.json();
            const items = data.items || [];

            for (const item of items) {
                const code = item.coo_iso || item.coo;
                if (!code || !COUNTRY_CENTROIDS[code]) continue;
                if (!countryTotals[code]) countryTotals[code] = 0;
                countryTotals[code] +=
                    (Number(item.refugees) || 0) +
                    (Number(item.idps) || 0) +
                    (Number(item.asylum_seekers) || 0);
            }

            const maxPages = Number(data.maxPages) || 1;
            if (page >= maxPages || items.length < UNHCR_PAGE_LIMIT) break;
            if (page === UNHCR_MAX_PAGES && maxPages > UNHCR_MAX_PAGES) unhcrTruncated = true;
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
                    year: UNHCR_YEAR,
                    radius: Math.max(8, Math.min(40, Math.log10(total) * 8))
                }
            });
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

    // UNHCR never answered and we have nothing to show: that is an outage.
    // Throw so the cache layer serves its last good payload as STALE rather
    // than caching an empty result that reads as "zero displaced".
    if (!unhcrAnswered && features.length === 0 && reports.length === 0) {
        throw new Error('UNHCR and ReliefWeb both unreachable');
    }

    return {
        geojson: {
            type: 'FeatureCollection',
            features
        },
        // null, not 0: UNHCR answered but had no rows for these origins.
        totalDisplaced: features.length ? totalDisplaced : null,
        truncated: unhcrTruncated,
        topCountries: features
            .slice()
            .sort((a, b) => b.properties.displaced - a.properties.displaced)
            .slice(0, 5)
            .map(f => ({ name: f.properties.country, displaced: f.properties.displaced })),
        reports: reports.slice(0, 5),
        fetchedAt: new Date().toISOString(),
        theater: resolved,
        year: UNHCR_YEAR,
        source: unhcrAnswered ? 'unhcr' : 'reliefweb_only'
    };
};
