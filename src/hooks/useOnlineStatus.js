import { useCallback, useEffect, useRef, useState } from 'react';

const HEALTH_PATH = '/api/health';
const PING_INTERVAL = 60000; // 1 minute
const PING_TIMEOUT = 8000;

export const useOnlineStatus = () => {
    const [backendUp, setBackendUp] = useState(true);
    const [lastPing, setLastPing] = useState(null);
    const controllerRef = useRef(null);

    const ping = useCallback(async () => {
        try {
            controllerRef.current?.abort();
            controllerRef.current = new AbortController();

            const res = await fetch(HEALTH_PATH, {
                signal: controllerRef.current.signal,
                cache: 'no-store'
            });

            // Backend returns JSON; if we get HTML back, it's a static site (backend not running)
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');

            const up = res.ok && isJson;
            setBackendUp((prev) => (prev === up ? prev : up));
            setLastPing(new Date().toISOString());
        } catch {
            setBackendUp(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(ping, 0);
        const interval = setInterval(ping, PING_INTERVAL);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
            controllerRef.current?.abort();
        };
    }, [ping]);

    return { backendUp, lastPing, ping };
};
