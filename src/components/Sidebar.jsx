import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Layers, Activity, CloudRain, Flame, AlertTriangle, Wind, Zap, Building2,
    Plane, Ship, Moon, Satellite, Map as MapIcon, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import CopernicusPreviewPanel from './CopernicusPreviewPanel';
import SourceStack from './SourceStack';
import { EO_TILE_LAYERS } from '../services/eoTiles';
import { useFlightCount } from '../hooks/useFlightCount';
import { useVesselCount } from '../hooks/useVesselCount';

const BASEMAP_CONFIGS = [
    { id: 'dark', title: 'Dark', desc: 'Low-glare operations map', icon: <Moon size={16} /> },
    { id: 'satellite', title: 'Satellite', desc: 'Esri imagery with place labels', icon: <Satellite size={16} /> },
    { id: 'voyager', title: 'Political', desc: 'Borders and place context', icon: <MapIcon size={16} /> },
];

const CORE_LAYERS = {
    firms: {
        title: 'Heat signatures (FIRMS)',
        desc: 'Thermal hotspots — fires, strikes, explosions',
        icon: <Zap size={18} />,
        group: 'operational',
    },
    conflicts: {
        title: 'Conflict events (ACLED)',
        desc: 'Reported clashes, violence, strategic developments',
        icon: <Flame size={18} />,
        group: 'operational',
    },
    infrastructure: {
        title: 'Energy & ports',
        desc: 'Critical sites, chokepoints, infrastructure status',
        icon: <Building2 size={18} />,
        group: 'operational',
    },
    flights: {
        title: 'Aircraft (ADS-B)',
        desc: 'Live aircraft positions and heading vectors',
        icon: <Plane size={18} />,
        group: 'mobility',
    },
    vessels: {
        title: 'Ships (AIS)',
        desc: 'Live vessel positions and maritime traffic',
        icon: <Ship size={18} />,
        group: 'mobility',
    },
    weather: {
        title: 'Precipitation / rain radar',
        desc: 'Live RainViewer radar and precipitation overlay',
        icon: <CloudRain size={18} />,
        group: 'environment',
    },
    aqi: {
        title: 'Air quality',
        desc: 'PM2.5 and AQI surface readings',
        icon: <Wind size={18} />,
        group: 'environment',
    },
    disasters: {
        title: 'Natural disasters',
        desc: 'Active NASA EONET events and alerts',
        icon: <AlertTriangle size={18} />,
        group: 'environment',
    },
    economy: {
        title: 'Economic baseline',
        desc: 'World Bank macro indicators by country',
        icon: <Activity size={18} />,
        group: 'environment',
    },
};

