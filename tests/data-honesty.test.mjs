/**
 * Data-honesty conservation law: no number reaches a viewer wearing a
 * provenance it does not have.
 *
 *   - a payload whose source is demo/sample/fallback is never stamped 'live'
 *   - no fetcher fabricates a value when its upstream is missing
 *   - silence (empty cache) is reported as absence, never as calm
 *   - composite scores are pure functions of the cache, not of traffic
 *   - the public COG probe only reaches allow-listed imagery hosts
 *
 * These import server/lib directly with the relevant env vars unset, so they
 * exercise exactly the code path a keyless Cloudflare deploy runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

delete process.env.FIRMS_MAP_KEY;
delete process.env.ACLED_API_KEY;
delete process.env.ACLED_EMAIL;

const { statusForPayload, describeSource, useCached } = await import('../functions/_lib/cache.mjs');
const { fetchFirmsPayload } = await import('../server/lib/firms.mjs');
const { fetchAcledEvents } = await import('../server/lib/acled.mjs');
const { computeEscalation } = await import('../server/lib/escalation.mjs');
const { computeFrontStatus } = await import('../server/lib/frontStatus.mjs');
const { computeStrikeStats } = await import('../server/lib/strikeStats.mjs');
const { isAllowedCogUrl, probeCog } = await import('../server/lib/cogReader.mjs');
const { fetchHumanitarianPayload } = await import('../server/lib/humanitarian.mjs');

const LIVE_STAMP = 'live';

test('cache layer never stamps demo, sample, fallback or curated payloads as live', () => {
    for (const source of ['sample-data', 'demo_offline_no_acled_key', 'curated_fallback', 'fallback', 'mock', 'no_firms_key', 'unconfigured']) {
        assert.equal(statusForPayload({ source }), 'sample', `top-level source "${source}"`);
        assert.equal(statusForPayload({ meta: { source } }), 'sample', `meta.source "${source}"`);
    }
    assert.equal(statusForPayload({ source: 'acled' }), LIVE_STAMP);
    assert.equal(statusForPayload({ meta: { source: 'nasa-firms-live' } }), LIVE_STAMP);
    assert.equal(statusForPayload({}), LIVE_STAMP, 'no source field at all stays live (unchanged behaviour)');
    assert.equal(describeSource({ meta: { source: 'a' }, source: 'b' }), 'a', 'meta.source wins');
});

test('useCached carries the derived status and source through hit, miss and stale', async () => {
    const key = `honesty-test:${Math.random()}`;
    const demo = { source: 'curated_fallback', features: [1] };
    const first = await useCached(key, 60_000, async () => demo, () => true);
    assert.equal(first.meta.status, 'sample');
    assert.equal(first.meta.source, 'curated_fallback');
    assert.equal(first.meta.cache, 'miss');

    const second = await useCached(key, 60_000, async () => { throw new Error('should not run'); }, () => true);
    assert.equal(second.meta.cache, 'hit');
    assert.equal(second.meta.status, 'sample', 'a cache hit on demo data is still demo data');

    const expired = `honesty-test:${Math.random()}`;
    await useCached(expired, -1, async () => ({ source: 'acled' }), () => true);
    const stale = await useCached(expired, -1, async () => { throw new Error('upstream down'); }, () => true);
    assert.equal(stale.meta.status, 'stale');
    assert.equal(stale.meta.source, 'acled');
});

test('FIRMS without a key returns an empty, labelled layer — no invented hotspots, no fake satellite', async () => {
    const payload = await fetchFirmsPayload('middleeast');
    assert.equal(payload.features.length, 0);
    assert.equal(payload.meta.source, 'no_firms_key');
    assert.equal(statusForPayload(payload), 'sample');

    const src = readFileSync(new URL('../server/lib/firms.mjs', import.meta.url), 'utf8');
    assert.ok(!/Math\.random/.test(src), 'firms.mjs must not synthesise a radiometric value');
    assert.ok(!/getMockFirmsData/.test(src), 'the sample generator is gone');
});

test('FIRMS refuses to substitute another region for an unknown theater', async () => {
    const payload = await fetchFirmsPayload('atlantis');
    assert.equal(payload.features.length, 0);
    assert.equal(payload.meta.theater, 'atlantis');
    assert.equal(payload.meta.source, 'no_coverage_for_theater');
});

test('ACLED without credentials serves curated events labelled DEMO on the collection and every feature', async () => {
    const payload = await fetchAcledEvents({ theater: 'middleeast' });
    assert.equal(payload.source, 'demo_offline_no_acled_key');
    assert.ok(payload.features.length > 0, 'curated demo set is kept, just labelled');
    for (const f of payload.features) {
        assert.equal(f.properties.source, 'demo_offline_no_acled_key');
    }
    assert.equal(statusForPayload(payload), 'sample');

    const src = readFileSync(new URL('../server/lib/acled.mjs', import.meta.url), 'utf8');
    assert.ok(!/OSINT verified reporting/.test(src), 'the phrase describes a process that does not exist');
    assert.ok(!/curated_fallback/.test(src));
});

test('ACLED never bridges two geographies: an unknown theater gets an empty labelled payload, not Middle East strikes', async () => {
    // 'atlantis' is unknown on every branch; 'global' has no curated set anywhere.
    for (const theater of ['atlantis', 'global']) {
        const payload = await fetchAcledEvents({ theater });
        assert.equal(payload.features.length, 0, theater);
        assert.equal(payload.theater, theater);
        assert.equal(payload.source, 'demo_offline_no_acled_key');
    }
});

test('humanitarian: unknown theater is labelled, never given Syria\'s numbers', async () => {
    const payload = await fetchHumanitarianPayload('atlantis');
    assert.equal(payload.totalDisplaced, null);
    assert.equal(payload.source, 'no_coverage_for_theater');
    const src = readFileSync(new URL('../server/lib/humanitarian.mjs', import.meta.url), 'utf8');
    assert.ok(!/7100000|1450000|120000/.test(src), 'no hardcoded displacement literals remain');
});

test('escalation: an empty cache is NO DATA, not a green zero', () => {
    const payload = computeEscalation(new Map());
    assert.equal(payload.score, null);
    assert.equal(payload.level, 'unknown');
    assert.equal(payload.label, 'NO DATA');
    assert.equal(payload.availableMax, 0);
});

test('escalation: demo/sample fires contribute nothing and the band reads sample; the band follows the theater', () => {
    const cache = new Map();
    const fires = { features: Array.from({ length: 20 }, () => ({ properties: { confidence: 'high' } })), meta: { source: 'sample-data' } };
    cache.set('firms:thailand', { payload: fires });
    cache.set('ticker:x', { payload: [{ tags: ['strikes'], pubDate: new Date().toISOString() }] });

    const scoredAsMiddleEast = computeEscalation(cache, 'middleeast');
    assert.equal(scoredAsMiddleEast.sourceHealth.firms, 'offline', 'firms:middleeast is not in the cache');

    const scoredAsThailand = computeEscalation(cache, 'thailand');
    assert.equal(scoredAsThailand.sourceHealth.firms, 'sample');
    assert.equal(scoredAsThailand.components.firms, 0, 'sample fires never score');
    assert.equal(scoredAsThailand.theater, 'thailand');
    assert.ok(scoredAsThailand.availableMax < 100, 'a partly-dark index is scored out of what reported');

    cache.set('firms:thailand', { payload: { ...fires, meta: { source: 'nasa-firms-live' } } });
    const live = computeEscalation(cache, 'thailand');
    assert.equal(live.sourceHealth.firms, 'live');
    assert.ok(live.components.firms > 0);
});

test('front board: an empty cache returns no fronts with a reason, not seven STABLE cards', () => {
    const payload = computeFrontStatus(new Map());
    assert.deepEqual(payload.fronts, []);
    assert.equal(payload.reason, 'no-signal');
});

test('front board: sample fires are not counted as thermal activity', () => {
    const cache = new Map();
    cache.set('firms:middleeast', {
        payload: {
            features: [{ geometry: { coordinates: [51.4, 32.5] }, properties: { confidence: 'high' } }],
            meta: { source: 'sample-data' }
        }
    });
    cache.set('ticker:x', { payload: [{ title: 'Iran strike reported', pubDate: new Date().toISOString() }] });
    const payload = computeFrontStatus(cache, 'middleeast');
    const iran = payload.fronts.find((f) => f.id === 'iran');
    assert.equal(iran.thermalCount, 0);
    assert.equal(payload.sourceHealth.firms, 'sample');
});

test('strike stats are a pure function of the cache — calling twice does not double the count', () => {
    const cache = new Map();
    const items = [
        { title: '12 missiles intercepted over Tel Aviv', link: 'https://a/1', pubDate: new Date().toISOString(), source: 'X' },
        { title: '12 missiles intercepted over Tel Aviv', link: 'https://a/1', pubDate: new Date().toISOString(), source: 'Y' }
    ];
    cache.set('briefing:a', { payload: { items } });
    cache.set('briefing:b', { payload: { items } });
    const once = computeStrikeStats(cache);
    const twice = computeStrikeStats(cache);
    assert.deepEqual(once.weekTotal, twice.weekTotal);
    assert.equal(once.weekTotal.missiles, 12, 'the same headline in four caches is one mention');
    assert.equal(once.headlineCount, 1);
    assert.equal(computeStrikeStats(new Map()).source, 'no_signal');
});

test('COG probe only reaches allow-listed HTTPS imagery hosts', async () => {
    assert.equal(isAllowedCogUrl('https://sh.dataspace.copernicus.eu/x.tif'), true);
    assert.equal(isAllowedCogUrl('https://planetarycomputer.microsoft.com/x.tif'), true);
    assert.equal(isAllowedCogUrl('http://sh.dataspace.copernicus.eu/x.tif'), false, 'https only');
    assert.equal(isAllowedCogUrl('https://evil.example.com/x.tif'), false);
    assert.equal(isAllowedCogUrl('https://169.254.169.254/latest/meta-data'), false);
    assert.equal(isAllowedCogUrl('https://user:pw@planetarycomputer.microsoft.com/x'), false);
    assert.equal(isAllowedCogUrl('not a url'), false);
    const rejected = await probeCog('https://evil.example.com/x.tif');
    assert.equal(rejected.accessible, false);
    assert.equal(rejected.error, 'host not allowed');
});
