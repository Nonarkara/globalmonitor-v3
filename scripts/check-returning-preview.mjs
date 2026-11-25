import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const previousRef = process.argv[2];
assert.ok(previousRef, 'Pass the old service-worker git revision');
const oldWorker = execFileSync('git', ['show', `${previousRef}:public/sw.js`]);
const cacheName = (worker) => String(worker).match(/const CACHE_NAME = '([^']+)'/)?.[1];
const oldCache = cacheName(oldWorker);
const newCache = cacheName(await readFile('dist/sw.js'));
assert.ok(oldCache && newCache && oldCache !== newCache);
let candidate = false;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const root = path.resolve('dist');
const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const entry = pathname === '/' || pathname === '/index.html';
    if (pathname.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"Fixture offline"}');
        return;
    }
    if (!candidate && entry) {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(
            '<p>Previous shell fixture</p><script>navigator.serviceWorker.register("/sw.js")</script>');
        return;
    }
    const legacyLogo = !candidate && pathname === '/Logo depa-01.png';
    const file = path.resolve(root, '.' + (entry ? '/index.html' : legacyLogo ? '/depa-logo.png' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(404).end();
    try {
        const bytes = !candidate && pathname === '/sw.js' ? oldWorker : await readFile(file);
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
            'Cache-Control': 'no-cache' }).end(bytes);
    } catch {
        res.writeHead(404).end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.abort());
    await page.goto(base);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    assert.deepEqual(await page.evaluate(() => caches.keys()), [oldCache]);
    await page.evaluate(() => caches.open('unrelated-cache'));
    candidate = true;
    await page.reload();
    await page.getByRole('button', { name: 'Layers', exact: true }).waitFor();
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await page.waitForFunction(async ([prior, next]) => {
        const keys = await caches.keys();
        return keys.includes(next) && !keys.includes(prior) && navigator.serviceWorker.controller?.state === 'activated';
    }, [oldCache, newCache]);
    assert.ok((await page.evaluate(() => caches.keys())).includes('unrelated-cache'));
    await page.reload();
    await page.locator('.maplibregl-canvas').waitFor();
    assert.equal(await page.getByText('Previous shell fixture').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Returning browser: new shell after normal reload, new worker active, old app cache removed, unrelated cache preserved.');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
