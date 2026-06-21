/**
 * Top-down plane & ship silhouettes for MapLibre symbol layers.
 * Loaded once per style via map.addImage — no DOM markers.
 */

const PLANE_CIVILIAN = '#facc15';
const PLANE_MILITARY = '#ef4444';

/** Nose-up top-down aircraft — narrow fuselage, wide swept wings. */
const planeSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <path fill="${fill}" stroke="rgba(255,255,255,0.65)" stroke-width="0.7" stroke-linejoin="round"
    d="M16 1
       L17.4 10.5 L27 13.5 L27 16 L18.5 14.5 L19 22
       L23.5 28.5 L23.5 30.5 L16 29 L8.5 30.5 L8.5 28.5 L13 22 L13.5 14.5
       L5 16 L5 13.5 L14.6 10.5 Z"/>
</svg>`;

/** Nose-up top-down hull — wide beam, flat stern, pointed bow. */
const shipSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <path fill="${fill}" stroke="rgba(255,255,255,0.6)" stroke-width="0.65" stroke-linejoin="round"
    d="M16 2
       L19.5 10 L20 17.5 L18 21 L14 21 L12 17.5 L12.5 10 Z
       M10 21 L7.5 24.5 L24.5 24.5 L22 21 Z"/>
</svg>`;

export const TRAFFIC_ICON_NAMES = {
    planeCivilian: 'plane-civilian',
    planeMilitary: 'plane-military',
    vesselCargo: 'vessel-cargo',
    vesselTanker: 'vessel-tanker',
    vesselPassenger: 'vessel-passenger',
    vesselFishing: 'vessel-fishing',
    vesselTug: 'vessel-tug',
    vesselPleasure: 'vessel-pleasure',
    vesselOther: 'vessel-other',
};

const VESSEL_COLORS = {
    [TRAFFIC_ICON_NAMES.vesselCargo]: '#22c55e',
    [TRAFFIC_ICON_NAMES.vesselTanker]: '#ef4444',
    [TRAFFIC_ICON_NAMES.vesselPassenger]: '#3b82f6',
    [TRAFFIC_ICON_NAMES.vesselFishing]: '#f59e0b',
    [TRAFFIC_ICON_NAMES.vesselTug]: '#ea580c',
    [TRAFFIC_ICON_NAMES.vesselPleasure]: '#a855f7',
    [TRAFFIC_ICON_NAMES.vesselOther]: '#94a3b8',
};

const ICON_SPECS = [
    [TRAFFIC_ICON_NAMES.planeCivilian, planeSvg(PLANE_CIVILIAN), 32, 32],
    [TRAFFIC_ICON_NAMES.planeMilitary, planeSvg(PLANE_MILITARY), 32, 32],
    ...Object.entries(VESSEL_COLORS).map(([name, color]) => [name, shipSvg(color), 32, 32]),
];

export const loadTrafficIcons = (map, onReady) => {
    let pending = ICON_SPECS.length;
    let loaded = 0;

    const markDone = () => {
        loaded += 1;
        if (loaded >= pending) {
            onReady?.(true);
            try { map.triggerRepaint(); } catch { /* ignore */ }
        }
    };

    for (const [name, svg, w, h] of ICON_SPECS) {
        try { if (map.hasImage(name)) map.removeImage(name); } catch { /* ignore */ }
        const img = new Image(w, h);
        img.onload = () => {
            try { map.addImage(name, img); } catch { /* already added */ }
            markDone();
        };
        img.onerror = markDone;
        img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    }
};

export const FLIGHT_ICON_IMAGE = [
    'case',
    ['==', ['get', 'military'], true],
    TRAFFIC_ICON_NAMES.planeMilitary,
    TRAFFIC_ICON_NAMES.planeCivilian,
];

export const VESSEL_ICON_IMAGE = [
    'match', ['get', 'category'],
    'cargo', TRAFFIC_ICON_NAMES.vesselCargo,
    'tanker', TRAFFIC_ICON_NAMES.vesselTanker,
    'passenger', TRAFFIC_ICON_NAMES.vesselPassenger,
    'fishing', TRAFFIC_ICON_NAMES.vesselFishing,
    'tug', TRAFFIC_ICON_NAMES.vesselTug,
    'pleasure', TRAFFIC_ICON_NAMES.vesselPleasure,
    TRAFFIC_ICON_NAMES.vesselOther,
];
