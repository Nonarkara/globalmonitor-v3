#!/usr/bin/env node
/**
 * Automated control walkthrough for globalmonitor dev stack.
 * Outputs JSON results + screenshot to .qa/
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.QA_OUT_DIR || __dir;
const BASE = 'http://127.0.0.1:5180/';
const results = [];

function record(name, pass, detail = '') {
  results.push({ control: name, pass, detail });
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(8000);
    await page.locator('.map-coord-readout, .map-wrapper, canvas').first().waitFor({ timeout: 20000 }).catch(() => {});

    // Region tabs
    for (const label of ['Middle East', 'Indo-Pacific', 'Thailand', 'Global']) {
      const tab = page.getByRole('tab', { name: new RegExp(`Switch dashboard to ${label}`, 'i') });
      const exists = (await tab.count()) > 0;
      if (!exists) {
        record(`Region tab: ${label}`, false, 'Tab not found');
        continue;
      }
      await tab.click();
      await wait(1500);
      const subtitle = await page.locator('.header-subtitle').textContent();
      const active = await tab.getAttribute('aria-selected');
      record(`Region tab: ${label}`, active === 'true' && subtitle?.includes(label.split('-')[0].trim()), `subtitle="${subtitle?.trim()}" aria-selected=${active}`);
    }

    // Basemap
    for (const name of ['Dark', 'Satellite', 'Political']) {
      const btn = page.getByRole('radio', { name: new RegExp(`Use ${name} basemap`, 'i') });
      if ((await btn.count()) === 0) {
        record(`Basemap: ${name}`, false, 'Button not found');
        continue;
      }
      await btn.click();
      await wait(800);
      const checked = await btn.getAttribute('aria-checked');
      const hasActive = await btn.evaluate((el) => el.classList.contains('active'));
      record(`Basemap: ${name}`, checked === 'true' || hasActive, `aria-checked=${checked} active=${hasActive}`);
    }

    // Layer groups — test one toggle per group
    const layerTests = [
      { group: 'Operational', label: /Conflict events/i },
      { group: 'Mobility', label: /Aircraft/i },
      { group: 'Environment', label: /Precipitation|Air quality/i },
    ];
    for (const { group, label } of layerTests) {
      const btn = page.getByRole('button', { name: label }).first();
      if ((await btn.count()) === 0) {
        record(`Layer toggle (${group})`, false, 'Layer button not found');
        continue;
      }
      const before = await btn.getAttribute('aria-pressed');
      await btn.click();
      await wait(400);
      const after = await btn.getAttribute('aria-pressed');
      record(`Layer toggle (${group})`, before !== after, `aria-pressed ${before} → ${after}`);
    }

    // About via Tools menu
    const toolsBtn = page.getByRole('button', { name: /Tools and advanced options/i });
    if ((await toolsBtn.count()) === 0) {
      record('About / Tools menu', false, 'Tools button not found');
    } else {
      await toolsBtn.click();
      await wait(300);
      const aboutItem = page.getByRole('menuitem', { name: /About/i });
      if ((await aboutItem.count()) === 0) {
        record('About modal', false, 'About menuitem not found');
      } else {
        await aboutItem.click();
        await wait(500);
        const modalVisible = (await page.locator('text=FUNDED BY').count()) > 0;
        record('About modal', modalVisible, modalVisible ? 'FUNDED BY visible' : 'Modal content missing');
        if (modalVisible) {
          const closeBtn = page.getByRole('button', { name: /Close about panel/i });
          if ((await closeBtn.count()) > 0) {
            await closeBtn.click({ timeout: 5000 });
            await wait(300);
            const stillOpen = (await page.locator('text=FUNDED BY').count()) > 0;
            record('About modal Close button', !stillOpen, stillOpen ? 'Modal did not close' : 'Closed via button');
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }

      // Settings (News sources)
      await toolsBtn.click();
      await wait(300);
      const settingsItem = page.getByRole('menuitem', { name: /News sources/i });
      if ((await settingsItem.count()) === 0) {
        record('Settings (News sources)', false, 'Menu item not found');
      } else {
        await settingsItem.click();
        await wait(500);
        const settingsVisible = (await page.locator('text=News Sources').or(page.locator('text=News sources')).count()) > 0;
        record('Settings (News sources)', settingsVisible, settingsVisible ? 'Modal opened' : 'Modal missing');
        if (settingsVisible) {
          await page.keyboard.press('Escape');
          await wait(300);
        }
      }
    }

    // Coordinate readout — hover map area
    const mapArea = page.locator('.map-wrapper').first();
    const mapCanvas = page.locator('.maplibregl-canvas, .mapboxgl-canvas, .map-wrapper canvas').first();
    let mapBox = null;
    if ((await mapCanvas.count()) > 0) {
      mapBox = await mapCanvas.boundingBox();
    } else if ((await mapArea.count()) > 0) {
      mapBox = await mapArea.boundingBox();
    }
    if (!mapBox) {
      record('Map coordinate readout', false, 'Map area not found (WebGL may be unavailable in headless)');
    } else {
      await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
      await wait(800);
      const readout = await page.locator('.map-coord-readout').textContent();
      const hasCoords = readout && !readout.includes('Move cursor over map') && /\d/.test(readout);
      record('Map coordinate readout', !!hasCoords, readout?.trim().slice(0, 80) || 'empty');
    }

    // Click map for popup (conflicts layer should be on)
    if (mapBox) {
      await page.mouse.click(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.45);
      await wait(800);
      const popup = page.locator('.maplibregl-popup, .mapboxgl-popup, .traffic-tooltip').first();
      const popupVisible = await popup.isVisible().catch(() => false);
      record('Map dot popup', popupVisible, popupVisible ? 'Popup appeared' : 'No popup on click (may need feature under cursor)');
    }

    // Contrast spot-check: header region tab active state
    const activeTab = page.locator('.header-region-tab.is-active').first();
    if ((await activeTab.count()) > 0) {
      const contrast = await activeTab.evaluate((el) => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor;
        const fg = s.color;
        const parse = (c) => {
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
        };
        const lum = ([r, g, b]) => {
          const f = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const l1 = lum(parse(fg));
        const l2 = lum(parse(bg));
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return { ratio: Math.round(ratio * 100) / 100, fg, bg };
      });
      record('Active tab contrast (WCAG AA ≥4.5)', contrast.ratio >= 4.5, `ratio=${contrast.ratio} fg=${contrast.fg} bg=${contrast.bg}`);
    }

    await page.screenshot({ path: join(OUT_DIR, 'live-walkthrough.png'), fullPage: false });
  } catch (err) {
    record('Walkthrough fatal', false, err.message);
    await page.screenshot({ path: join(__dir, 'walkthrough-error.png'), fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const out = join(OUT_DIR, 'walkthrough-results.json');
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
