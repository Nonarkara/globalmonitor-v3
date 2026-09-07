import axios from 'axios';

// Lightweight COG tile proxy using HTTP Range Requests
// Serves overview tiles from Cloud Optimized GeoTIFFs without downloading full files

const TILE_CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 200;

const pruneCache = () => {
    if (TILE_CACHE.size <= MAX_CACHE_ENTRIES) return;
    const entries = Array.from(TILE_CACHE.entries())
        .sort((a, b) => a[1].accessedAt - b[1].accessedAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    toRemove.forEach(([key]) => TILE_CACHE.delete(key));
};

// /api/cog/probe is public and takes a caller-supplied URL. Without a host
// allowlist it is an open proxy: anyone can make this server fetch any
// address on the internet (including internal ones) and read back headers
// and error text. Only the imagery hosts the app actually reads from are
// permitted; everything else is rejected before any network call.
const COG_HOST_ALLOWLIST = [
    /(^|\.)copernicus\.eu$/,
    /(^|\.)planetarycomputer\.microsoft\.com$/,
    /(^|\.)blob\.core\.windows\.net$/,
    /(^|\.)earthdata\.nasa\.gov$/,
    /(^|\.)amazonaws\.com$/,
    /(^|\.)element84\.com$/,
    /(^|\.)sentinel-hub\.com$/
];

export const isAllowedCogUrl = (raw) => {
    let parsed;
    try {
        parsed = new URL(String(raw));
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return COG_HOST_ALLOWLIST.some((re) => re.test(parsed.hostname));
};

const rejectedProbe = (cogUrl) => ({
    url: cogUrl,
    supportsRangeRequests: false,
    totalSize: 0,
    accessible: false,
    error: 'host not allowed'
});

// Read the first bytes of a COG to get IFD info (overview detection)
export const probeCog = async (cogUrl) => {
    if (!isAllowedCogUrl(cogUrl)) return rejectedProbe(cogUrl);
    try {
        const response = await axios.get(cogUrl, {
            headers: { Range: 'bytes=0-8191' },
            responseType: 'arraybuffer',
            timeout: 10000
        });

        const contentRange = response.headers['content-range'];
        const acceptRanges = response.headers['accept-ranges'];
        const supportsRangeRequests = response.status === 206
            || acceptRanges === 'bytes'
            || Boolean(contentRange);

        const totalSize = contentRange
            ? parseInt(contentRange.split('/')[1], 10)
            : parseInt(response.headers['content-length'] || '0', 10);

        return {
            url: cogUrl,
            supportsRangeRequests,
            totalSize,
            contentType: response.headers['content-type'],
            accessible: true
        };
    } catch (error) {
        return {
            url: cogUrl,
            supportsRangeRequests: false,
            totalSize: 0,
            accessible: false,
            error: error.message
        };
    }
};

// Fetch a byte range from a COG
export const fetchCogRange = async (cogUrl, start, end) => {
    const key = `${cogUrl}_${start}_${end}`;
    const cached = TILE_CACHE.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        cached.accessedAt = Date.now();
        return cached.data;
    }

    const response = await axios.get(cogUrl, {
        headers: { Range: `bytes=${start}-${end}` },
        responseType: 'arraybuffer',
        timeout: 15000
    });

    const data = Buffer.from(response.data);
    TILE_CACHE.set(key, {
        data,
        expiresAt: Date.now() + CACHE_TTL,
        accessedAt: Date.now()
    });
    pruneCache();

    return data;
};

// Fetch overview image from a COG (first ~512KB typically contains overview pyramid)
export const fetchCogOverview = async (cogUrl, maxBytes = 524288) => {
    const key = `overview_${cogUrl}`;
    const cached = TILE_CACHE.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        cached.accessedAt = Date.now();
        return cached.data;
    }

    const response = await axios.get(cogUrl, {
        headers: { Range: `bytes=0-${maxBytes - 1}` },
        responseType: 'arraybuffer',
        timeout: 20000
    });

    const data = {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'image/tiff',
        size: response.data.byteLength,
        partial: response.status === 206
    };

    TILE_CACHE.set(key, {
        data,
        expiresAt: Date.now() + CACHE_TTL,
        accessedAt: Date.now()
    });
    pruneCache();

    return data;
};

export const getCogCacheStats = () => ({
    entries: TILE_CACHE.size,
    maxEntries: MAX_CACHE_ENTRIES,
    ttlMs: CACHE_TTL
});
