import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { trafficArchive } from '../src/services/trafficArchive.js';
import { GdeltRateLimit } from '../server/lib/gdelt.mjs';
import { jsonResponse } from '../functions/_lib/response.mjs';

test('only the active dated snapshot can enter the recent layer', () => {
    const now = Date.parse('2026-11-25T12:00:00Z');
    const flight = { source: 'adsb-snapshot', collectedAt: '2026-11-24T12:00:00Z' };
    assert.equal(trafficArchive('aircraft', flight, now).hidden, true);
    assert.equal(trafficArchive('aircraft', flight, now - 1).hidden, false);
    assert.match(trafficArchive('aircraft', { ...flight, collectedAt: null, fetchedAt: new Date(now).toISOString() }, now).label, /unknown/);
    const vessel = { staticSnapshot: true, staticSnapshotAt: '2026-10-01T00:00:00Z' };
    assert.equal(trafficArchive('vessel', { ...vessel, aisSource: 'static-snapshot' }, now).hidden, true);
    assert.equal(trafficArchive('vessel', { ...vessel, aisSource: 'axiom-overwatch' }, now), null);
});

test('bounded rate limit reports unavailable without inventing an update time', async () => {
    assert.equal(new GdeltRateLimit('9999999').retryAfter, 900);
    assert.equal(new GdeltRateLimit(null).retryAfter, 60);
    const result = jsonResponse({ retry_after: 60 }, 503, { status: 'unavailable', retryAfter: 60 });
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('retry-after'), '60');
    assert.equal(result.headers.get('x-tech-updated-at'), '');
});

test('the default entry does not mount an official-use banner or start legacy tracking', async () => {
    const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
    const entry = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
    assert.doesNotMatch(app, /ClassificationBanner|FOR OFFICIAL USE/i);
    assert.match(entry, /if \(import\.meta\.env\.VITE_ENABLE_LEGACY_VISITOR_TRACKING === 'true'\) \{\s+import\('\.\/services\/visitorTracker\.js'\)/);
});

test('the compiled-asset guard rejects a reintroduced official-use marking', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'globewatch-bundle-test-'));
    const guard = new URL('../scripts/check-public-bundle.mjs', import.meta.url);
    try {
        await mkdir(path.join(dir, 'assets'));
        await writeFile(path.join(dir, 'index.html'), '<div id="root"></div>');
        const entry = path.join(dir, 'assets', 'index.js');
        await writeFile(entry, 'globalThis.releaseNotice = "Independent OSINT";');
        assert.equal(spawnSync(process.execPath, [guard.pathname, dir]).status, 0);
        await writeFile(entry, 'globalThis.releaseNotice = "UNCLASSIFIED // FOR OFFICIAL USE ONLY";');
        assert.equal(spawnSync(process.execPath, [guard.pathname, dir]).status, 1);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
