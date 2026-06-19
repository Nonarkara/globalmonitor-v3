/**
 * AIS Vessel tracking via aisstream.io WebSocket + VesselFinder fleet overlay.
 * Global AIS feed — all commercial vessels worldwide (aisstream).
 * VesselFinder vesselslist supplements user's tracked fleet (when vessels added).
 *
 * Repo: https://github.com/aisstream/aisstream
 * Requires env: AISSTREAM_API_KEY (free at https://aisstream.io/authenticate)
 * Optional: VESSELFINDER_FLEET_KEY, VESSELFINDER_API_KEY (https://api.vesselfinder.com/docs/)
 */
import { createRequire } from 'node:module';
import { mapShipTypeCategory } from './shipTypes.mjs';
import { getFleetFeatures, getVesselFinderConfig, startVesselFinderRefresh } from './vesselFinder.mjs';

export { startVesselFinderRefresh, mapShipTypeCategory };
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

// Global bbox + regional supplements for dense chokepoints [minLon, minLat, maxLon, maxLat]
const VESSEL_BOXES = [
    [-180, -90, 180, 90],       // worldwide
    [55.0, 25.5, 57.5, 27.5],   // Strait of Hormuz
    [42.5, 11.5, 44.0, 13.5],   // Bab-el-Mandeb
    [100.0, 0.5, 104.5, 6.5],   // Strait of Malacca
    [118.5, 21.5, 122.5, 26.5], // Taiwan Strait
];

// vessel_positions: Map<mmsi, { lon, lat, heading, course, speed, name, shipType, updatedAt }>
const vessel_positions = new Map();
const STALE_MS = 30 * 60 * 1000;
const MAX_VESSELS = 8000;

let ws_instance = null;
let reconnect_timer = null;

const SUBSCRIBE_MSG = () => ({
    APIkey: process.env.AISSTREAM_API_KEY || '',
    BoundingBoxes: VESSEL_BOXES.map(([minLon, minLat, maxLon, maxLat]) => [
        [minLon, minLat],
        [maxLon, maxLat]
    ]),
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
});

function prune() {
    const cutoff = Date.now() - STALE_MS;
    for (const [mmsi, v] of vessel_positions) {
        if (v.updatedAt < cutoff) vessel_positions.delete(mmsi);
    }
    if (vessel_positions.size > MAX_VESSELS) {
        const sorted = [...vessel_positions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        const excess = vessel_positions.size - MAX_VESSELS;
        for (let i = 0; i < excess; i++) vessel_positions.delete(sorted[i][0]);
    }
}

// Regional bounding boxes for theater-scoped vessel feeds [minLon, minLat, maxLon, maxLat]
const THEATER_BBOXES = {
    thailand: [97, 5, 106, 21],
    indopacific: [90, -10, 135, 25],
    middleeast: [24, 10, 65, 42],
};

export function getVesselsGeoJsonForTheater(theater) {
    const base = getVesselsGeoJson();
    const bbox = THEATER_BBOXES[theater];
    if (!bbox || theater === 'global') return base;

    const [minLon, minLat, maxLon, maxLat] = bbox;
    const filtered = base.features.filter((feature) => {
        const coords = feature.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        const [lon, lat] = coords;
        return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });

    return {
        ...base,
        features: filtered,
        meta: {
            ...base.meta,
            count: filtered.length,
            coverage: theater,
        },
    };
}

function connect() {
    if (!process.env.AISSTREAM_API_KEY) return;

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
    ws_instance = ws;

    ws.on('open', () => {
        ws.send(JSON.stringify(SUBSCRIBE_MSG()));
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            const mmsi = String(msg.MetaData?.MMSI || '');
            if (!mmsi) return;

            if (msg.MessageType === 'PositionReport') {
                const pr = msg.Message?.PositionReport || {};
                const meta = msg.MetaData || {};
                const course = pr.Cog ?? 0;
                const heading = pr.TrueHeading !== 511 && pr.TrueHeading != null
                    ? pr.TrueHeading
                    : course;
                vessel_positions.set(mmsi, {
                    lon: pr.Longitude ?? meta.longitude ?? null,
                    lat: pr.Latitude ?? meta.latitude ?? null,
                    heading,
                    course,
                    speed: pr.Sog || 0,
                    name: meta.ShipName?.trim() || mmsi,
                    shipType: vessel_positions.get(mmsi)?.shipType || 0,
                    updatedAt: Date.now(),
                });
            } else if (msg.MessageType === 'ShipStaticData') {
                const sd = msg.Message?.ShipStaticData || {};
                const existing = vessel_positions.get(mmsi) || {};
                vessel_positions.set(mmsi, {
                    ...existing,
                    name: sd.Name?.trim() || existing.name || mmsi,
                    shipType: sd.Type || existing.shipType || 0,
                    updatedAt: existing.updatedAt || Date.now(),
                });
            }
        } catch { /* malformed message — ignore */ }
    });

    ws.on('close', () => {
        ws_instance = null;
        reconnect_timer = setTimeout(connect, 15000);
    });

    ws.on('error', () => {
        ws.terminate();
    });
}

