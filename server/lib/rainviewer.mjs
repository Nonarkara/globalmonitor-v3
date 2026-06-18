/**
 * RainViewer radar tile path — cached from public API.
 * The legacy /v2/radar/nowcast/… URL returns 404; paths are hash-based now.
 */
let cache = { path: null, at: 0 };
const TTL_MS = 5 * 60 * 1000;

export async function getRainviewerRadarTiles() {
    if (cache.path && Date.now() - cache.at < TTL_MS) {
        return buildPayload(cache.path);
    }

    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);

    const data = await res.json();
    const past = data.radar?.past;
    const latest = past?.[past.length - 1];
    if (!latest?.path) throw new Error('RainViewer: no radar frames');

    cache = { path: latest.path, at: Date.now() };
    return buildPayload(latest.path);
}

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
