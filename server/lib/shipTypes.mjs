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
