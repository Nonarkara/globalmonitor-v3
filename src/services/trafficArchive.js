const DAY = 24 * 60 * 60 * 1000;

export function trafficArchive(kind, meta, now) {
    const snapshot = kind === 'aircraft'
        ? /snapshot/i.test(meta?.source ?? '')
        : meta?.aisSource === 'static-snapshot' || (!meta?.aisSource && meta?.staticSnapshot === true);
    if (!snapshot) return null;
    const at = kind === 'aircraft' ? meta.collectedAt : meta.staticSnapshotAt;
    const time = typeof at === 'string' ? Date.parse(at) : NaN;
    // The caller's clock updates once per minute, not on every map frame.
    if (!Number.isFinite(time) || time > now + 60_000) return { hidden: true, label: 'Snapshot date unknown · not shown' };
    const date = new Date(time).toISOString().slice(0, 10);
    return now - time >= DAY
        ? { hidden: true, label: `Archived snapshot · ${date} · not shown` }
        : { hidden: false, label: `Snapshot · ${date}` };
}
