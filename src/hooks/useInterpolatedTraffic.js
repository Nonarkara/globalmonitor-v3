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
 * Smoothly lerps marker positions between 60s polls so traffic reads as continuous motion.
 */
export const useInterpolatedTraffic = (geojson, { idKey = 'hex', durationMs = 60000 } = {}) => {
    const prevRef = useRef(new Map());
    const frameRef = useRef(null);
    const targetRef = useRef(geojson);
    const [display, setDisplay] = useState(geojson);

    useEffect(() => {
        targetRef.current = geojson;
        if (!geojson?.features?.length) {
            setDisplay(geojson);
            return undefined;
        }

        if (prevRef.current.size === 0) {
            prevRef.current = seedPositions(geojson, idKey);
            setDisplay(geojson);
            return undefined;
        }

        const startTime = performance.now();

        const tick = () => {
            const target = targetRef.current;
            if (!target?.features?.length) return;

            const t = Math.min(1, (performance.now() - startTime) / durationMs);
            const prev = prevRef.current;

            const features = target.features.map((feature) => {
                const id = getFeatureId(feature, idKey);
                const [newLon, newLat] = feature.geometry.coordinates;
                const old = id ? prev.get(id) : null;
                if (!old) return feature;

                return {
                    ...feature,
                    geometry: {
                        type: 'Point',
                        coordinates: [lerp(old.lon, newLon, t), lerp(old.lat, newLat, t)]
                    },
                    properties: {
                        ...feature.properties,
                        heading: lerpAngle(old.heading, feature.properties?.heading, t)
                    }
                };
            });

            setDisplay({ type: 'FeatureCollection', features, meta: target.meta });

            if (t < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                prevRef.current = seedPositions(target, idKey);
            }
        };

        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(tick);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [geojson, idKey, durationMs]);

    return display;
};
