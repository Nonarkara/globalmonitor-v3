/**
 * AIS Vessel tracking via aisstream.io WebSocket.
 * Subscribes to key maritime chokepoints across all three theaters.
 * In-memory cache of vessel positions; prunes entries older than 30 minutes.
 *
 * Requires env: AISSTREAM_API_KEY
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

// Bounding boxes [SW_lon, SW_lat, NE_lon, NE_lat] for key straits across all theaters
const STRAIT_BOXES = [
    // Middle East
    [55.0, 25.5,  57.5, 27.5],  // Strait of Hormuz
    [42.5, 11.5,  44.0, 13.5],  // Bab-el-Mandeb
    [29.5, 29.5,  33.0, 32.0],  // Suez Canal

    // Indo-Pacific
    [100.0, 0.5, 104.5, 6.5],   // Strait of Malacca
    [118.5, 21.5, 122.5, 26.5], // Taiwan Strait
    [115.0, 0.0, 118.5, 5.5],   // Strait of Lombok / Makassar
    [124.0, 9.0, 127.5, 13.0],  // Luzon Strait (South China Sea north)
    [141.0, 32.0, 142.5, 35.5], // Tsugaru Strait (Japan)

    // Thailand region
    [ 99.5,  5.5, 104.5,  9.5], // Gulf of Thailand entry / Malacca north
    [100.2,  6.0, 101.0,  7.0], // Penang approaches
];

// vessel_positions: Map<mmsi, { lon, lat, heading, speed, name, shipType, updatedAt }>
const vessel_positions = new Map();
const STALE_MS = 30 * 60 * 1000; // prune after 30 min

let ws_instance = null;
let reconnect_timer = null;

const SUBSCRIBE_MSG = () => ({
    APIKey: process.env.AISSTREAM_API_KEY || '',
    BoundingBoxes: STRAIT_BOXES.map(([minLon, minLat, maxLon, maxLat]) => [
        [minLat, minLon],
        [maxLat, maxLon]
    ]),
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
});

function prune() {
    const cutoff = Date.now() - STALE_MS;
    for (const [mmsi, v] of vessel_positions) {
        if (v.updatedAt < cutoff) vessel_positions.delete(mmsi);
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
                vessel_positions.set(mmsi, {
                    lon: pr.Longitude ?? meta.longitude ?? null,
                    lat: pr.Latitude ?? meta.latitude ?? null,
                    heading: pr.TrueHeading !== 511 ? (pr.TrueHeading || 0) : (pr.Cog || 0),
                    speed: pr.Sog || 0,     // knots
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
        // reconnect after 15s
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
    // Prune stale entries every 5 minutes
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
                heading: v.heading,
                speed: v.speed,
                shipType: v.shipType,
                // ponytail: colour bucket by ship type for layer paint
                typeGroup: v.shipType >= 70 && v.shipType <= 79 ? 'cargo'
                    : v.shipType >= 80 && v.shipType <= 89 ? 'tanker'
                    : v.shipType === 0 ? 'unknown' : 'other',
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
            requiresKey: !hasKey,
            keyHint: hasKey ? null : 'Set AISSTREAM_API_KEY (free at aisstream.io/authenticate) to enable live AIS'
        }
    };
}
