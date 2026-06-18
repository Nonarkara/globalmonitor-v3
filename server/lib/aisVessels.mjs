/**
 * AIS Vessel tracking via aisstream.io WebSocket.
 * Global AIS feed — all commercial vessels worldwide.
 * In-memory cache of vessel positions; prunes entries older than 30 minutes.
 *
 * Repo: https://github.com/aisstream/aisstream
 * Requires env: AISSTREAM_API_KEY (free at https://aisstream.io/authenticate)
 */
import { createRequire } from 'node:module';
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

/** AIS ship type (ITU-R M.1371) → VesselFinder-style category */
export function mapShipTypeCategory(shipType) {
    const t = Number(shipType) || 0;
    if (t >= 70 && t <= 79) return 'cargo';
    if (t >= 80 && t <= 89) return 'tanker';
    if (t >= 60 && t <= 69) return 'passenger';
    if (t === 37 || t === 36) return 'pleasure';
    if (t === 30 || t === 33 || t === 34) return 'fishing';
    if (t === 31 || t === 32 || t === 52 || t === 53) return 'tug';
    if (t >= 30 && t <= 39) return 'fishing';
    if (t >= 50 && t <= 59) return 'tug';
    return 'other';
}

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
    for (const [mmsi, v] of vessel_positions) {
        if (v.lon == null || v.lat == null) continue;
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
            }
        });
    }
    const hasKey = Boolean(process.env.AISSTREAM_API_KEY);
    return {
        type: 'FeatureCollection',
        features,
        meta: {
            count: features.length,
            fetchedAt: new Date().toISOString(),
            source: hasKey ? 'aisstream.io' : 'none',
            connected: ws_instance?.readyState === 1,
            coverage: 'global',
            requiresKey: !hasKey,
            keyHint: hasKey ? null : 'Set AISSTREAM_API_KEY (free at aisstream.io/authenticate) to enable live AIS'
        }
    };
}