export function startAisStream() {
    if (!process.env.AISSTREAM_API_KEY) {
        console.warn('[aisVessels] No AISSTREAM_API_KEY — vessel layer disabled');
        return;
    }
    connect();
    setInterval(prune, 5 * 60 * 1000);
}

export function getVesselsGeoJson() {
    prune();
    const features = [];
    const seen = new Set();

    // VesselFinder fleet overlay first (user-tracked vessels)
    const fleet = getFleetFeatures();
    for (const f of fleet) {
        const mmsi = f.properties?.mmsi;
        if (!mmsi) continue;
        seen.add(mmsi);
        features.push(f);
    }

    for (const [mmsi, v] of vessel_positions) {
        if (v.lon == null || v.lat == null) continue;
        if (seen.has(mmsi)) continue; // fleet entry wins
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
            properties: {
                mmsi,
                name: v.name,
                heading: v.heading ?? 0,
                course: v.course ?? v.heading ?? 0,
                speed: v.speed,
                shipType: v.shipType,
                category: mapShipTypeCategory(v.shipType),
                source: 'aisstream.io',
            }
        });
    }

    const hasAisKey = Boolean(process.env.AISSTREAM_API_KEY);
    const vfConfig = getVesselFinderConfig();
    const sources = [];
    if (hasAisKey) sources.push('aisstream.io');
    if (vfConfig.fleetKey) sources.push('vesselfinder-fleet');

    const fleetEmpty = vfConfig.fleetKey && fleet.length === 0;

    return {
        type: 'FeatureCollection',
        features,
        meta: {
            count: features.length,
            fetchedAt: new Date().toISOString(),
            source: sources.length ? sources.join('+') : 'none',
            sources,
            connected: ws_instance?.readyState === 1,
            coverage: hasAisKey ? 'global' : (vfConfig.fleetKey ? 'fleet-only' : 'none'),
            requiresKey: !hasAisKey && !vfConfig.fleetKey,
            vesselfinder: {
                fleetKey: vfConfig.fleetKey,
                apiKey: vfConfig.apiKey,
                fleetCount: fleet.length,
                fleetEmpty,
                fleetHint: fleetEmpty
                    ? 'Add vessels to your VesselFinder fleet (up to 10 on free plan) for tracked overlay'
                    : null,
                livedataNote: 'Worldwide area queries (LiveData) require paid VesselFinder subscription — global map uses aisstream.io',
            },
            keyHint: (hasAisKey || vfConfig.fleetKey) ? null
                : 'Set AISSTREAM_API_KEY (aisstream.io) and/or VESSELFINDER_FLEET_KEY (vesselfinder.com)',
        }
    };
}
