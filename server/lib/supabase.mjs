/**
 * Supabase client singleton — server side.
 *
 * Globalmonitor reuses the geopolitics-dashboard Supabase project to keep
 * costs at $0 (Supabase free tier allows 2 projects per org, so this avoids
 * needing a third). Tables are namespaced with `gm_` to avoid colliding
 * with the existing geopolitics-dashboard schema.
 *
 * Required environment variables (server-side only):
 *   GM_SUPABASE_URL              e.g. https://qbatksnulitgrhigzbta.supabase.co
 *   GM_SUPABASE_SERVICE_KEY      service_role JWT (NEVER ship in client bundle)
 *
 * If either env var is missing the client is null and ingestion silently no-ops.
 * That keeps local dev frictionless — the dashboard works without Supabase.
 */
import { createClient } from '@supabase/supabase-js';

let client = null;
let lastInitMessage = null;

const init = () => {
    if (client) return client;
    const url = process.env.GM_SUPABASE_URL;
    const key = process.env.GM_SUPABASE_SERVICE_KEY;
    if (!url || !key) {
        lastInitMessage = 'Supabase env vars missing — ingestion disabled.';
        return null;
    }
    client = createClient(url, key, { auth: { persistSession: false } });
    lastInitMessage = `Supabase client initialised for ${url}`;
    return client;
};

export const getSupabase = () => init();

export const isSupabaseEnabled = () => Boolean(init());

export const getSupabaseStatusMessage = () => lastInitMessage;

/**
 * Insert news items in bulk. De-duped by (region, code, link) at the DB layer.
 * Returns { inserted, skipped, error } — caller decides what to surface.
 */
export const upsertNewsItems = async (region, code, items) => {
    const sb = init();
    if (!sb) return { inserted: 0, skipped: items.length, error: 'supabase-disabled' };
    if (!Array.isArray(items) || items.length === 0) {
        return { inserted: 0, skipped: 0, error: null };
    }
    const rows = items.map((it) => ({
        region,
        code,
        title: it.title,
        link: it.link,
        source: it.source || null,
        tag: it.tag || null,
        pub_date: it.pubDate ? new Date(it.pubDate).toISOString() : null
    }));
    const { data, error } = await sb
        .from('gm_news_items')
        .upsert(rows, { onConflict: 'region,code,link', ignoreDuplicates: true });
    if (error) return { inserted: 0, skipped: rows.length, error: error.message };
    return { inserted: data?.length || rows.length, skipped: 0, error: null };
};

/**
 * Read recent news items for a region/code. Limit defaults to 8.
 */
export const fetchNewsItems = async (region, code, limit = 8) => {
    const sb = init();
    if (!sb) return [];
    const { data, error } = await sb
        .from('gm_news_items')
        .select('title, link, source, tag, pub_date, fetched_at')
        .eq('region', region)
        .eq('code', code)
        .order('pub_date', { ascending: false, nullsFirst: false })
        .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
        title: r.title,
        link: r.link,
        source: r.source,
        tag: r.tag,
        pubDate: r.pub_date ? new Date(r.pub_date) : new Date(r.fetched_at)
    }));
};

/**
 * Log an ingestion run for the source-health panel.
 */
export const recordIngestionRun = async ({ loader, region = null, status, rowsInserted = 0, rowsUpdated = 0, errorMessage = null, durationMs = 0 }) => {
    const sb = init();
    if (!sb) return;
    await sb.from('gm_ingestion_runs').insert({
        loader,
        region,
        status,
        rows_inserted: rowsInserted,
        rows_updated: rowsUpdated,
        error_message: errorMessage,
        duration_ms: durationMs,
        finished_at: new Date().toISOString()
    });
};

/**
 * Archive ACLED conflict events. De-duped by (event_date, lat, lon, actor1).
 * Expects a GeoJSON FeatureCollection as returned by fetchAcledEvents().
 */
