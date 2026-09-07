/**
 * NASA FIRMS (Fire Information for Resource Management System) integration.
 * Fetches VIIRS near-real-time fire/thermal anomaly data and converts to GeoJSON.
 *
 * There is deliberately NO sample generator in this file. The previous one
 * invented hotspots at named real places (Gaza, Beirut, Baghdad…), gave each a
 * randomised brightness and attributed it to SNPP or NOAA-20 — a fabricated
 * satellite reading at a real conflict site, stamped with the current
 * acquisition time. Without a key the honest answer is an empty layer that
 * says why; the escalation gauge and front board treat that as "offline",
 * never as calm. tests/data-honesty.test.mjs asserts no random value and no
 * mock generator ever returns here.
 */

import { THEATERS, getTheater, resolveTheater, FIRMS_GLOBAL_SUB_BBOXES } from './theaters.mjs';

const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';

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

const parseFireCsv = (text, allFeatures) => {
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
};

/** null = the endpoint did not answer; '' = answered with no rows. */
const fetchFireCsv = async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return res.text();
};

const emptyPayload = (theater, source, note) => ({
    type: 'FeatureCollection',
    features: [],
    meta: {
        theater,
        count: 0,
        fetchedAt: new Date().toISOString(),
        source,
        note
    }
});

export const fetchFirmsPayload = async (theater = 'middleeast') => {
    // resolveTheater() maps an unknown id to the default theater. That is the
    // right behaviour for a typo in a URL, but the wrong one for a layer: an
    // unknown theater must not silently receive another region's fires.
    if (theater !== 'worldwide' && !THEATERS[theater]) {
        return emptyPayload(theater, 'no_coverage_for_theater',
            `No FIRMS bounding box is defined for theater "${theater}".`);
    }
    const resolved = resolveTheater(theater);

    if (!FIRMS_MAP_KEY) {
        return emptyPayload(resolved, 'no_firms_key',
            'FIRMS_MAP_KEY is not set. Live NASA VIIRS detections require a key; no sample data is substituted.');
    }

    const days = 2;
    // Global coverage: the FIRMS area API caps CSV responses at ~5000 rows,
    // which a single worldwide request exceeds — fetch continental sub-bboxes
    // (theaters.mjs) in parallel instead, tolerating per-request failure so
    // one bad region never blanks the map.
    const bboxList = resolved === 'global'
        ? FIRMS_GLOBAL_SUB_BBOXES.map((b) => b.join(','))
        : [getTheater(resolved).bboxCsv];

    const requests = [];
    for (const bbox of bboxList) {
        for (const sensor of ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT']) {
            requests.push(
                fetchFireCsv(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${sensor}/${bbox}/${days}`)
                    .catch((err) => {
                        console.error(`FIRMS fetch error (${sensor} ${bbox}):`, err.message);
                        return null;
                    })
            );
        }
    }

    const texts = await Promise.all(requests);
    const answered = texts.filter((t) => t !== null).length;

    // Nothing answered: that is an outage, not "no fires". Throw so useCached
    // serves its last good payload as STALE instead of caching a
    // successful-looking empty result (same rule as gdelt.mjs).
    if (answered === 0) {
        throw new Error('FIRMS: no VIIRS endpoint answered');
    }

    const allFeatures = [];
    for (const text of texts) {
        if (text) parseFireCsv(text, allFeatures);
    }

    // A partial global fetch must not call itself global: report attempted
    // vs answered so the legend can say "partial coverage — 3 of 5 regions".
    const coverage = resolved === 'global'
        ? (answered === requests.length ? 'global' : 'partial')
        : 'theater';

    return {
        type: 'FeatureCollection',
        features: allFeatures,
        meta: {
            theater: resolved,
            count: allFeatures.length,
            requestsAttempted: requests.length,
            requestsAnswered: answered,
            windowDays: days,
            fetchedAt: new Date().toISOString(),
            source: 'nasa-firms-live',
            coverage,
            ...(resolved === 'global' ? { subBboxes: bboxList.length } : {})
        }
    };
};
