/**
 * Google Sheets Data Recorder — persistent intelligence database.
 *
 * Records every news item, ACLED event, escalation score, market snapshot,
 * and sentiment reading to Google Sheets for retroactive analysis.
 *
 * Architecture: fire-and-forget from useCached(). Never blocks API responses.
 * Deduplication via SHA-256 hash column + in-memory Set.
 * Rate limited to stay under Google Sheets API limits (60 req/min).
 */

import crypto from 'node:crypto';

// ── Configuration ──────────────────────────────────────────
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const SERVICE_KEY_B64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const ENABLED = !!(SHEETS_ID && SERVICE_KEY_B64);

// ── Tab definitions ────────────────────────────────────────
const TABS = {
    News:       ['ingestedAt', 'pubDate', 'title', 'link', 'source', 'sourceId', 'tags', 'score', 'hash'],
    ACLED:      ['ingestedAt', 'date', 'eventType', 'subType', 'actor1', 'actor2', 'country', 'region', 'fatalities', 'notes', 'source', 'lat', 'lon', 'hash'],
    Escalation: ['ingestedAt', 'score', 'level', 'label', 'firms', 'news', 'market', 'strikes', 'sourceHealth'],
    Markets:    ['ingestedAt', 'symbol', 'price', 'changePerc'],
    Sentiment:  ['ingestedAt', 'date', 'tone', 'query'],
    FIRMS:      ['ingestedAt', 'theater', 'acqDate', 'acqTime', 'lat', 'lon', 'brightness', 'frp', 'satellite', 'confidence'],
    OilPrice:   ['ingestedAt', 'symbol', 'date', 'price'],
    Quakes:     ['ingestedAt', 'theater', 'mag', 'place', 'time', 'lat', 'lon', 'depth'],
    Flights:    ['ingestedAt', 'theater', 'callsign', 'lat', 'lon', 'altitude', 'velocity', 'country'],
    NGA:        ['ingestedAt', 'number', 'title', 'area', 'issued', 'expires'],
};

// ── State (per serverless instance) ────────────────────────
let authClient = null;
let accessToken = null;
let tokenExpiresAt = 0;
let sheetsInitialized = false;
let disabled = false;

const newsHashes = new Set();
const acledHashes = new Set();
let hashesBootstrapped = false;

const callTimestamps = [];
const lastRecordAt = {};
const writeCount = {};

// Throttle intervals (ms)
const ESCALATION_THROTTLE = 5 * 60 * 1000;  // 5 min
const MARKET_THROTTLE = 5 * 60 * 1000;       // 5 min

// ── Auth ───────────────────────────────────────────────────
async function getToken() {
    if (!SERVICE_KEY_B64) return null;
    const now = Date.now();
    if (accessToken && tokenExpiresAt > now + 60000) return accessToken;

    try {
        if (!authClient) {
            const { GoogleAuth } = await import('google-auth-library');
            const keyJson = JSON.parse(Buffer.from(SERVICE_KEY_B64, 'base64').toString('utf-8'));
            const auth = new GoogleAuth({
                credentials: keyJson,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            authClient = await auth.getClient();
        }
        const res = await authClient.getAccessToken();
        accessToken = res.token || res;
        tokenExpiresAt = now + 3500 * 1000; // ~58 min
        return accessToken;
    } catch (err) {
        console.warn('[SHEETS] Auth failed:', err.message);
        disabled = true;
        return null;
    }
}

// ── Rate Limiter ───────────────────────────────────────────
function canCall() {
    const now = Date.now();
    // Remove timestamps older than 60s
    while (callTimestamps.length && callTimestamps[0] < now - 60000) callTimestamps.shift();
    return callTimestamps.length < 50;
}

function trackCall() {
    callTimestamps.push(Date.now());
}

// ── Sheets API Helpers ─────────────────────────────────────
async function sheetsRequest(method, path, body = null) {
    if (!canCall()) { console.warn('[SHEETS] Rate limited, skipping'); return null; }
    const token = await getToken();
    if (!token) return null;
    trackCall();

    const url = `${SHEETS_API}/${SHEETS_ID}${path}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Sheets API ${res.status}: ${text.substring(0, 200)}`);
    }
    return res.json();
}