export const upsertAcledEvents = async (geojson) => {
    const sb = init();
    if (!sb || !geojson?.features?.length) return;
    const t0 = Date.now();
    const rows = geojson.features.map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return {
            event_date:     p.eventDate || p.event_date || p.date || null,
            event_type:     p.eventType || p.event_type || null,
            sub_event_type: p.subType   || p.sub_event_type || null,
            actor1:         p.actor1    || null,
            actor2:         p.actor2    || null,
            country:        p.country   || null,
            admin1:         p.admin1    || p.region || null,
            latitude:       lat ?? null,
            longitude:      lon ?? null,
            fatalities:     Number(p.fatalities) || 0,
            notes:          p.notes ? String(p.notes).substring(0, 500) : null,
            source:         p.source    || null
        };
    }).filter((r) => r.event_date);
    if (!rows.length) return;
    const { error } = await sb
        .from('gm_acled_events')
        .upsert(rows, { onConflict: 'event_date,latitude,longitude,actor1', ignoreDuplicates: true });
    await recordIngestionRun({
        loader: 'acled', status: error ? 'fail' : 'ok',
        rowsInserted: error ? 0 : rows.length,
        errorMessage: error?.message || null,
        durationMs: Date.now() - t0
    });
};

/**
 * Archive NASA FIRMS thermal hotspots. De-duped by (acq_date, acq_time, lat, lon).
 * Expects a GeoJSON FeatureCollection as returned by fetchFirmsPayload().
 */
export const upsertFirmsHotspots = async (geojson, theater = 'middleeast') => {
    const sb = init();
    if (!sb || !geojson?.features?.length) return;
    const t0 = Date.now();
    const rows = geojson.features.map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        return {
            acq_date:   p.acq_date  || p.date || null,
            acq_time:   String(p.acq_time || p.time || ''),
            latitude:   lat ?? null,
            longitude:  lon ?? null,
            brightness: Number(p.brightness) || null,
            frp:        Number(p.frp) || null,
            satellite:  p.satellite || null,
            confidence: String(p.confidence || ''),
            daynight:   p.daynight  || null,
            theater
        };
    }).filter((r) => r.acq_date && r.latitude != null);
    if (!rows.length) return;
    const { error } = await sb
        .from('gm_firms_hotspots')
        .upsert(rows, { onConflict: 'acq_date,acq_time,latitude,longitude', ignoreDuplicates: true });
    await recordIngestionRun({
        loader: 'firms', status: error ? 'fail' : 'ok',
        rowsInserted: error ? 0 : rows.length,
        errorMessage: error?.message || null,
        durationMs: Date.now() - t0
    });
};

/**
 * Archive market quotes snapshot. Throttle handled by the caller.
 * Expects the array returned by fetchMarketPayload().
 */
export const upsertMarketQuotes = async (items) => {
    const sb = init();
    if (!sb || !Array.isArray(items) || !items.length) return;
    const t0 = Date.now();
    const rows = items.map((m) => ({
        symbol:      m.symbol || m.name || '',
        price:       String(m.price || ''),
        change_perc: String(m.changePerc || m.change || ''),
        is_positive: Boolean(m.isPositive)
    }));
    const { data, error } = await sb
        .from('gm_market_quotes')
        .upsert(rows, { onConflict: 'symbol', ignoreDuplicates: false });
    await recordIngestionRun({
        loader: 'markets', status: error ? 'fail' : 'ok',
        rowsInserted: error ? 0 : data?.length || rows.length,
        errorMessage: error?.message || null,
        durationMs: Date.now() - t0
    });
};

/**
 * Archive GDELT sentiment timeline.
 * Expects the object returned by fetchGdeltSentiment(): { timeline, query }.
 */
export const upsertSentimentReadings = async (data) => {
    const sb = init();
    if (!sb || !Array.isArray(data?.timeline) || !data.timeline.length) return;
    const t0 = Date.now();
    const rows = data.timeline.map((t) => ({
        query:        data.query || 'ME conflict',
        tone:         Number(t.tone) || null,
        reading_date: t.date || null
    })).filter((r) => r.reading_date);
    if (!rows.length) return;
    const { data: upsertData, error } = await sb
        .from('gm_sentiment_readings')
        .upsert(rows, { onConflict: 'query,reading_date', ignoreDuplicates: false });
    await recordIngestionRun({
        loader: 'sentiment', status: error ? 'fail' : 'ok',
        rowsInserted: error ? 0 : upsertData?.length || rows.length,
        errorMessage: error?.message || null,
        durationMs: Date.now() - t0
    });
};
