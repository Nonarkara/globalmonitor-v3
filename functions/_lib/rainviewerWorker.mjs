let cache = { path: null, at: 0 };
const TTL_MS = 5 * 60 * 1000;

function buildPayload(path) {
    const host = 'https://tilecache.rainviewer.com';
    return {
        tiles: [`${host}${path}/256/{z}/{x}/{y}/2/1_1.png`],
        maxzoom: 12,
        attribution: 'RainViewer',
        path,
        fetchedAt: new Date().toISOString()
    };
}

/** Worker-safe RainViewer fetch — no AbortSignal (CF Workers edge timing). */
export async function getRainviewerRadarTilesWorker() {
    if (cache.path && Date.now() - cache.at < TTL_MS) {
        return buildPayload(cache.path);
    }

    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        headers: { Accept: 'application/json', 'User-Agent': 'globalmonitor-pages/1.0' }
    });
    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);

    const data = await res.json();
    const past = data.radar?.past;
    const latest = past?.[past.length - 1];
    if (!latest?.path) throw new Error('RainViewer: no radar frames');

    cache = { path: latest.path, at: Date.now() };
    return buildPayload(latest.path);
}
