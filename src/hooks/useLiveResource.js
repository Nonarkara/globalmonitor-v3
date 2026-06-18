import { useCallback, useEffect, useRef, useState } from 'react';

const readCachedState = (cacheKey) => {
    if (!cacheKey || typeof window === 'undefined') {
        return { data: null, lastUpdated: null };
    }

    try {
        const raw = window.localStorage.getItem(`tech-monitor:${cacheKey}`);
        if (!raw) return { data: null, lastUpdated: null };

        const parsed = JSON.parse(raw);
        return {
            data: parsed.data ?? null,
            lastUpdated: parsed.lastUpdated ?? null
        };
    } catch {
        return { data: null, lastUpdated: null };
    }
};

const writeCachedState = (cacheKey, data, lastUpdated) => {
    if (!cacheKey || typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(`tech-monitor:${cacheKey}`, JSON.stringify({
            data,
            lastUpdated
        }));
    } catch {
        // Ignore storage write errors. Live rendering should continue.
    }
};

const defaultIsUsable = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

/** Sleep helper for retry backoff */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stretch the polling interval on phones and slow networks.
 *  Phone screens see 30+ live consumers, each polling every 5min by default —
 *  on a 3G or 2g.gp network that's a thrash. Tripling the interval on mobile
 *  cuts request volume without the user noticing on data that already updates
 *  this slowly. */
const getEffectiveInterval = (baseMs) => {
    if (typeof window === 'undefined') return baseMs;
    const effectiveType = navigator.connection?.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
        return baseMs * 3;
    }
    if (window.matchMedia && window.matchMedia('(max-width: 480px)').matches) {
        return baseMs * 3;
    }
    return baseMs;
};

export const useLiveResource = (fetcher, {
    cacheKey,
    enabled = true,
    intervalMs = 300000,
    isUsable = defaultIsUsable,
    maxRetries = 3,
    maxStaleMs = 10 * 60 * 1000  // 10 minutes — after this, data is considered stale
} = {}) => {
    const [cached] = useState(() => readCachedState(cacheKey));
    const dataRef = useRef(cached.data);

    // Stabilize isUsable so it never causes re-render loops
    const isUsableRef = useRef(isUsable);
    isUsableRef.current = isUsable;

    const [data, setData] = useState(cached.data);
    const [lastUpdated, setLastUpdated] = useState(cached.lastUpdated);
    const [isLoading, setIsLoading] = useState(enabled && !cached.data);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStale, setIsStale] = useState(Boolean(cached.data));
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    dataRef.current = data;

    const lastUpdatedRef = useRef(lastUpdated);
    lastUpdatedRef.current = lastUpdated;

    const load = useCallback(async ({ manual = false } = {}) => {
        if (!enabled) return;

        // Background polls must not toggle isRefreshing — DataStatus badge insertion
        // was shifting Multi-Front / Iran theater bar height every interval tick.
        if (manual && dataRef.current) {
            setIsRefreshing(true);
        } else if (!dataRef.current) {
            setIsLoading(true);
        }

        let lastError = null;

        // Retry loop with exponential backoff
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
                    await sleep(backoffMs);
                }

                const result = await fetcher();
                const responseMeta = result && typeof result === 'object' ? result.__meta : null;

                if (!isUsableRef.current(result)) {
                    throw new Error('No usable live data returned');
                }

                const stampedAt = new Date().toISOString();
                setData(result);
                setLastUpdated(responseMeta?.updatedAt || stampedAt);
                setIsStale(responseMeta?.status === 'stale');
                setError(null);
                setRetryCount(0);
                writeCachedState(cacheKey, result, responseMeta?.updatedAt || stampedAt);

                // Success — break out of retry loop
                setIsLoading(false);
                setIsRefreshing(false);
                return;
            } catch (caughtError) {
                lastError = caughtError;
            }
        }

        // All retries exhausted
        setError(lastError);
        setRetryCount((prev) => prev + 1);

        // Check if existing data is too old
        const hasData = Boolean(dataRef.current || cached.data);
        const stamp = lastUpdatedRef.current;
        if (hasData && stamp) {
            const age = Date.now() - new Date(stamp).getTime();
            setIsStale(age > maxStaleMs);
        } else {
            setIsStale(hasData);
        }

        setIsLoading(false);
        setIsRefreshing(false);
    }, [cacheKey, enabled, fetcher, maxRetries, maxStaleMs]);

    useEffect(() => {
        if (!enabled) return undefined;

        const effectiveInterval = getEffectiveInterval(intervalMs);

        const kickoff = window.setTimeout(() => {
            load();
        }, 0);

        const interval = window.setInterval(() => {
            // Skip polling when the tab is hidden — saves bandwidth/battery on
            // phones backgrounded behind WhatsApp/LINE. On visibility return,
            // the visibilitychange handler below catches up.
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                return;
            }
            load();
        }, effectiveInterval);

        // Catch-up fetch when the tab becomes visible again after being hidden
        // for longer than the interval.
        const handleVisibility = () => {
            const stamp = lastUpdatedRef.current;
            if (document.visibilityState === 'visible' && stamp) {
                const age = Date.now() - new Date(stamp).getTime();
                if (age > effectiveInterval) {
                    load();
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // Subscribe to the global "refresh all" broadcast from the header button.
        const handleGlobalRefresh = () => {
            load({ manual: true });
        };
        window.addEventListener('gm:refresh-all', handleGlobalRefresh);

        return () => {
            window.clearTimeout(kickoff);
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('gm:refresh-all', handleGlobalRefresh);
        };
    }, [enabled, intervalMs, load]);

    return {
        data,
        lastUpdated,
        isLoading,
        isRefreshing,
        isStale,
        error,
        retryCount,
        refresh: () => load({ manual: true })
    };
};
