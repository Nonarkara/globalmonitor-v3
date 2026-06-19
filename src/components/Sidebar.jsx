import React, { useEffect, useRef } from 'react';
import { Layers, Activity, CloudRain, Flame, AlertTriangle, Wind, Zap, Building2, Plane, Ship, Moon, Satellite, Map as MapIcon } from 'lucide-react';
import CopernicusPreviewPanel from './CopernicusPreviewPanel';
import SourceStack from './SourceStack';
import { EO_TILE_LAYERS } from '../services/eoTiles';
import { useFlightCount } from '../hooks/useFlightCount';
import { useVesselCount } from '../hooks/useVesselCount';

const Sidebar = ({
    activeLayers,
    toggleLayer,
    viewMode,
    copernicusMode,
    setCopernicusMode,
    copernicusRuntimeSource,
    showCopernicusOverlay,
    setShowCopernicusOverlay,
    showStrategicContext,
    setShowStrategicContext,
    copernicusResource,
    mapStyle,
    setMapStyle,
    dashboardVersion = 'v8.3',
}) => {
    const flightCount = useFlightCount();
    const vesselCount = useVesselCount();
    const contentRef = useRef(null);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [viewMode]);

    const basemapConfigs = [
        { id: 'dark', title: 'Dark', desc: 'Low-glare operations map', icon: <Moon size={16} /> },
        { id: 'satellite', title: 'Satellite', desc: 'Esri imagery + labels', icon: <Satellite size={16} /> },
        { id: 'voyager', title: 'Political', desc: 'Borders and place context', icon: <MapIcon size={16} /> },
    ];

    const layerGroups = [
        {
            title: 'Operational',
            layers: [
                { id: 'firms', title: 'Fire / Strikes', desc: 'NASA VIIRS thermal anomalies', icon: <Zap size={18} /> },
                { id: 'conflicts', title: 'Conflicts', desc: 'Hotspots & humanitarian risk', icon: <Flame size={18} /> },
                { id: 'infrastructure', title: 'Infrastructure', desc: 'Energy, ports, chokepoints', icon: <Building2 size={18} /> },
            ],
        },
        {
            title: 'Mobility',
            layers: [
                { id: 'flights', title: 'Flights', desc: 'ADS-B + aviationstack cache', icon: <Plane size={18} /> },
                { id: 'vessels', title: 'Ships', desc: 'AIS traffic + fleet fallback', icon: <Ship size={18} /> },
            ],
        },
        {
            title: 'Environment',
            layers: [
                { id: 'weather', title: 'Precipitation', desc: 'RainViewer radar tiles', icon: <CloudRain size={18} /> },
                { id: 'aqi', title: 'Air Quality', desc: 'PM2.5 & AQI', icon: <Wind size={18} /> },
                { id: 'disasters', title: 'Disasters', desc: 'Active events (NASA EONET)', icon: <AlertTriangle size={18} /> },
                { id: 'economy', title: 'Economy', desc: 'GDP baselines (World Bank)', icon: <Activity size={18} /> },
            ],
        },
    ];
    // Compact mono labels replace emoji on satellite layer chips — fits the tactical aesthetic
    // and avoids the duplicate-emoji confusion (🌊 for SST + Bathymetry, 🌧️ for Precip + Radar).
    const SAT_MONO_LABEL = {
        'eo-nightlights': 'NIGHT',
        'eo-sea-surface-temp': 'SST',
        'eo-fires': 'FIRES',
        'eo-precipitation': 'RAIN',
        'eo-snow-cover': 'SNOW',
        'eo-aerosol': 'AOD',
        'eo-sentinel2-cloudless': 'S2',
        'eo-surface-water': 'WATER',
        'eo-bathymetry': 'DEPTH',
        'eo-weather-radar': 'RADAR',
        'eo-wind': 'WIND'
    };
    const NASA_LAYER_IDS = new Set([
        'eo-nightlights', 'eo-sea-surface-temp', 'eo-fires',
        'eo-precipitation', 'eo-snow-cover', 'eo-aerosol'
    ]);
    const visibleEoLayers = EO_TILE_LAYERS.filter(
        (layer) => !['eo-true-color', 'eo-vegetation'].includes(layer.id)
    );
    const nasaLayers = visibleEoLayers.filter((l) => NASA_LAYER_IDS.has(l.id));
    const internationalLayers = visibleEoLayers.filter((l) => !NASA_LAYER_IDS.has(l.id));

    const renderEoLayer = (layer) => {
        const isActive = activeLayers.includes(layer.id);
        return (
            <button
                type="button"
                key={layer.id}
                className={`layer-card ${isActive ? 'active' : ''}`}
                onClick={() => toggleLayer(layer.id)}
                aria-pressed={isActive}
                style={{ padding: '10px 14px', gap: '10px' }}
            >
                <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    minWidth: '46px',
                    padding: '4px 6px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.7)',
                    borderRadius: '2px'
                }}>
                    {SAT_MONO_LABEL[layer.id] || layer.id.replace('eo-', '').slice(0, 5).toUpperCase()}
                </span>
                <span className="layer-info">
                    <span className="layer-title" style={{ fontSize: '0.85rem' }}>{layer.name}</span>
                    <span className="layer-desc" style={{ fontSize: '0.72rem' }}>{layer.description}</span>
                </span>
            </button>
        );
    };

    return (
        <aside className="grid-panel" style={{ flex: 1 }}>
            <div className="sidebar-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 300, letterSpacing: '0.3px', color: 'var(--text-main)' }}>Global Political Dashboard</span>
                    <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '1.2px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                        {viewMode === 'thailand' ? 'Thailand' : viewMode === 'indopacific' ? 'Southeast Asia' : 'Middle East'} · GlobeWatch {dashboardVersion}
                    </span>
                </div>
            </div>
            <div ref={contentRef} className="sidebar-content">
                <div>
                    <h3 className="section-title">Basemap</h3>
                    <div className="basemap-grid" role="radiogroup" aria-label="Map basemap">
                        {basemapConfigs.map((base) => {
                            const isActive = mapStyle === base.id;
                            return (
                                <button
                                    key={base.id}
                                    type="button"
                                    className={`basemap-option ${isActive ? 'active' : ''}`}
                                    onClick={() => setMapStyle(base.id)}
                                    role="radio"
                                    aria-checked={isActive}
                                >
                                    <span className="basemap-option-icon">{base.icon}</span>
                                    <span className="basemap-option-copy">
                                        <span className="layer-title">{base.title}</span>
                                        <span className="layer-desc">{base.desc}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <h3 className="section-title">Layers</h3>
                    <div className="layer-group-stack">
                        {layerGroups.map((group) => (
                            <div className="layer-group" key={group.title}>
                                <div className="layer-group-title">{group.title}</div>
                                <div className="layer-list">
                                    {group.layers.map((layer) => {
                                        const isActive = activeLayers.includes(layer.id);
                                        const layerDesc = layer.id === 'flights' && isActive
                                            ? `${flightCount > 0 ? flightCount.toLocaleString() : '...'} aircraft · ADS-B`
                                            : layer.id === 'vessels' && isActive
                                                ? `${vesselCount > 0 ? vesselCount.toLocaleString() : '...'} vessels · AIS`
                                                : layer.desc;
                                        return (
                                            <button
                                                key={layer.id}
                                                type="button"
                                                className={`layer-card ${isActive ? 'active' : ''}`}
                                                onClick={() => toggleLayer(layer.id)}
                                                aria-pressed={isActive}
                                            >
                                                <span className="layer-icon-wrapper">
                                                    {layer.icon}
                                                </span>
                                                <span className="layer-info">
                                                    <span className="layer-title">{layer.title}</span>
                                                    <span className="layer-desc">{layerDesc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="section-title">Map Framing</h3>
                    <button
                        type="button"
                        className={`layer-card ${showStrategicContext ? 'active' : ''}`}
                        onClick={() => setShowStrategicContext((value) => !value)}
                        aria-pressed={showStrategicContext}
                    >
                        <span className="layer-icon-wrapper">
                            <Layers size={20} />
                        </span>
                        <span className="layer-info">
                            <span className="layer-title">Strategic Context</span>
                            <span className="layer-desc">Optional reference corridors, zones, and city anchors</span>
                        </span>
                    </button>
                </div>

                <div>
                    <h3 className="section-title">Satellite Layers</h3>

                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        textTransform: 'uppercase',
                        margin: '8px 0 6px'
                    }}>
                        Sentinel · ESA Optical
                    </div>
                    <CopernicusPreviewPanel
                        viewMode={viewMode}
                        preset={copernicusMode}
                        onPresetChange={setCopernicusMode}
                        runtimeSource={copernicusRuntimeSource}
                        showOverlay={showCopernicusOverlay}
                        onToggleOverlay={() => setShowCopernicusOverlay((value) => !value)}
                        previewResource={copernicusResource}
                    />

                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        textTransform: 'uppercase',
                        margin: '14px 0 6px'
                    }}>
                        NASA · GIBS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {nasaLayers.map(renderEoLayer)}
                    </div>

                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.6rem',
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        textTransform: 'uppercase',
                        margin: '14px 0 6px'
                    }}>
                        International
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {internationalLayers.map(renderEoLayer)}
                    </div>
                </div>

                <div>
                    <h3 className="section-title">Source Agencies</h3>
                    <SourceStack />
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '8px', opacity: 0.8 }}>
                        Data from NASA, ESA, JAXA, World Bank, ReliefWeb, Open-Meteo, and Binance.
                    </p>
                    <p style={{ opacity: 0.9 }}>
                        <strong>Contact Dr. Non Arkara:</strong><br />
                        Email: <a href="mailto:non.ar@depa.or.th" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>non.ar@depa.or.th</a><br />
                        LinkedIn: <a href="https://www.linkedin.com/in/drnon/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>linkedin.com/in/drnon/</a>
                    </p>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
