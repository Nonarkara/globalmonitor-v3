/**
 * Top-down plane & ship silhouettes for MapLibre symbol layers.
 * Loaded once per style via map.addImage — no DOM markers.
 */

const PLANE_CIVILIAN = '#58a6ff';
const PLANE_MILITARY = '#f59e0b';

/** Nose-up top-down aircraft silhouette (heading 0 = north). */
const planeSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <path fill="${fill}" stroke="rgba(255,255,255,0.55)" stroke-width="0.45" stroke-linejoin="round"
    d="M16 1.5
       L17.2 9.5 L24.5 12.5 L24.5 14.2 L18.2 13.2 L18.5 19.5
       L22.5 25.5 L22.5 27.5 L16 26.2 L9.5 27.5 L9.5 25.5 L13.5 19.5 L13.8 13.2
       L7.5 14.2 L7.5 12.5 L14.8 9.5 Z"/>
</svg>`;

/** Nose-up top-down hull silhouette (bow at top). */
const shipSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="${fill}" stroke="rgba(255,255,255,0.5)" stroke-width="0.4" stroke-linejoin="round"
    d="M12 1.2
       L14.2 7.8 L14.2 15.5 L12.8 18.2 L11.2 18.2 L9.8 15.5 L9.8 7.8 Z
       M11.2 18.2 L8.5 19.8 L8.5 21.2 L15.5 21.2 L15.5 19.8 L12.8 18.2 Z"/>
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
    ...Object.entries(VESSEL_COLORS).map(([name, color]) => [name, shipSvg(color), 24, 24]),
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
        img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
