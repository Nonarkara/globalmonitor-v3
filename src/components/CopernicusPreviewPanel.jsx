import React from 'react';
import { Eye, EyeOff, RefreshCw, Satellite } from 'lucide-react';

const MODES = [
    { id: 'true-color', label: 'Optical' },
    { id: 'ndvi', label: 'Vegetation' },
    { id: 'moisture', label: 'Moisture' },
    { id: 'urban-heat', label: 'Urban Heat' },
    { id: 'burn-severity', label: 'Burn' },
    { id: 'water-bodies', label: 'Water' }
];

const formatDate = (value) => {
    if (!value) return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';

    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
    });
};

const getStatusLabel = ({ runtimeSource, preview, isStale, error }) => {
    if (runtimeSource === 'public') return 'PUBLIC';
    if (isStale) return 'STALE';
    if (preview?.available) return 'LIVE';
    if (error) return 'OFFLINE';
    return 'SYNC';
};

/** Build a NASA GIBS static snapshot URL for the sidebar preview */
const buildGibsSnapshotUrl = (viewMode, preset) => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const layer = preset === 'ndvi'
        ? 'MODIS_Terra_NDVI_8Day'
        : 'VIIRS_SNPP_CorrectedReflectance_TrueColor';

    // GIBS WMTS snapshot API — returns a single tile image
    // Use a zoom/row/col that frames the theater
    const tiles = viewMode === 'depa'
        ? { z: 5, y: 13, x: 25 }  // Bangkok area
        : { z: 4, y: 5, x: 10 };  // Strait of Hormuz area

    const format = preset === 'ndvi' ? 'png' : 'jpg';
    const dateStr = preset === 'ndvi'
        ? new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
        : yesterday;

    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${dateStr}/GoogleMapsCompatible_Level9/${tiles.z}/${tiles.y}/${tiles.x}.${format}`;
};

const NasaGibsPreview = ({ viewMode, preset }) => {
    const src = buildGibsSnapshotUrl(viewMode, preset);
    const label = `${viewMode === 'depa' ? 'Bangkok' : 'Strait of Hormuz'} ${preset === 'ndvi' ? 'Vegetation' : 'True Color'}`;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0e1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
                src={src}
                alt={`NASA GIBS ${label} preview`}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.85,
                    borderRadius: '6px',
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                background: 'rgba(0,0,0,0.65)',
                color: '#94a3b8',
                fontSize: '0.6rem',
                padding: '2px 6px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
            }}>
                NASA GIBS · {label}
            </div>
        </div>
    );
};

const CopernicusPreviewPanel = ({
    viewMode,
    preset,
    onPresetChange,
    runtimeSource,
    showOverlay,
    onToggleOverlay,
    previewResource
}) => {
    const {
        data: preview,
        lastUpdated,
        isLoading,
        isRefreshing,
        isStale,
        error,
        refresh
    } = previewResource;

    const statusLabel = getStatusLabel({ runtimeSource, preview, isStale, error });
    const canOverlay = runtimeSource === 'public' || Boolean(preview?.available && preview?.imageDataUrl);
    const modeLabel = MODES.find((item) => item.id === preset)?.label || 'Optical';
    const theaterLabel = preview?.theaterLabel || (viewMode === 'depa' ? 'Bangkok Metro' : 'Strait of Hormuz');
    const sourceLabel = runtimeSource === 'public' ? 'NASA GIBS' : 'sentinel-2-l2a';
    const statusClassName = statusLabel === 'PUBLIC'
        ? 'live-pill live-pill-public'
        : `live-pill ${statusLabel !== 'LIVE' ? 'live-pill-muted' : ''}`;

    return (
        <div className="eo-preview-card">
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Satellite size={14} /> SENTINEL INSIGHT
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={refresh}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                        title="Refresh Sentinel preview"
                        aria-label="Refresh Sentinel preview"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                    </button>
                    <span className={statusClassName}>{statusLabel}</span>
                </div>
            </div>

            <div className="panel-content eo-preview-content">
                <div className="eo-preview-toolbar">
                    <div className="eo-preview-toggle-row">
                        {MODES.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`eo-preview-toggle ${preset === item.id ? 'active' : ''}`}
                                onClick={() => onPresetChange(item.id)}
                                aria-pressed={preset === item.id}
                                aria-label={`Switch Sentinel preview to ${item.label}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={`eo-overlay-toggle ${showOverlay && canOverlay ? 'active' : ''}`}
                        onClick={onToggleOverlay}
                        disabled={!canOverlay}
                        aria-label={showOverlay && canOverlay ? 'Turn map overlay off' : 'Turn map overlay on'}
                        aria-pressed={showOverlay && canOverlay}
                        title={canOverlay ? 'Toggle map overlay' : 'Overlay becomes available after a live image is loaded'}
                    >
                        {showOverlay && canOverlay ? <Eye size={12} /> : <EyeOff size={12} />}
                        {showOverlay && canOverlay ? 'Overlay On' : 'Overlay Off'}
                    </button>
                </div>

                <div className="eo-preview-frame">
                    {runtimeSource === 'copernicus' && preview?.available && preview?.imageDataUrl ? (
                        <img
                            src={preview.imageDataUrl}
                            alt={`${preview.theaterLabel} ${preview.presetLabel} preview`}
                            className="eo-preview-image"
                        />
                    ) : runtimeSource === 'public' ? (
                        <NasaGibsPreview viewMode={viewMode} preset={preset} />
                    ) : (
                        <div className="eo-preview-empty">
                            <strong>{isLoading ? 'Pulling latest Sentinel scene' : error ? 'Sentinel preview unavailable' : 'Waiting for imagery'}</strong>
                            <span>{isLoading ? 'Looking for the most recent cloud-filtered image.' : error ? 'The feed will retry automatically.' : 'This panel will show the latest Sentinel-2 scene.'}</span>
                        </div>
                    )}
                </div>

                <div className="eo-chip-row">
                    <span className="eo-chip">{theaterLabel}</span>
                    <span className="eo-chip">{preview?.presetLabel || modeLabel}</span>
                    <span className="eo-chip">{sourceLabel}</span>
                    {preview?.sceneId && (
                        <span className="eo-chip" title={`Scene: ${preview.sceneId}`}>
                            {preview.sceneId.slice(0, 12)}...
                        </span>
                    )}
                    {preview?.cloudCover != null && (
                        <span className="eo-chip">{preview.cloudCover}% cloud</span>
                    )}
                    {preview?.acquisitionAge && (
                        <span className="eo-chip">Captured {preview.acquisitionAge}</span>
                    )}
                </div>

                <div className="eo-insight-card">
                    <span className="eo-insight-kicker">What You Learn</span>
                    <p>{preview?.insight || 'Switch between optical and vegetation modes to read change, cover, and land-water contrast in the active theater.'}</p>
                </div>

                <div className="eo-preview-caption">
                    {runtimeSource === 'copernicus' ? (
                        <>
                            <strong>
                                {preview?.timeRange
                                    ? `${formatDate(preview.timeRange.from)} - ${formatDate(preview.timeRange.to)}`
                                    : 'Recent search window'}
                            </strong>
                            <span>
                                {preview?.available
                                    ? ` Most recent scene in the last ${preview.lookbackDays} days with max ${preview.maxCloudCoverage}% cloud cover.`
                                    : ' Scenes depend on acquisition timing and cloud conditions.'}
                            </span>
                        </>
                    ) : (
                        <>
                            <strong>{showOverlay ? 'Public layer active on map.' : 'NASA GIBS satellite preview.'}</strong>
                            <span> Free public imagery from NASA. Upgrades to live Sentinel-2 when Copernicus credentials are added.</span>
                        </>
                    )}
                </div>

                {runtimeSource === 'copernicus' && preview?.available && lastUpdated && (
                    <div className="eo-preview-note">
                        Last sync {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CopernicusPreviewPanel;
