const cache = new Map();
const loaderHealth = new Map();

export const recordHealth = (key, ok, message = null) => {
    loaderHealth.set(key, {
        ok,
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
        recordHealth(key, true, null);
        return {
            payload: current.payload,
            meta: {
                status: 'live',
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
        recordHealth(key, true, null);

        return {
            payload,
            meta: {
                status: 'live',
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
                    updatedAt: current.updatedAt,
                    cache: 'stale'
                }
            };
        }

        throw error;
    }
};

export const getSharedCache = () => cache;
