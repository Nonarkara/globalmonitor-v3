import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333;
const url = process.env.QA_URL || 'https://globalmonitor.pages.dev/';

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  '--window-size=1440,1000',
  url,
], { stdio: ['ignore', 'pipe', 'pipe'] });

const cleanup = () => {
  try { chrome.kill('SIGTERM'); } catch {}
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

async function json(path) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function waitForDebug() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const pages = await json('/json/list');
      const page = pages.find((p) => p.type === 'page');
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugger did not start');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (message) => {
      const payload = JSON.parse(message.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
      } else if (payload.method) {
        this.events.push(payload);
      }
    };
  }

  async open() {
    while (this.ws.readyState === WebSocket.CONNECTING) await delay(50);
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }
}

const page = await waitForDebug();
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.open();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');
await cdp.send('Network.enable');

const consoleMessages = [];
const networkFailures = [];
const eventPump = setInterval(() => {
  for (const event of cdp.events.splice(0)) {
    if (event.method === 'Runtime.consoleAPICalled') {
      consoleMessages.push(event.params.args?.map((a) => a.value || a.description).join(' '));
    }
    if (event.method === 'Log.entryAdded') {
      consoleMessages.push(`${event.params.entry.level}: ${event.params.entry.text}`);
    }
    if (event.method === 'Network.loadingFailed') {
      networkFailures.push(event.params);
    }
  }
}, 100);

async function evalJs(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime exception');
  }
  return result.result.value;
}

async function click(label, selectorExpression) {
  const before = await evalJs(`document.body.innerText.slice(0, 120)`);
  const value = await evalJs(`
    (() => {
      const el = ${selectorExpression};
      if (!el) return { ok: false, reason: 'not found' };
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return {
        ok: true,
        tag: el.tagName,
        text: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 80)
      };
    })()
  `);
  await delay(900);
  const after = await evalJs(`document.body.innerText.slice(0, 120)`);
  return { label, ...value, changedTopText: before !== after };
}

await delay(7000);

const initial = await evalJs(`
  (() => ({
    title: document.title,
    bodyChars: document.body.innerText.length,
    buttons: document.querySelectorAll('button').length,
    panels: document.querySelectorAll('.grid-panel,.bottom-card,.multi-front-board').length,
    layerCards: document.querySelectorAll('.layer-card').length,
    headerTabs: [...document.querySelectorAll('.header-region-tab')].map((b) => b.innerText.trim()),
    visibleTextSample: document.body.innerText.slice(0, 600)
  }))()
`);

const interactions = [];
interactions.push(await click('switch to Southeast Asia', `[...document.querySelectorAll('.header-region-tab')].find(b => /southeast asia/i.test(b.innerText))`));
interactions.push(await click('switch to Thailand', `[...document.querySelectorAll('.header-region-tab')].find(b => /thailand/i.test(b.innerText))`));
interactions.push(await click('switch back to Middle East', `[...document.querySelectorAll('.header-region-tab')].find(b => /middle east/i.test(b.innerText))`));
interactions.push(await click('open tools for source health', `document.querySelector('[aria-label="Tools and advanced options"]')`));
interactions.push(await click('open source health', `[...document.querySelectorAll('.header-tools-menu button')].find(b => /data health/i.test(b.innerText))`));
interactions.push(await click('close source health modal', `document.querySelector('[aria-label="Close source health modal"], .modal-overlay button')`));
interactions.push(await click('open tools for settings', `document.querySelector('[aria-label="Tools and advanced options"]')`));
interactions.push(await click('open settings', `[...document.querySelectorAll('.header-tools-menu button')].find(b => /news sources/i.test(b.innerText))`));
interactions.push(await click('close settings modal', `document.querySelector('[aria-label="Close settings modal"], .modal-overlay button')`));
interactions.push(await click('toggle satellite basemap', `[...document.querySelectorAll('.basemap-option')].find(b => /Satellite/.test(b.innerText))`));
interactions.push(await click('toggle flights layer', `[...document.querySelectorAll('.layer-card')].find(b => /^(Flights|Aircraft)/.test(b.innerText.trim()))`));
interactions.push(await click('toggle ships layer', `[...document.querySelectorAll('.layer-card')].find(b => /^Ships/.test(b.innerText.trim()))`));
interactions.push(await click('open tools for about', `document.querySelector('[aria-label="Tools and advanced options"]')`));
interactions.push(await click('open about modal', `[...document.querySelectorAll('.header-tools-menu button')].find(b => /^About/i.test(b.innerText))`));
interactions.push(await click('close about modal', `document.querySelector('.modal-overlay')`));

const finalState = await evalJs(`
  (() => ({
    bodyChars: document.body.innerText.length,
    activeRegion: document.querySelector('.header-region-tab.is-active')?.innerText.trim(),
    activeLayers: [...document.querySelectorAll('.layer-card.active .layer-title')].map((el) => el.innerText.trim()).slice(0, 20),
    modalOpen: Boolean(document.querySelector('.modal-overlay')),
    unavailableCount: (document.body.innerText.match(/UNAVAILABLE|Awaiting/g) || []).length,
    visibleTextSample: document.body.innerText.slice(0, 800)
  }))()
`);

await mkdir('.qa', { recursive: true });
const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile('.qa/live-walkthrough.png', Buffer.from(screenshot.data, 'base64'));

const report = {
  url,
  checkedAt: new Date().toISOString(),
  initial,
  interactions,
  finalState,
  consoleMessages: consoleMessages.slice(-30),
  networkFailures: networkFailures.slice(-20).map((f) => ({
    errorText: f.errorText,
    canceled: f.canceled,
    type: f.type,
  })),
  screenshot: '.qa/live-walkthrough.png',
};

console.log(JSON.stringify(report, null, 2));
clearInterval(eventPump);
cleanup();
