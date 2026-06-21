import { useEffect, useRef, useState } from 'react';

const lerp = (a, b, t) => a + (b - a) * t;

const lerpAngle = (from, to, t) => {
    const f = Number(from) || 0;
    const target = Number(to) || 0;
    let delta = ((target - f + 540) % 360) - 180;
    return (f + delta * t + 360) % 360;
};

const getFeatureId = (feature, idKey) => {
    const props = feature.properties || {};
    return props[idKey] || props.hex || props.mmsi || props.callsign || null;
};

const seedPositions = (geojson, idKey) => {
    const map = new Map();
    for (const feature of geojson?.features || []) {
        const id = getFeatureId(feature, idKey);
        if (!id) continue;
        const [lon, lat] = feature.geometry.coordinates;
        map.set(id, { lon, lat, heading: feature.properties?.heading ?? 0 });
    }
    return map;
};

/**
 * Smoothly lerps marker positions between polls without pushing a full GeoJSON
 * collection through React/MapLibre on every animation frame.
 *
 * Mutates coordinates and heading in place on a stable FeatureCollection wrapper
 * and only clones once when the incoming target changes shape.
 */
export const useInterpolatedTraffic = (geojson, {
    idKey = 'hex',
    durationMs = 60000,
    frameMs = 1000,
    enabled = true,
} = {}) => {
    const prevRef = useRef(new Map());
    const frameRef = useRef(null);
    const targetRef = useRef(geojson);
    const lastFrameAtRef = useRef(0);
    const [display, setDisplay] = useState(geojson);
    const displayRef = useRef(geojson);

    useEffect(() => {
        displayRef.current = display;
    }, [display]);

    useEffect(() => {
        targetRef.current = geojson;

        if (frameRef.current) cancelAnimationFrame(frameRef.current);

        if (!enabled) {
            displayRef.current = geojson;
            const raf = requestAnimationFrame(() => setDisplay(geojson));
            return () => cancelAnimationFrame(raf);
        }

        if (!geojson?.features?.length) {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            // Hold last frame — empty polls must not blank traffic on the map.
            return () => {
                if (frameRef.current) cancelAnimationFrame(frameRef.current);
            };
        } else if (displayRef.current?.features?.length) {
            // Resume from what the map is already showing so early refreshes do
            // not snap traffic back to an older poll before lerping forward.
            prevRef.current = seedPositions(displayRef.current, idKey);
        } else {
            prevRef.current = new Map();
        }

        const startTime = performance.now();
        lastFrameAtRef.current = 0;

        const tick = () => {
            const now = performance.now();
            const target = targetRef.current;
            if (!target?.features?.length) {
                return;
            }

            if (prevRef.current.size === 0) {
                prevRef.current = seedPositions(target, idKey);
                setDisplay(target);
                return;
            }

            const t = Math.min(1, (now - startTime) / durationMs);
            const prev = prevRef.current;
            const isFinalFrame = t >= 1;

            if (!isFinalFrame && now - lastFrameAtRef.current < frameMs) {
                frameRef.current = requestAnimationFrame(tick);
                return;
            }

            lastFrameAtRef.current = now;

            // Ensure we own a mutable features array before editing coordinates
            // in place. Clone once per target change, then mutate thereafter.
            if (
                !displayRef.current
                || displayRef.current === target
                || displayRef.current.features.length !== target.features.length
            ) {
                displayRef.current = {
                    type: 'FeatureCollection',
                    features: target.features.map((feature) => ({
                        ...feature,
                        properties: { ...feature.properties },
                    })),
                    meta: target.meta,
                };
            }

            const features = displayRef.current.features;
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                const targetFeature = target.features[i];
                const id = getFeatureId(targetFeature, idKey);
                const [newLon, newLat] = targetFeature.geometry.coordinates;
                const old = id ? prev.get(id) : null;

                if (!old) {
                    feature.geometry.coordinates = [newLon, newLat];
                    if (feature.properties) {
                        feature.properties.heading = targetFeature.properties?.heading ?? 0;
                    }
                    continue;
                }

                feature.geometry.coordinates = [
                    lerp(old.lon, newLon, t),
                    lerp(old.lat, newLat, t),
                ];
                if (feature.properties) {
                    feature.properties.heading = lerpAngle(
                        old.heading,
                        targetFeature.properties?.heading,
                        t
                    );
                }
            }

            setDisplay(displayRef.current);

            if (t < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                prevRef.current = seedPositions(target, idKey);
            }
        };

        frameRef.current = requestAnimationFrame(tick);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [geojson, idKey, durationMs, frameMs, enabled]);

    return display;
};