async function appendRows(sheetName, rows) {
    if (!rows.length) return;
    const range = `${sheetName}!A:Z`;
    return sheetsRequest('POST',
        `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: rows }
    );
}

async function readRange(range) {
    const data = await sheetsRequest('GET', `/values/${encodeURIComponent(range)}`);
    return data?.values || [];
}

// ── Sheet Initialization ───────────────────────────────────
async function ensureSheets() {
    if (sheetsInitialized) return;
    try {
        const meta = await sheetsRequest('GET', '?fields=sheets.properties.title');
        if (!meta) return;
        const existing = new Set((meta.sheets || []).map(s => s.properties.title));
        const missing = Object.keys(TABS).filter(t => !existing.has(t));

        if (missing.length) {
            await sheetsRequest('POST', ':batchUpdate', {
                requests: missing.map(title => ({
                    addSheet: { properties: { title } }
                }))
            });
            // Write headers for new tabs
            for (const tab of missing) {
                await appendRows(tab, [TABS[tab]]);
            }
        }
        sheetsInitialized = true;
    } catch (err) {
        console.warn('[SHEETS] Init failed:', err.message);
    }
}

// ── Deduplication ──────────────────────────────────────────
function hashStr(s) {
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
}

function normalizeTitle(t) {
    return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 80);
}

function newsHash(title) {
    return hashStr(normalizeTitle(title));
}

function acledHash(p) {
    return hashStr(`${p.date || p.event_date || ''}|${p.eventType || ''}|${p.latitude || ''}|${p.longitude || ''}|${p.actor1 || ''}`);
}

async function bootstrapHashes() {
    if (hashesBootstrapped) return;
    try {
        // Read last 500 news hashes
        const newsRows = await readRange('News!I2:I501');
        newsRows.forEach(r => { if (r[0]) newsHashes.add(r[0]); });

        // Read last 500 ACLED hashes
        const acledRows = await readRange('ACLED!N2:N501');
        acledRows.forEach(r => { if (r[0]) acledHashes.add(r[0]); });

        hashesBootstrapped = true;
    } catch (err) {
        console.warn('[SHEETS] Hash bootstrap failed:', err.message);
        // Continue anyway — worst case we get some dupes
        hashesBootstrapped = true;
    }
}

// ── Transform + Record Functions ───────────────────────────
function now() { return new Date().toISOString(); }

async function recordNews(items, updatedAt) {
    if (!Array.isArray(items) || !items.length) return;
    await bootstrapHashes();

    const rows = [];
    for (const item of items) {
        const h = newsHash(item.title);
        if (newsHashes.has(h)) continue;
        newsHashes.add(h);
        rows.push([
            updatedAt || now(),
            item.pubDate || '',
            (item.title || '').substring(0, 300),
            item.link || '',
            item.source || '',
            item.sourceId || '',
            (item.tags || []).join(', '),
            item.score || 0,
            h
        ]);
    }

    if (rows.length) {
        await appendRows('News', rows);
        writeCount.News = (writeCount.News || 0) + rows.length;
        lastRecordAt.News = now();
    }
}

async function recordAcled(geojson, updatedAt) {
    if (!geojson?.features?.length) return;
    await bootstrapHashes();

    const rows = [];
    for (const f of geojson.features) {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [];
        const h = acledHash({ ...p, latitude: coords[1], longitude: coords[0] });
        if (acledHashes.has(h)) continue;
        acledHashes.add(h);
        rows.push([
            updatedAt || now(),
            p.eventDate || p.event_date || p.date || '',
            p.eventType || '',
            p.subType || p.sub_event_type || '',
            p.actor1 || '',
            p.actor2 || '',
            p.country || '',
            p.admin1 || p.region || '',
            p.fatalities || 0,
            (p.notes || '').substring(0, 300),
            p.source || '',
            coords[1] || '',  // lat
            coords[0] || '',  // lon
            h
        ]);
    }

    if (rows.length) {
        await appendRows('ACLED', rows);
        writeCount.ACLED = (writeCount.ACLED || 0) + rows.length;
        lastRecordAt.ACLED = now();
    }
}

async function recordMarkets(items, updatedAt) {
    if (!Array.isArray(items) || !items.length) return;
    const ts = updatedAt || now();
    const rows = items.map(m => [
        ts,
        m.symbol || m.name || '',
        m.price || '',
        parseFloat(m.change) || 0
    ]);
    await appendRows('Markets', rows);
    writeCount.Markets = (writeCount.Markets || 0) + rows.length;
    lastRecordAt.Markets = now();
}

async function recordSentiment(data, updatedAt) {
    const timeline = data?.timeline;
    if (!Array.isArray(timeline) || !timeline.length) return;
    const ts = updatedAt || now();
    const rows = timeline.map(t => [
        ts,
        t.date || '',
        t.tone || 0,
        data.query || 'ME conflict'
    ]);
    await appendRows('Sentiment', rows);
    writeCount.Sentiment = (writeCount.Sentiment || 0) + rows.length;
    lastRecordAt.Sentiment = now();
}

// ── New record functions (FIRMS, OilPrice, Quakes, Flights, NGA) ──────────
async function recordFirms(geojson, theater, updatedAt) {
    if (!geojson?.features?.length) return;
    const ts = updatedAt || now();
    const rows = geojson.features.map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return [
            ts,
            theater || '',
            p.acq_date || p.date || '',
            String(p.acq_time || p.time || ''),
            lat ?? '',
            lon ?? '',
            p.brightness || '',
            p.frp || '',
            p.satellite || '',
            p.confidence || ''
        ];
    });
    await appendRows('FIRMS', rows);
    writeCount.FIRMS = (writeCount.FIRMS || 0) + rows.length;
    lastRecordAt.FIRMS = now();
}

async function recordOilPrice(items, updatedAt) {
    if (!Array.isArray(items) || !items.length) return;
    const ts = updatedAt || now();
    const rows = items.map((m) => [
        ts,
        m.symbol || m.name || '',
        m.date || '',
        m.price || ''
    ]);
    await appendRows('OilPrice', rows);
    writeCount.OilPrice = (writeCount.OilPrice || 0) + rows.length;
    lastRecordAt.OilPrice = now();
}

async function recordQuakes(geojson, theater, updatedAt) {
    if (!geojson?.features?.length) return;
    const ts = updatedAt || now();
    const rows = geojson.features.map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return [
            ts,
            theater || '',
            p.mag || '',
            p.place || '',
            p.time ? new Date(p.time).toISOString() : '',
            lat ?? '',
            lon ?? '',
            f.geometry?.coordinates?.[2] ?? ''
        ];
    });
    await appendRows('Quakes', rows);
    writeCount.Quakes = (writeCount.Quakes || 0) + rows.length;
    lastRecordAt.Quakes = now();
}

async function recordFlights(geojson, theater, updatedAt) {
    if (!geojson?.features?.length) return;
    const ts = updatedAt || now();
    const rows = geojson.features.map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return [
            ts,
            theater || '',
            p.callsign || '',
            lat ?? '',
            lon ?? '',
            p.altitude ?? '',
            p.velocity ?? '',
            p.originCountry || p.country || ''
        ];
    });
    await appendRows('Flights', rows);
    writeCount.Flights = (writeCount.Flights || 0) + rows.length;
    lastRecordAt.Flights = now();
}

async function recordNga(items, updatedAt) {
    if (!Array.isArray(items) || !items.length) return;
    const ts = updatedAt || now();
    const rows = items.map((n) => [
        ts,
        n.number || '',
        (n.title || '').substring(0, 300),
        n.area || '',
        n.issued || '',
        n.expires || ''
    ]);
    await appendRows('NGA', rows);
    writeCount.NGA = (writeCount.NGA || 0) + rows.length;
    lastRecordAt.NGA = now();
}

// ── Public: Record Escalation (called separately, throttled) ──
let lastEscRecord = 0;

export async function recordEscalation(payload) {
    if (!ENABLED || disabled) return;
    const n = Date.now();
    if (n - lastEscRecord < ESCALATION_THROTTLE) return;
    lastEscRecord = n;

    try {
        await ensureSheets();
        const c = payload.components || {};
        const rows = [[
            now(),
            payload.score || 0,
            payload.level || '',
            payload.label || '',
            c.firms || 0,
            c.news || 0,
            c.market || 0,
            c.strikes || 0,
            JSON.stringify(payload.sourceHealth || {})
        ]];
        await appendRows('Escalation', rows);
        writeCount.Escalation = (writeCount.Escalation || 0) + 1;
        lastRecordAt.Escalation = now();
    } catch (err) {
        console.warn('[SHEETS] Escalation record failed:', err.message);
    }
}

// ── Public: Main Router (called from useCached) ────────────
let lastMktRecord = 0;

export async function recordToSheets(cacheKey, payload, updatedAt) {
    if (!ENABLED || disabled) return;

    try {
        await ensureSheets();

        if (cacheKey.startsWith('ticker:') || cacheKey.startsWith('briefing:')) {
            const items = cacheKey.startsWith('ticker:')
                ? (Array.isArray(payload) ? payload : [])
                : (payload?.items || []);
            await recordNews(items, updatedAt);
        }
        else if (cacheKey.startsWith('acled:')) {
            await recordAcled(payload, updatedAt);
        }
        else if (cacheKey === 'markets') {
            const n = Date.now();
            if (n - lastMktRecord < MARKET_THROTTLE) return;
            lastMktRecord = n;
            await recordMarkets(Array.isArray(payload) ? payload : [], updatedAt);
        }
        else if (cacheKey.startsWith('gdelt') || cacheKey.startsWith('sentiment')) {
            await recordSentiment(payload, updatedAt);
        }
        else if (cacheKey.startsWith('firms:')) {
            const theater = cacheKey.split(':')[1] || 'middleeast';
            await recordFirms(payload, theater, updatedAt);
        }
        else if (cacheKey === 'oil-prices') {
            const items = Array.isArray(payload) ? payload : (payload?.items || []);
            await recordOilPrice(items, updatedAt);
        }
        else if (cacheKey.startsWith('quakes:')) {
            const theater = cacheKey.split(':')[1] || 'middleeast';
            await recordQuakes(payload, theater, updatedAt);
        }
        else if (cacheKey.startsWith('airplanes:') || cacheKey.startsWith('opensky:')) {
            const theater = cacheKey.split(':')[1] || 'middleeast';
            await recordFlights(payload, theater, updatedAt);
        }
        else if (cacheKey === 'nga-warnings') {
            const items = Array.isArray(payload) ? payload : (payload?.warnings || []);
            await recordNga(items, updatedAt);
        }
    } catch (err) {
        console.warn(`[SHEETS] Record failed for ${cacheKey}:`, err.message);
    }
}

// ── Public: Health Diagnostics ─────────────────────────────
export function getRecordingHealth() {
    return {
        enabled: ENABLED,
        disabled,
        sheetsInitialized,
        hashesBootstrapped,
        newsHashCount: newsHashes.size,
        acledHashCount: acledHashes.size,
        callsLastMinute: callTimestamps.filter(t => t > Date.now() - 60000).length,
        lastRecordAt,
        writeCount,
        spreadsheetId: SHEETS_ID ? `...${SHEETS_ID.slice(-8)}` : null
    };
}
