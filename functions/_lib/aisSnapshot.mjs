import { mapShipTypeCategory } from '../../server/lib/shipTypes.mjs';

const AIS_STREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const SNAPSHOT_MS = 6000;
const MAX_VESSELS = 6000;

const VESSEL_BOXES = [
    [[-180, -90], [180, 90]],
    [[55.0, 25.5], [57.5, 27.5]],
    [[42.5, 11.5], [44.0, 13.5]],
    [[100.0, 0.5], [104.5, 6.5]],
    [[118.5, 21.5], [122.5, 26.5]],
];

const toFeature = (mmsi, v) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
    properties: {
        mmsi,
        name: v.name,
        heading: v.heading ?? 0,
        course: v.course ?? v.heading ?? 0,
        speed: v.speed ?? 0,
        shipType: v.shipType ?? 0,
        category: mapShipTypeCategory(v.shipType),
        source: 'aisstream.io',
    },
});

/**
 * One-shot AIS snapshot for Cloudflare Workers — connect, collect, disconnect.
 * Long-lived WebSocket feeds belong on Node; Pages uses this per-request pattern.
 */
export async function fetchAisSnapshot(apiKey, { timeoutMs = SNAPSHOT_MS, maxVessels = MAX_VESSELS } = {}) {
    if (!apiKey) return [];

    return new Promise((resolve) => {
        const positions = new Map();
        let settled = false;
        let ws;

        const finish = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { ws?.close(); } catch { /* ignore */ }
            resolve([...positions.entries()].map(([mmsi, v]) => toFeature(mmsi, v)));
        };

        const timer = setTimeout(finish, timeoutMs);

        try {
            ws = new WebSocket(AIS_STREAM_URL);

            ws.addEventListener('open', () => {
                ws.send(JSON.stringify({
                    APIkey: apiKey,
                    BoundingBoxes: VESSEL_BOXES,
                    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
                }));
            });

            ws.addEventListener('message', (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    const mmsi = String(msg.MetaData?.MMSI || '');
                    if (!mmsi) return;

                    if (msg.MessageType === 'PositionReport') {
                        const pr = msg.Message?.PositionReport || {};
                        const meta = msg.MetaData || {};
                        const course = pr.Cog ?? 0;
                        const heading = pr.TrueHeading !== 511 && pr.TrueHeading != null
                            ? pr.TrueHeading
                            : course;
                        const existing = positions.get(mmsi) || {};
                        positions.set(mmsi, {
                            ...existing,
                            lon: pr.Longitude ?? meta.longitude ?? null,
                            lat: pr.Latitude ?? meta.latitude ?? null,
                            heading,
                            course,
                            speed: pr.Sog || 0,
                            name: existing.name || meta.ShipName?.trim() || mmsi,
                            shipType: existing.shipType || 0,
                        });
                    } else if (msg.MessageType === 'ShipStaticData') {
                        const sd = msg.Message?.ShipStaticData || {};
                        const existing = positions.get(mmsi) || {};
                        positions.set(mmsi, {
                            ...existing,
                            name: sd.Name?.trim() || existing.name || mmsi,
                            shipType: sd.Type || existing.shipType || 0,
                        });
                    }
                } catch { /* malformed */ }

                if (positions.size >= maxVessels) finish();
            });

            ws.addEventListener('error', finish);
            ws.addEventListener('close', finish);
        } catch {
            finish();
        }
    });
}
