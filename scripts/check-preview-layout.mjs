import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2];
assert.equal(new URL(url).hostname, '127.0.0.1', 'run on a local preview only');
const screenshots = process.argv[3];
if (screenshots) await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const errors = [];
    let mapWorkerLoaded = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
        if (/\/assets\/maplibre-gl-worker-.*\.js$/.test(response.url()) && response.ok()) mapWorkerLoaded = true;
    });
    await page.route('**/*', route => {
        const request = route.request();
        if (request.method() !== 'GET') return route.abort();
        if (new URL(request.url()).pathname.startsWith('/api/')) {
            return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable feed' } });
        }
        return route.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('.maplibregl-canvas').waitFor({ timeout: 20000 });
    const metrics = () => page.evaluate(() => {
        const canvas = document.querySelector('.maplibregl-canvas').getBoundingClientRect();
        const header = document.querySelector('.header-bar').getBoundingClientRect();
        const dock = document.querySelector('.mobile-theater-nav').getBoundingClientRect();
        const area = Math.max(0, Math.min(canvas.right, innerWidth) - Math.max(0, canvas.left)) *
            Math.max(0, Math.min(canvas.bottom, dock.top) - Math.max(canvas.top, header.bottom));
        let openPoints = 0;
        for (let row = 0; row < 20; row++) for (let col = 0; col < 20; col++) {
            const x = (col + .5) * innerWidth / 20;
            const y = (row + .5) * innerHeight / 20;
            if (x < canvas.left || x >= canvas.right || y < canvas.top || y >= canvas.bottom) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit?.closest('.maplibregl-map') && !hit.closest('.maplibregl-control-container, .maplibregl-popup')) openPoints++;
        }
        const controls = [...document.querySelectorAll('.header-controls button, .mobile-theater-nav button, .map-legend--traffic summary')]
            .filter(el => el.getClientRects().length)
            .every(el => {
                const { left, right, top, bottom } = el.getBoundingClientRect();
                const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
                return left >= 0 && top >= 0 && right <= innerWidth + 1 && bottom <= innerHeight + 1 && el.contains(hit);
            });
        return { chrome: header.height, dock: dock.height, share: area / (innerWidth * innerHeight),
            sampledClearShare: openPoints / 400, controls };
    });
    function check(value) {
        assert.ok(value.chrome <= 56 && value.dock <= 56, JSON.stringify(value));
        assert.ok(value.share >= .6 && value.sampledClearShare >= .6 && value.controls, JSON.stringify(value));
    }
    for (const width of [320, 375, 390, 768, 1023, 1024, 1025, 1440]) {
        await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
        await page.getByRole('button', { name: 'Layers', exact: true }).waitFor();
        // MapLibre resizes its canvas asynchronously after the grid has settled.
        await page.waitForFunction(() => {
            const canvas = document.querySelector('.maplibregl-canvas')?.getBoundingClientRect();
            const map = document.querySelector('.map-wrapper')?.getBoundingClientRect();
            return canvas && map && Math.abs(canvas.width - map.width) <= 2 && Math.abs(canvas.height - map.height) <= 2;
        });
        const value = await metrics();
        check(value);
        console.log(width, JSON.stringify(value));
        if (screenshots && [390, 1024].includes(width)) await page.screenshot({ path: `${screenshots}/after-${width}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const sources = page.getByText('Sources', { exact: true });
    await sources.click();
    assert.equal(await page.locator('.map-legend--traffic').getAttribute('open'), '');
    await sources.click();
    for (const [button, close] of [['Layers', 'Close layers'], ['Intel', 'Close intel']]) {
        const trigger = page.getByRole('button', { name: button, exact: true });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const closeButton = page.getByRole('button', { name: close });
        await closeButton.waitFor();
        assert.equal(await closeButton.evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Escape');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    }
    const tools = page.getByRole('button', { name: 'Tools and advanced options' });
    await tools.click();
    await page.getByRole('menuitem', { name: 'Manual' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await tools.getAttribute('aria-expanded'), 'false');
    const layers = page.getByRole('button', { name: 'Layers', exact: true });
    await layers.click();
    for (const name of ['Flights', 'Ships']) {
        const toggle = page.getByRole('button', { name, exact: true });
        await toggle.click();
        await toggle.click();
    }
    await page.keyboard.press('Escape');
    await tools.click();
    await page.getByRole('menuitem', { name: 'Print briefing' }).click();
    const print = page.getByRole('button', { name: 'Print briefing', exact: true });
    await print.waitFor();
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await print.click();
    assert.equal(await page.evaluate(() => window.__printed), true);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.preview-intel').isVisible(), true);
    assert.equal(await page.locator('.preview-dock').isVisible(), false);
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    const obstruction = await page.addStyleTag({ content: '.map-wrapper {height: 120px !important}' });
    const obstructed = await metrics();
    assert.ok(obstructed.share < .6);
    assert.throws(() => check(obstructed), /share/);
    await obstruction.evaluate(el => el.remove());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.maplibregl-canvas').waitFor();
    if (screenshots) await page.screenshot({ path: `${screenshots}/after-1440.png` });
    assert.deepEqual(errors, []);
    if (process.env.REQUIRE_MAP_WORKER === '1') assert.ok(mapWorkerLoaded, 'bundled MapLibre worker did not load');
} finally {
    await browser.close();
}