const EO_LAYER_META = {
    'eo-aerosol': { group: 'environment', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-precipitation': { group: 'environment', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-jaxa-soil-moisture': { group: 'environment', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-weather-radar': { group: 'environment', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-fires': { group: 'satellite', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-nightlights': { group: 'satellite', regions: ['middleeast', 'indopacific', 'thailand'] },
    'eo-sea-surface-temp': { group: 'satellite', regions: ['middleeast', 'indopacific'] },
    'eo-snow-cover': { group: 'satellite', regions: ['middleeast'] },
    'eo-sentinel2-cloudless': { group: 'satellite', regions: ['indopacific', 'thailand'] },
    'eo-surface-water': { group: 'satellite', regions: ['indopacific', 'thailand'] },
    'eo-bathymetry': { group: 'satellite', regions: ['indopacific'] },
    'eo-wind': { group: 'satellite', regions: ['middleeast', 'indopacific', 'thailand'] },
};

const REGION_CORE_IDS = {
    middleeast: ['firms', 'conflicts', 'infrastructure', 'flights', 'vessels', 'weather', 'aqi', 'disasters', 'economy'],
    indopacific: ['firms', 'conflicts', 'flights', 'vessels', 'weather', 'aqi', 'disasters'],
    thailand: ['firms', 'conflicts', 'flights', 'vessels', 'weather', 'aqi', 'disasters'],
    global: ['firms', 'conflicts', 'flights', 'vessels', 'weather', 'aqi', 'disasters', 'economy'],
};

const GROUP_ORDER = [
    { key: 'operational', label: 'Operational' },
    { key: 'mobility', label: 'Mobility' },
    { key: 'environment', label: 'Environment' },
    { key: 'satellite', label: 'Satellite' },
];

const REGION_LABEL = {
    middleeast: 'Middle East',
    indopacific: 'Indo-Pacific',
    thailand: 'Thailand',
    global: 'Global',
};

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
    onResetCoreLayers,
}) => {
    const flightCount = useFlightCount();
    const vesselCount = useVesselCount();
    const contentRef = useRef(null);
    const [sourceAgenciesOpen, setSourceAgenciesOpen] = useState(false);

    useEffect(() => {
        if (contentRef.current) contentRef.current.scrollTop = 0;
    }, [viewMode]);

    const groupedLayers = useMemo(() => {
        const groups = Object.fromEntries(GROUP_ORDER.map((g) => [g.key, []]));
        const region = viewMode || 'middleeast';
        const coreIds = REGION_CORE_IDS[region] || REGION_CORE_IDS.middleeast;

        coreIds.forEach((id) => {
            const layer = CORE_LAYERS[id];
            if (layer) groups[layer.group].push({ id, ...layer, kind: 'core' });
        });

        EO_TILE_LAYERS.forEach((eo) => {
            const meta = EO_LAYER_META[eo.id];
            if (!meta || !meta.regions.includes(region)) return;
            if (['eo-true-color', 'eo-vegetation'].includes(eo.id)) return;
            groups[meta.group].push({
                id: eo.id,
                title: eo.id === 'eo-jaxa-soil-moisture' ? 'Drought / soil moisture' : eo.name,
                desc: eo.description,
                icon: <Satellite size={18} />,
                kind: 'eo',
            });
        });

        return groups;
    }, [viewMode]);

    const renderLayerDesc = (layer) => {
        if (layer.id === 'flights' && activeLayers.includes('flights')) {
            return `${flightCount > 0 ? flightCount.toLocaleString() : '…'} aircraft tracked · ADS-B`;
        }
        if (layer.id === 'vessels' && activeLayers.includes('vessels')) {
            return `${vesselCount > 0 ? vesselCount.toLocaleString() : '…'} vessels tracked · AIS`;
        }
        return layer.desc;
    };

    const renderLayerButton = (layer) => {
        const isActive = activeLayers.includes(layer.id);
        return (
            <button
                key={layer.id}
                type="button"
                className={`layer-card ${isActive ? 'active' : ''}`}
                onClick={() => toggleLayer(layer.id)}
                aria-pressed={isActive}
                aria-label={`${isActive ? 'Hide' : 'Show'} ${layer.title}`}
            >
                <span className="layer-icon-wrapper">{layer.icon}</span>
                <span className="layer-info">
                    <span className="layer-title">{layer.title}</span>
                    <span className="layer-desc">{renderLayerDesc(layer)}</span>
                </span>
                {isActive && (
                    <span className="layer-card-check" aria-hidden="true">
                        <Check size={14} />
                    </span>
                )}
            </button>
        );
    };

    return (
        <aside className="grid-panel sidebar-panel" style={{ flex: 1 }}>
            <div className="sidebar-header">
                <div className="sidebar-brand-lockup">
                    <span className="sidebar-brand-title">Global Political Dashboard</span>
                    <span className="sidebar-brand-subtitle">
                        {REGION_LABEL[viewMode] || 'Middle East'} · GlobeWatch {dashboardVersion}
                    </span>
                </div>
            </div>

            <div ref={contentRef} className="sidebar-content">
                {/* BASEMAP */}
                <section className="sidebar-section">
                    <h3 className="section-title">Basemap</h3>
                    <div className="basemap-grid" role="radiogroup" aria-label="Map basemap">
                        {BASEMAP_CONFIGS.map((base) => {
                            const isActive = mapStyle === base.id;
                            return (
                                <button
                                    key={base.id}
                                    type="button"
                                    className={`basemap-option ${isActive ? 'active' : ''}`}
                                    onClick={() => setMapStyle(base.id)}
                                    role="radio"
                                    aria-checked={isActive}
                                    aria-label={`Use ${base.title} basemap`}
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
                </section>

                {/* LAYER GROUPS */}
                <section className="sidebar-section">
                    <div className="section-title-row">
                        <h3 className="section-title">Layers</h3>
                        <span>{activeLayers.length} active</span>
                    </div>
                    <div className="layer-toolbar" aria-label="Layer quick actions">
                        <button type="button" onClick={onResetCoreLayers} className="sidebar-mini-action">
                            Reset defaults
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleLayer('flights')}
                            className={`sidebar-mini-action ${activeLayers.includes('flights') ? 'active' : ''}`}
                            aria-pressed={activeLayers.includes('flights')}
                        >
                            Flights
                        </button>
                        <button
                            type="button"
                            onClick={() => toggleLayer('vessels')}
                            className={`sidebar-mini-action ${activeLayers.includes('vessels') ? 'active' : ''}`}
                            aria-pressed={activeLayers.includes('vessels')}
                        >
                            Ships
                        </button>
                    </div>

                    <div className="layer-group-stack">
                        {GROUP_ORDER.map(({ key, label }) => {
                            const layers = groupedLayers[key];
                            if (!layers?.length) return null;
                            return (
                                <div className="layer-group" key={key}>
                                    <div className="layer-group-title">{label}</div>
                                    <div className="layer-list">
                                        {layers.map(renderLayerButton)}
                                    </div>
                                    {key === 'satellite' && (
                                        <div className="satellite-copernicus-block">
                                            <div className="layer-group-title satellite-source-title">Sentinel · ESA</div>
                                            <CopernicusPreviewPanel
                                                viewMode={viewMode}
                                                preset={copernicusMode}
                                                onPresetChange={setCopernicusMode}
                                                runtimeSource={copernicusRuntimeSource}
                                                showOverlay={showCopernicusOverlay}
                                                onToggleOverlay={() => setShowCopernicusOverlay((v) => !v)}
                                                previewResource={copernicusResource}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* MAP FRAMING */}
                <section className="sidebar-section">
                    <h3 className="section-title">Map Framing</h3>
                    <button
                        type="button"
                        className={`layer-card ${showStrategicContext ? 'active' : ''}`}
                        onClick={() => setShowStrategicContext((v) => !v)}
                        aria-pressed={showStrategicContext}
                        aria-label={`${showStrategicContext ? 'Hide' : 'Show'} strategic context layer`}
                    >
                        <span className="layer-icon-wrapper"><Layers size={20} /></span>
                        <span className="layer-info">
                            <span className="layer-title">Strategic Context</span>
                            <span className="layer-desc">Reference corridors, zones, and city anchors</span>
                        </span>
                    </button>
                </section>

                {/* SOURCE AGENCIES */}
                <div className="sidebar-disclosure">
                    <button
                        type="button"
                        className="sidebar-disclosure-toggle"
                        onClick={() => setSourceAgenciesOpen((v) => !v)}
                        aria-expanded={sourceAgenciesOpen}
                    >
                        <span>Source Agencies</span>
                        <span className="sidebar-disclosure-chevron" aria-hidden="true">
                            {sourceAgenciesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    </button>
                    {sourceAgenciesOpen && <SourceStack />}
                </div>

                <div className="sidebar-provenance">
                    Data from NASA, ESA, JAXA, World Bank, ReliefWeb, Open-Meteo, and Binance.
                    <a href="mailto:non.ar@depa.or.th">Contact</a>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
