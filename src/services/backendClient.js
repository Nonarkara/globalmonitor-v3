import axios from 'axios';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '';

const attachMeta = (payload, meta) => {
    if (!payload || typeof payload !== 'object') return payload;

    Object.defineProperty(payload, '__meta', {
        value: meta,
        enumerable: false,
        configurable: true
    });

    return payload;
};

// Live traffic (ADS-B / AIS) fans out to rate-limited upstreams on a cold
// edge cache and can take ~20s the first time; everything else stays at 15s.
const SLOW_PATHS = new Set(['/api/flights', '/api/vessels']);

export const fetchBackendJson = async (path, params = {}) => {
    const response = await axios.get(`${API_BASE_URL}${path}`, {
        params,
        timeout: SLOW_PATHS.has(path) ? 30000 : 15000
    });

    return attachMeta(response.data, {
        status: response.headers['x-tech-status'] || 'live',
        updatedAt: response.headers['x-tech-updated-at'] || null,
        cache: response.headers['x-tech-cache'] || 'miss',
        // 'sample' status + the source name let useLiveResource/DataStatus
        // badge demo or fallback content at the same weight as STALE.
        source: response.headers['x-tech-source'] || null
    });
};
