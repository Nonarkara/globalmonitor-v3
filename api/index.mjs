/**
 * Vercel Serverless API — single entry point for all /api/* routes.
 * Mirrors the same logic as server/index.mjs but in serverless format.
 */

import { fetchBriefingPayload, fetchTickerPayload } from '../server/lib/intelligence.mjs';
import { fetchMarketPayload } from '../server/lib/marketData.mjs';
import { fetchFirmsPayload } from '../server/lib/firms.mjs';
import { computeEscalation } from '../server/lib/escalation.mjs';
import { computeStrikeStats } from '../server/lib/strikeStats.mjs';
import { fetchHumanitarianPayload } from '../server/lib/humanitarian.mjs';
import { computeInfrastructureStatus } from '../server/lib/infrastructure.mjs';
import { fetchGdeltSentiment } from '../server/lib/gdelt.mjs';
import { fetchFlightsPayload } from '../server/lib/flights.mjs';
import { computeFrontStatus } from '../server/lib/frontStatus.mjs';
import { fetchAcledEvents } from '../server/lib/acled.mjs';
import { fetchOilPriceTimeline } from '../server/lib/eia.mjs';
import { fetchNgaWarnings } from '../server/lib/ngaWarnings.mjs';
import { fetchUsgsQuakes } from '../server/lib/usgsQuakes.mjs';
import { recordToSheets, recordEscalation, getRecordingHealth } from '../server/lib/sheetsRecorder.mjs';

// In-memory cache (lives per serverless instance, resets on cold start)
const cache = new Map();

const useCached = async (key, ttlMs, loader, isUsable) => {
    const now = Date.now();
    const current = cache.get(key);
    if (current && current.expiresAt > now) {
        return { payload: current.payload, meta: { status: 'live', updatedAt: current.updatedAt, cache: 'hit' } };
    }
    try {
        const payload = await loader();
        if (!isUsable(payload)) throw new Error('No usable payload');
        const updatedAt = new Date().toISOString();
        cache.set(key, { payload, updatedAt, expiresAt: now + ttlMs });
        // Fire-and-forget: record to Google Sheets for persistent analysis
        recordToSheets(key, payload, updatedAt).catch(() => {});
        return { payload, meta: { status: 'live', updatedAt, cache: current ? 'refresh' : 'miss' } };
    } catch (error) {
        if (current) {
            return { payload: current.payload, meta: { status: 'stale', updatedAt: current.updatedAt, cache: 'stale' } };
        }
        throw error;
    }
};

const json = (res, statusCode, payload, meta = {}) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Tech-Status', meta.status || 'live');
    res.setHeader('X-Tech-Updated-At', meta.updatedAt || '');
    res.setHeader('X-Tech-Cache', meta.cache || 'miss');
    res.status(statusCode).json(payload);
};

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathname = url.pathname;
    const sourceIds = url.searchParams.get('sourceIds')?.split(',').filter(Boolean) || null;

    try {
        if (pathname === '/api/health' || pathname === '/api/health/') {
            const entries = Array.from(cache.entries()).map(([key, v]) => ({
                key, updatedAt: v.updatedAt, expiresInMs: Math.max(0, v.expiresAt - Date.now())
            }));
            return json(res, 200, { ok: true, platform: 'vercel', now: new Date().toISOString(), cacheEntries: entries });
        }

        if (pathname === '/api/ticker' || pathname === '/api/ticker/') {
            const result = await useCached(`ticker:${sourceIds?.join(',') || 'default'}`, 60000,
                () => fetchTickerPayload(sourceIds), (p) => Array.isArray(p) && p.length > 0);
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname.startsWith('/api/briefings/')) {
            const briefingId = decodeURIComponent(pathname.replace('/api/briefings/', '').replace(/\/$/, ''));
            const result = await useCached(`briefing:${briefingId}:${sourceIds?.join(',') || 'default'}`, 60000,
                () => fetchBriefingPayload(briefingId, sourceIds), (p) => Array.isArray(p?.items) && p.items.length > 0);
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/firms' || pathname === '/api/firms/') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(`firms:${theater}`, 600000,
                () => fetchFirmsPayload(theater), (p) => p?.type === 'FeatureCollection');
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/sheets-health' || pathname === '/api/sheets-health/') {
            return json(res, 200, getRecordingHealth(), { status: 'live', updatedAt: new Date().toISOString(), cache: 'miss' });
        }

        if (pathname === '/api/escalation' || pathname === '/api/escalation/') {
            const payload = computeEscalation(cache);
            recordEscalation(payload).catch(() => {});
            return json(res, 200, payload, { status: 'live', updatedAt: payload.updatedAt, cache: 'miss' });
        }

        if (pathname === '/api/strike-stats' || pathname === '/api/strike-stats/') {
            const payload = computeStrikeStats(cache);
            return json(res, 200, payload, { status: 'live', updatedAt: new Date().toISOString(), cache: 'miss' });
        }

        if (pathname === '/api/humanitarian' || pathname === '/api/humanitarian/') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(`humanitarian:${theater}`, 3600000,
                () => fetchHumanitarianPayload(theater), (p) => p?.geojson?.type === 'FeatureCollection');
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/infrastructure' || pathname === '/api/infrastructure/') {
            const payload = computeInfrastructureStatus(cache);
            return json(res, 200, payload, { status: 'live', updatedAt: payload.updatedAt, cache: 'miss' });
        }

        if (pathname === '/api/fronts' || pathname === '/api/fronts/') {
            const payload = computeFrontStatus(cache);
            return json(res, 200, payload, { status: 'live', updatedAt: payload.updatedAt, cache: 'miss' });
        }

        if (pathname === '/api/nga-warnings' || pathname === '/api/nga-warnings/') {
            const result = await useCached('nga-warnings', 1800000,
                () => fetchNgaWarnings(), (p) => Array.isArray(p?.warnings));
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/quakes' || pathname === '/api/quakes/') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(`quakes:${theater}`, 600000,
                () => fetchUsgsQuakes(theater), (p) => p?.summary != null);
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/sentiment' || pathname === '/api/sentiment/') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(`gdelt:${theater}`, 1800000,
                () => fetchGdeltSentiment(theater), (p) => Array.isArray(p?.timeline));
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/flights' || pathname === '/api/flights/') {
            const theater = url.searchParams.get('theater') || 'middleeast';
            const result = await useCached(`airplanes:${theater}`, 120000,
                () => fetchFlightsPayload(theater), (p) => p?.type === 'FeatureCollection');
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/acled' || pathname === '/api/acled/') {
            const result = await useCached('acled:middleeast', 3600000,
                () => fetchAcledEvents(), (p) => p?.type === 'FeatureCollection');
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/oil-prices' || pathname === '/api/oil-prices/') {
            const result = await useCached('oil-prices', 1800000,
                () => fetchOilPriceTimeline(), (p) => Array.isArray(p?.brent));
            return json(res, 200, result.payload, result.meta);
        }

        if (pathname === '/api/markets' || pathname === '/api/markets/') {
            const result = await useCached('markets', 30000,
                () => fetchMarketPayload(), (p) => Array.isArray(p) && p.length > 0);
            return json(res, 200, result.payload, result.meta);
        }

        return json(res, 404, { error: 'Not found' }, { status: 'offline' });
    } catch (error) {
        return json(res, 502, { error: 'Upstream fetch failed', message: error.message }, { status: 'offline' });
    }
}
