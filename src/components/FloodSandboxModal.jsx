import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, FileText } from 'lucide-react';
import { fetchFloodOps, fetchFloodDirective } from '../services/flood';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * God's Mode — flood planning table for the mayor.
 *
 * Real terrain (Terrarium/SRTM elevation tiles, ~19 m/px at z13) + the live
 * HII gauge stage drive a CONNECTED bathtub inundation: water spreads from the
 * river cell-to-cell wherever ground sits below the simulated water surface.
 * First-order screening physics — honest about being stage-driven, not a
 * hydrodynamic model — but the terrain, the gauge, and the geography are real.
 */

const GRID = 3;            // 3×3 tiles
const TILE = 256;
const SIZE = GRID * TILE;  // 768 px frame
const ZOOM = 13;

/** Real critical sites (approximate coordinates, used for elevation sampling). */
const CITY_POIS = {
    ayutthaya: [
        { name: 'Ayutthaya Hospital', lat: 14.3459, lon: 100.5539 },
        { name: 'City Hall', lat: 14.3606, lon: 100.5533 },
        { name: 'Wat Phra Si Sanphet', lat: 14.3559, lon: 100.5586 },
        { name: 'Hua Ro Market', lat: 14.3652, lon: 100.5751 },
        { name: 'Railway Station', lat: 14.3453, lon: 100.5822 },
    ],
    chiangmai: [
        { name: 'Maharaj Hospital', lat: 18.7891, lon: 98.9744 },
        { name: 'Warorot Market', lat: 18.7906, lon: 99.0000 },
        { name: 'Municipality Office', lat: 18.7952, lon: 99.0015 },
        { name: 'Night Bazaar', lat: 18.7856, lon: 99.0005 },
        { name: 'Railway Station', lat: 18.7846, lon: 99.0166 },
    ],
};

const SCENARIOS = [
    { label: 'Monsoon pulse', delta: 0.5 },
    { label: 'Dam surge release', delta: 1.5 },
    { label: '2011-scale event', delta: 3.5 },
];

const lonToTileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const latToTileY = (lat, z) => {
    const rad = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};

/** Metres per pixel at this latitude/zoom (Web Mercator). */
const metersPerPixel = (lat, z) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** z);

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`tile failed: ${src}`));
    img.src = src;
});

/** Fetch the 3×3 terrarium frame and decode to an elevation grid (m MSL). */
const loadElevationGrid = async (anchor) => {
    const cx = Math.floor(lonToTileX(anchor.lon, ZOOM));
    const cy = Math.floor(latToTileY(anchor.lat, ZOOM));
    const x0 = cx - 1;
    const y0 = cy - 1;

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tiles = [];
    for (let dy = 0; dy < GRID; dy++) {
        for (let dx = 0; dx < GRID; dx++) {
            tiles.push(
                loadImage(`/api/terrain?z=${ZOOM}&x=${x0 + dx}&y=${y0 + dy}`)
                    .then((img) => ctx.drawImage(img, dx * TILE, dy * TILE)),
            );
        }
    }
    await Promise.all(tiles);

    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    const elev = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const o = i * 4;
        // Terrarium: elevation = (R*256 + G + B/256) − 32768
        elev[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
    }

    // Robust percentiles — SRTM carries noise pits (down to −30 m) and spikes,
    // so absolute min/max are useless as a datum. p1 ≈ noise floor, p5 ≈ river
    // channel bed, median ≈ inhabited ground.
    const sorted = Float32Array.from(elev).sort();
    const pct = (p) => sorted[Math.floor((p / 100) * (sorted.length - 1))];
    const percentiles = { p1: pct(1), p5: pct(5), p25: pct(25), median: pct(50) };

    // Frame georeference: pixel → lon/lat via tile origin.
    const toPixel = (lat, lon) => ({
        px: Math.round((lonToTileX(lon, ZOOM) - x0) * TILE),
        py: Math.round((latToTileY(lat, ZOOM) - y0) * TILE),
    });

    return { elev, toPixel, percentiles, mpp: metersPerPixel(anchor.lat, ZOOM) };
};

/**
 * Find a real river cell near the anchor: the channel sits around the 5th
 * elevation percentile, so we take the cell nearest the anchor whose elevation
 * falls in the channel band [p1, p5+0.5]. This avoids both inhabited ground
 * (too high) and SRTM noise pits (below p1), giving a stable flood seed.
 */
