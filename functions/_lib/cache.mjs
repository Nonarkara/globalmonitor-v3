const cache = new Map();
const loaderHealth = new Map();

/**
 * Any payload whose own `source` says it is not a live observation — a curated
 * demo set, a sample, a fallback literal, a "no key configured" shell — must
 * never leave the API stamped `X-Tech-Status: live`. Every route passes through
 * useCached, so this is the one place the rule is enforced; the frontend hook
 * reads the header and DataStatus renders the badge. A number that is honest in
 * the payload but stamped live in the header is still a lie to the viewer.
 */
const NON_LIVE_SOURCE = /sample|fallback|curated|mock|demo|unconfigured|no_[a-z_]*key/i;

export const describeSource = (payload) =>
    payload?.meta?.source ?? payload?.source ?? null;

export const statusForPayload = (payload, fallback = 'live') => {
    const source = describeSource(payload);
    return source && NON_LIVE_SOURCE.test(String(source)) ? 'sample' : fallback;
};

export const recordHealth = (key, ok, message = null, source = null) => {
    loaderHealth.set(key, {
        ok,
        // A loader that served demo/fallback content did not observe anything.
        // Report that distinctly so the source-health modal never shows green
        // for a feed that made no network call.
        status: !ok ? 'error' : source && NON_LIVE_SOURCE.test(String(source)) ? 'demo' : 'live',
        source,
        checkedAt: new Date().toISOString(),
        message
    });
};

export const getLoaderHealth = () => loaderHealth;
export const getCacheEntries = () =>
    Array.from(cache.entries()).map(([key, value]) => ({
        key,
        updatedAt: value.updatedAt,
        expiresInMs: Math.max(0, value.expiresAt - Date.now())
    }));

export const useCached = async (key, ttlMs, loader, isUsable) => {
    const now = Date.now();
    const current = cache.get(key);

    if (current && current.expiresAt > now) {
        recordHealth(key, true, null, describeSource(current.payload));
        return {
            payload: current.payload,
            meta: {
                status: statusForPayload(current.payload),
                source: describeSource(current.payload),
                updatedAt: current.updatedAt,
                cache: 'hit'
            }
        };
    }

    try {
        const payload = await loader();

        if (!isUsable(payload)) {
            throw new Error('No usable payload returned');
        }

        const updatedAt = new Date().toISOString();
        cache.set(key, {
            payload,
            updatedAt,
            expiresAt: now + ttlMs
        });
        recordHealth(key, true, null, describeSource(payload));

        return {
            payload,
            meta: {
                status: statusForPayload(payload),
                source: describeSource(payload),
                updatedAt,
                cache: current ? 'refresh' : 'miss'
            }
        };
    } catch (error) {
        recordHealth(key, false, error.message);

        if (current) {
            return {
                payload: current.payload,
                meta: {
                    status: 'stale',
                    source: describeSource(current.payload),
                    updatedAt: current.updatedAt,
                    cache: 'stale'
                }
            };
        }

        throw error;
    }
};

export const getSharedCache = () => cache;