const findRiverSeed = (elev, cx, cy, pctl, radius = 90) => {
    const lo = pctl.p1;
    const hi = pctl.p5 + 0.5;
    let best = -1;
    let bestDist = Infinity;
    for (let y = Math.max(0, cy - radius); y < Math.min(SIZE, cy + radius); y++) {
        for (let x = Math.max(0, cx - radius); x < Math.min(SIZE, cx + radius); x++) {
            const i = y * SIZE + x;
            const e = elev[i];
            if (e < lo || e > hi) continue;
            const dist = (x - cx) ** 2 + (y - cy) ** 2;
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
    }
    return { idx: best, elev: best >= 0 ? elev[best] : pctl.p5 };
};

/**
 * Connected bathtub: 8-neighbour BFS seeded from EVERY channel-band cell (the
 * whole river network in-frame), spreading across contiguous ground at or below
 * the water surface. Multi-seed + diagonal spread matches how water actually
 * sheets across a flat delta — strict single-seed 4-connectivity gets walled
 * inside the 30 m SRTM channel and under-predicts floodplain inundation.
 * Isolated high basins with no path to the river still stay dry. A noise floor
 * (`minElev`) rejects SRTM pits so a −30 m artefact isn't treated as river.
 */
const floodFill = (elev, surface, channelHi, minElev) => {
    const flooded = new Uint8Array(SIZE * SIZE);
    const queue = new Int32Array(SIZE * SIZE);
    let head = 0;
    let tail = 0;
    let count = 0;
    // Seed: all real channel cells.
    for (let i = 0; i < SIZE * SIZE; i++) {
        const e = elev[i];
        if (e >= minElev && e <= channelHi) {
            flooded[i] = 1;
            queue[tail++] = i;
            count++;
        }
    }
    while (head < tail) {
        const i = queue[head++];
        const x = i % SIZE;
        const l = x > 0;
        const r = x < SIZE - 1;
        const neighbours = [
            l ? i - 1 : -1, r ? i + 1 : -1, i - SIZE, i + SIZE,
            l ? i - SIZE - 1 : -1, r ? i - SIZE + 1 : -1,
            l ? i + SIZE - 1 : -1, r ? i + SIZE + 1 : -1,
        ];
        for (const n of neighbours) {
            if (n < 0 || n >= SIZE * SIZE || flooded[n]) continue;
            const e = elev[n];
            if (e >= minElev && e <= surface) {
                flooded[n] = 1;
                queue[tail++] = n;
                count++;
            }
        }
    }
    return { flooded, count };
};

/** Grey hillshade + brick-red flood wash + POI markers, straight to canvas. */
const render = (canvas, grid, flooded, surface, pois, seedPx) => {
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const px = img.data;
    const { elev } = grid;

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const i = y * SIZE + x;
            const e = elev[i];
            // Hillshade: light from NW, slope-scaled — warm paper greys.
            const eR = elev[y * SIZE + Math.min(x + 1, SIZE - 1)];
            const eD = elev[Math.min(y + 1, SIZE - 1) * SIZE + x];
            const shade = Math.max(-14, Math.min(14, (e - eR) * 2.2 + (e - eD) * 2.2));
            const base = 224 + shade;
            let r = base;
            let g = base - 1;
            let b = base - 6;
            if (flooded[i]) {
                const depth = Math.min(1, Math.max(0.22, (surface - e) / 3.5));
                // Brick red #a23a26 wash, deeper water = more opaque.
                r = r * (1 - depth) + 162 * depth;
                g = g * (1 - depth) + 58 * depth;
                b = b * (1 - depth) + 38 * depth;
            }
            const o = i * 4;
            px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    // River seed marker
    ctx.fillStyle = '#191712';
    ctx.beginPath();
    ctx.arc(seedPx.px, seedPx.py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // POIs
    ctx.font = '700 13px "Helvetica Neue", Helvetica, sans-serif';
    for (const p of pois) {
        const wet = p.flooded;
        ctx.fillStyle = wet ? '#a23a26' : '#1f6e43';
        ctx.beginPath();
        ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#191712';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(p.name, p.px + 8, p.py + 4);
        ctx.fillText(p.name, p.px + 8, p.py + 4);
    }

    // Scale bar (2 km)
    const barPx = 2000 / grid.mpp;
    ctx.fillStyle = '#191712';
    ctx.fillRect(16, SIZE - 22, barPx, 3);
    ctx.font = '700 12px "Helvetica Neue", Helvetica, sans-serif';
    ctx.fillText('2 KM', 16, SIZE - 30);
};

const FloodSandboxModal = ({ isOpen, onClose, city = 'ayutthaya' }) => {
    useEscapeKey(isOpen, onClose);
    const canvasRef = useRef(null);
    const gridRef = useRef(null);
    const [ops, setOps] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [deltaM, setDeltaM] = useState(1.5);
    const [result, setResult] = useState(null);
    const [directive, setDirective] = useState(null);
    const [directiveBusy, setDirectiveBusy] = useState(false);

    const sessionKey = isOpen ? `open:${city}` : 'closed';
    const [seenKey, setSeenKey] = useState(sessionKey);
    if (sessionKey !== seenKey) {
        setSeenKey(sessionKey);
        if (isOpen) {
            setStatus('loading');
            setDirective(null);
        }
    }

    // Load live ops + terrain when opened.
    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const opsData = await fetchFloodOps(city);
                if (cancelled) return;
                setOps(opsData);
                gridRef.current = await loadElevationGrid(opsData.city.anchor);
                if (cancelled) return;
                setStatus('ready');
            } catch {
                if (!cancelled) setStatus('error');
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, city]);

    // Run the simulation whenever the stage changes.
    useEffect(() => {
        if (status !== 'ready' || !ops || !canvasRef.current || !gridRef.current) return;
        const grid = gridRef.current;
        const anchor = ops.city.anchor;

        const anchorPx = grid.toPixel(anchor.lat, anchor.lon);
        const { p1, p5, p25 } = grid.percentiles;
        const river = findRiverSeed(grid.elev, anchorPx.px, anchorPx.py, grid.percentiles);
        // Bankfull ≈ p25 (ground starts getting inundated). Stage 0 sits at
        // bankfull; +Δ raises the surface, so the slider reads as metres of
        // overbank flooding — datum-safe against SRTM/gauge offset. Channel
        // seed band is [p1, p5+0.5]; the noise floor rejects SRTM pits.
        const surface = p25 + deltaM;
        const channelHi = p5 + 0.5;
        const minElev = p1 - 1;
        const seed = { px: river.idx >= 0 ? river.idx % SIZE : anchorPx.px, py: river.idx >= 0 ? Math.floor(river.idx / SIZE) : anchorPx.py };
        const { flooded, count } = floodFill(grid.elev, surface, channelHi, minElev);

        const pois = (CITY_POIS[city] || []).map((p) => {
            const pt = grid.toPixel(p.lat, p.lon);
            const inFrame = pt.px >= 0 && pt.px < SIZE && pt.py >= 0 && pt.py < SIZE;
            const idx = inFrame ? pt.py * SIZE + pt.px : -1;
            const elevAt = idx >= 0 ? grid.elev[idx] : null;
            return {
                ...p,
                ...pt,
                elev: elevAt,
                flooded: idx >= 0 && flooded[idx] === 1,
                depth: idx >= 0 && flooded[idx] ? Math.max(0, surface - elevAt) : 0,
            };
        }).filter((p) => p.elev != null);

        render(canvasRef.current, grid, flooded, surface, pois, seed);

        const km2 = (count * grid.mpp * grid.mpp) / 1e6;
        setResult({
            surface: Math.round(surface * 100) / 100,
            floodedKm2: Math.round(km2 * 10) / 10,
            framePct: Math.round((count / (SIZE * SIZE)) * 1000) / 10,
            pois,
        });
    }, [status, ops, deltaM, city]);

    const handleDirective = useCallback(async () => {
        if (!result) return;
        setDirectiveBusy(true);
        try {
            const sim = {
                deltaM,
                floodedKm2: result.floodedKm2,
                floodedPois: result.pois.filter((p) => p.flooded).map((p) => p.name),
            };
            setDirective(await fetchFloodDirective(city, sim));
        } catch {
            setDirective({ directive: 'Directive service unreachable — see Water Inbound panel for the live picture.', engine: 'error' });
        } finally {
            setDirectiveBusy(false);
        }
    }, [city, deltaM, result]);

    const wetPois = useMemo(() => (result?.pois || []).filter((p) => p.flooded), [result]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(25,23,18,0.45)'
        }}>
            <div role="dialog" aria-modal="true" aria-label="Flood simulation planning mode" onClick={(e) => e.stopPropagation()} style={{
                width: '980px', maxWidth: '96vw', maxHeight: '92vh', overflow: 'auto',
                background: 'var(--panel)', border: '1px solid var(--line-2)', padding: '18px 20px'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ink)', paddingBottom: '8px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink)' }}>
                            Flood Simulation — God&apos;s Mode
                        </div>
                        <div style={{ fontSize: '0.5rem', color: 'var(--ink-3)', marginTop: '2px' }}>
                            {ops?.city?.label || city} · {ops?.city?.river} River · gauge {ops?.city?.gauge?.code} at {ops?.city?.gauge?.msl ?? '—'} m MSL ({ops?.city?.gauge?.pct ?? '—'}% bank)
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex' }}>
                        <X size={16} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Terrain canvas */}
                    <div style={{ flex: '1 1 480px', minWidth: '300px' }}>
                        <div style={{ position: 'relative', border: '1px solid var(--line-2)' }}>
                            <canvas
                                ref={canvasRef}
                                width={SIZE}
                                height={SIZE}
                                style={{ width: '100%', display: 'block', imageRendering: 'auto' }}
                            />
                            {status !== 'ready' && (
                                <div style={{
                                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'var(--paper)', fontSize: '0.55rem', color: 'var(--ink-2)',
                                    letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700
                                }}>
                                    {status === 'error' ? 'Terrain unavailable — retry later' : 'Loading terrain + live telemetry…'}
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: '0.42rem', color: 'var(--ink-3)', lineHeight: 1.5, marginTop: '6px' }}>
                            Connected-bathtub inundation on SRTM terrain (Terrarium tiles, ~19 m/px). Water spreads from the river
                            wherever ground sits below the simulated surface; isolated depressions stay dry. Stage change is applied
                            relative to the river&apos;s own SRTM surface (datum-safe). Stage-driven screening model — not hydrodynamic
                            routing. Sites are approximate locations.
                        </div>
                    </div>

                    {/* Controls + impact */}
                    <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
                        {/* Stage slider */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)' }}>
                                    River stage vs now
                                </span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: deltaM > 0 ? 'var(--red)' : 'var(--green)' }}>
                                    {deltaM >= 0 ? '+' : ''}{deltaM.toFixed(1)} m
                                </span>
                            </div>
                            <input
                                type="range" min="-1" max="5" step="0.1" value={deltaM}
                                onChange={(e) => setDeltaM(Number(e.target.value))}
                                aria-label="Simulated river stage change in metres"
                                style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                {SCENARIOS.map((s) => (
                                    <button key={s.label} type="button" onClick={() => setDeltaM(s.delta)} style={{
                                        flex: 1, fontSize: '0.4rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                        padding: '5px 4px', cursor: 'pointer', fontFamily: 'inherit',
                                        background: Math.abs(deltaM - s.delta) < 0.05 ? 'var(--ink)' : 'var(--paper)',
                                        color: Math.abs(deltaM - s.delta) < 0.05 ? '#fff' : 'var(--ink-2)',
                                        border: '1px solid var(--line-2)'
                                    }}>
                                        {s.label} +{s.delta}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Impact metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                            {[
                                { label: 'Surface m (SRTM)', value: result?.surface ?? '—' },
                                { label: 'Inundated km²', value: result?.floodedKm2 ?? '—', hot: (result?.floodedKm2 ?? 0) > 2 },
                                { label: 'Sites flooded', value: result ? `${wetPois.length}/${result.pois.length}` : '—', hot: wetPois.length > 0 },
                            ].map((k) => (
                                <div key={k.label} style={{ textAlign: 'center', padding: '6px 4px', background: '#f2f0ea' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: k.hot ? 'var(--red)' : 'var(--ink)' }}>
                                        {k.value}
                                    </div>
                                    <div style={{ fontSize: '0.34rem', color: 'var(--ink-3)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>{k.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Critical sites */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.44rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '4px' }}>
                                Critical sites
                            </div>
                            {(result?.pois || []).map((p) => (
                                <div key={p.name} style={{
                                    display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '3px 6px',
                                    borderBottom: '1px solid var(--line)', fontSize: '0.48rem',
                                    fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums'
                                }}>
                                    <span style={{ color: p.flooded ? 'var(--red)' : 'var(--ink)', fontWeight: p.flooded ? 700 : 400 }}>
                                        {p.name}
                                    </span>
                                    <span style={{ color: p.flooded ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                                        {p.flooded ? `${p.depth.toFixed(1)} m deep` : 'dry'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Directive */}
                        <button
                            type="button"
                            onClick={handleDirective}
                            disabled={directiveBusy || status !== 'ready'}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                                padding: '9px', cursor: directiveBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                                background: 'var(--green)', color: '#fff', border: 'none', opacity: directiveBusy ? 0.6 : 1
                            }}
                        >
                            {directiveBusy ? <Play size={11} /> : <FileText size={11} />}
                            {directiveBusy ? 'Drafting…' : 'Draft operational directive'}
                        </button>

                        {directive && (
                            <div style={{ marginTop: '10px', border: '1px solid var(--line-2)', padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.4rem', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Mayor&apos;s directive · {directive.engine}
                                </div>
                                <div style={{ fontSize: '0.55rem', color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                                    {directive.directive}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FloodSandboxModal;
