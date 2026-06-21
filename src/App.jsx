import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import RegionSelector from './components/RegionSelector';
import WorldClock from './components/WorldClock';
import LiveIntelligenceFeed from './components/LiveIntelligenceFeed';
import SettingsModal from './components/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary';
import { getDefaultSourceIdsForRegion } from './services/liveNews';
import { REGIONS, getRegion } from './data/regions';
import { fetchCopernicusPreview } from './services/copernicus';
import { useLiveResource } from './hooks/useLiveResource';
import { Settings, RefreshCw, Network, Database, FileText, Printer, Info, Menu, ChevronDown } from 'lucide-react';

import EscalationGauge from './components/EscalationGauge';
import AlertBanner from './components/AlertBanner';
import ClassificationBanner from './components/ClassificationBanner';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import ActorNetworkModal from './components/ActorNetworkModal';
import SourceHealthModal from './components/SourceHealthModal';
import ActivityLogModal from './components/ActivityLogModal';
import { LazyMapContainer, LazyPanel } from './components/LazyPanels';
import { logActivity, LOG_TYPES } from './services/activityLog';
import { useEscapeKey } from './hooks/useEscapeKey';
import './styles/print.css';

const DASHBOARD_VERSION = 'v8.3';

function App() {
  // ponytail: aerosol drowns the live traffic at 0.55 opacity — keep it a toggle, not a default. Re-add 'eo-aerosol' to restore aerosol-on-load.
  const [activeLayers, setActiveLayers] = useState(['conflicts', 'firms', 'flights', 'vessels']);
  const [activeRegion, setActiveRegion] = useState('middleeast');
  const [mapStyle, setMapStyle] = useState('dark');
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Three-way region nav: 'middleeast' | 'indopacific' | 'thailand'
  const [viewMode, setViewMode] = useState('middleeast');
  // Selected country (Indo-Pacific) or province (Thailand) — drives CountryNewsPanel
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isSourceHealthOpen, setIsSourceHealthOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  useEscapeKey(isAboutOpen, () => setIsAboutOpen(false));
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
    };
    if (toolsOpen) document.addEventListener('pointerdown', onDocClick);
    return () => document.removeEventListener('pointerdown', onDocClick);
  }, [toolsOpen]);
  const [activeSources, setActiveSources] = useState(getDefaultSourceIdsForRegion('middleeast'));
  const [copernicusMode, setCopernicusMode] = useState('true-color');
  const [showCopernicusOverlay, setShowCopernicusOverlay] = useState(true);
  const [showStrategicContext, setShowStrategicContext] = useState(false);

  const { backendUp } = useOnlineStatus();

  // Global refresh — broadcasts to every useLiveResource consumer in one shot.
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const handleRefreshAll = useCallback(() => {
    setIsRefreshingAll(true);
    window.dispatchEvent(new CustomEvent('gm:refresh-all'));
    logActivity(LOG_TYPES.USER_ACTION, 'Global refresh triggered');
    // Visual feedback window — actual refreshes complete asynchronously.
    setTimeout(() => setIsRefreshingAll(false), 1500);
  }, []);

  const [viewTarget, setViewTarget] = useState({
    longitude: 53,
    latitude: 30,
    zoom: 4.5,
    pitch: 25,
    bearing: -8
  });

  const [timeMachineDate, setTimeMachineDate] = useState(null);

  const toggleLayer = (layerId) => {
    setActiveLayers(prev =>
      prev.includes(layerId)
        ? prev.filter(id => id !== layerId)
        : [...prev, layerId]
    );
  };

  const resetCoreLayers = useCallback(() => {
    setActiveLayers(['conflicts', 'firms', 'flights', 'vessels']);
    logActivity(LOG_TYPES.USER_ACTION, 'Core operational map layers restored');
  }, []);

  const handleRegionSelect = useCallback((regionId, targetViewState) => {
    setActiveRegion(regionId);
    if (viewMode === 'indopacific' && regionId !== 'asean') {
      setSelectedCountryCode(regionId);
    }
    if (viewMode === 'thailand' && regionId !== 'thailand') {
      setSelectedCountryCode(regionId);
    }
    setViewTarget(prev => ({
      ...prev,
      ...targetViewState,
      transitionDuration: 1500,
    }));
  }, [viewMode]);

  const handleMapFlyTo = useCallback((target) => {
    setViewTarget(prev => ({
      ...prev,
      ...target,
      transitionDuration: target.transitionDuration || 1500,
    }));
  }, []);

  const toggleSource = (sourceId) => {
    setActiveSources(prev =>
      prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId]
    );
  };

  const setAllSources = (enable) => {
    setActiveSources(enable ? getDefaultSourceIdsForRegion(viewMode) : []);
  };

  const sourceSetKey = activeSources.join(',');
  const copernicusFetcher = useCallback(
    () => fetchCopernicusPreview(viewMode, copernicusMode),
    [viewMode, copernicusMode]
  );
  const copernicusResource = useLiveResource(copernicusFetcher, {
    cacheKey: `copernicus:${viewMode}:${copernicusMode}`,
    intervalMs: 30 * 60 * 1000,
    isUsable: (payload) => Boolean(payload && typeof payload === 'object')
  });
  const copernicusRuntimeSource = copernicusResource.data?.source === 'copernicus' && copernicusResource.data?.available
    ? 'copernicus'
    : 'public';

  return (
    <>
      {/* Alert Banner — fixed position at top */}
      {viewMode === 'middleeast' && (
        <ErrorBoundary inline label="Alert Banner">
          <AlertBanner />
        </ErrorBoundary>
      )}

      <div className="app-container" id="main-content" role="main">
        {/* Full-screen map underneath */}
        <ErrorBoundary label="Map">
          <Suspense fallback={<div className="map-loading" /> }>
            <LazyMapContainer
              viewTarget={viewTarget}
              activeLayers={activeLayers}
              onMarkerClick={setSelectedEvent}
              copernicusPreview={copernicusResource.data}
              copernicusMode={copernicusMode}
              copernicusRuntimeSource={copernicusRuntimeSource}
              showCopernicusOverlay={showCopernicusOverlay}
              showStrategicContext={showStrategicContext}
              mapStyle={mapStyle}
              timeMachineDate={timeMachineDate}
              viewMode={viewMode}
              onRegionDotClick={(props) => {
                const code = props?.countryCode || props?.regionCode;
                if (code) setSelectedCountryCode(code);
                if (typeof props?.latitude === 'number' && typeof props?.longitude === 'number') {
                  setViewTarget((prev) => ({
                    ...prev,
                    longitude: props.longitude,
                    latitude: props.latitude,
                    zoom: Math.max(prev.zoom, viewMode === 'thailand' ? 6.5 : 4.5),
                    transitionDuration: 800,
                  }));
                }
              }}
            />
          </Suspense>
        </ErrorBoundary>

        {/* Row 1: World Clock */}
        <ErrorBoundary inline label="World Clock">
          <WorldClock viewMode={viewMode} />
        </ErrorBoundary>

        {/* Row 2: Header bar — 3-section layout: logos | center title | controls */}
        <div className="header-bar grid-panel">
          {/* Left: Sponsor logos in white pill */}
          <div className="header-brand-strip" aria-label="Project partners">
            <img src={`${import.meta.env.BASE_URL}pmua-logo.webp`} alt="PMUA" className="header-brand-logo header-brand-logo-pmua" />
            <img src={`${import.meta.env.BASE_URL}Logo depa-01.png`} alt="depa" className="header-brand-logo header-brand-logo-depa" />
            <img src={`${import.meta.env.BASE_URL}axiom-logo.png`} alt="Axiom" className="header-brand-logo header-brand-logo-axiom" />
            <img src={`${import.meta.env.BASE_URL}retl-logo.svg`} alt="ReTL" className="header-brand-logo header-brand-logo-retl" />
          </div>

          {/* Center: Title + Escalation */}
          <div className="header-status">
            <div className="header-title-lockup">
              <span className="header-title">
                Global Political Dashboard
              </span>
              <span className="header-subtitle">
                {getRegion(viewMode).label}
              </span>
            </div>
            <ErrorBoundary inline label="Escalation">
              <EscalationGauge />
            </ErrorBoundary>
          </div>
          {/* Right: Controls */}
          <div className="header-controls">
            {viewMode === 'middleeast' && (
              <button
                onClick={() => setIsNetworkOpen(true)}
                aria-label="Open actor and faction network analysis"
                className="header-button header-button-actors"
              >
                <Network size={11} aria-hidden="true" /> Actors
              </button>
            )}
            <div
              className="header-region-tabs"
              role="tablist"
              aria-label="Theater region selector"
            >
              {Object.values(REGIONS).map((r) => {
                const isActive = viewMode === r.id;
                return (
                  <button
                    key={r.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Switch dashboard to ${r.label}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => {
                      setViewMode(r.id);
                      setActiveRegion(
                        r.id === 'middleeast' ? 'middleeast'
                          : r.id === 'indopacific' ? 'asean'
                            : r.id === 'thailand' ? 'thailand'
                              : 'global'
                      );
                      setViewTarget({ ...r.viewState, transitionDuration: 1200 });
                      setActiveSources(getDefaultSourceIdsForRegion(r.id));
                      setSelectedCountryCode(null);
                    }}
                    className={`header-region-tab ${isActive ? 'is-active' : ''}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Tools dropdown — collapses secondary operator actions to reduce header noise */}
            <div className="header-tools-dropdown" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={toolsOpen}
                aria-label="Tools and advanced options"
                className={`header-icon-button header-tools-trigger ${!backendUp ? 'has-warning' : ''}`}
              >
                <Menu size={13} aria-hidden="true" />
                <span className="header-icon-label">Tools</span>
                <ChevronDown size={10} aria-hidden="true" className={`header-tools-chevron ${toolsOpen ? 'open' : ''}`} />
              </button>
              {toolsOpen && (
                <div className="header-tools-menu" role="menu">
                  <button role="menuitem" onClick={() => { setToolsOpen(false); setIsSourceHealthOpen(true); }}>
                    <Database size={12} aria-hidden="true" /> Data health
                  </button>
                  <button role="menuitem" onClick={() => { setToolsOpen(false); setIsActivityLogOpen(true); }}>
                    <FileText size={12} aria-hidden="true" /> Session log
                  </button>
                  <button role="menuitem" onClick={() => { setToolsOpen(false); setIsSettingsOpen(true); }}>
                    <Settings size={12} aria-hidden="true" /> News sources
                  </button>
                  <button role="menuitem" onClick={() => { setToolsOpen(false); logActivity(LOG_TYPES.USER_ACTION, 'Print briefing initiated'); window.print(); }}>
                    <Printer size={12} aria-hidden="true" /> Print briefing
                  </button>
                  <button role="menuitem" onClick={() => { setToolsOpen(false); setIsAboutOpen(true); }}>
                    <Info size={12} aria-hidden="true" /> About
                  </button>
                  <button role="menuitem" onClick={() => { setToolsOpen(false); handleRefreshAll(); }} disabled={isRefreshingAll}>
                    <RefreshCw size={12} aria-hidden="true" className={isRefreshingAll ? 'spin-anim' : ''} /> Refresh data
                    {!backendUp && <span className="header-tools-warning-dot" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Multi-Front Status Board */}
        {viewMode === 'middleeast' && (
          <div className="multi-front-row">
            <ErrorBoundary inline label="Multi-Front Board">
              <LazyPanel name="MultiFrontBoard" />
            </ErrorBoundary>
          </div>
        )}

        {/* Row 3-5: Left sidebar — spans down to bottom bar */}
        <div className="left-sidebar">
          <ErrorBoundary inline label="Sidebar">
            <Sidebar
              activeLayers={activeLayers}
              toggleLayer={toggleLayer}
              viewMode={viewMode}
              copernicusMode={copernicusMode}
              setCopernicusMode={setCopernicusMode}
              copernicusRuntimeSource={copernicusRuntimeSource}
              showCopernicusOverlay={showCopernicusOverlay}
              setShowCopernicusOverlay={setShowCopernicusOverlay}
              showStrategicContext={showStrategicContext}
              setShowStrategicContext={setShowStrategicContext}
              copernicusResource={copernicusResource}
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
              dashboardVersion={DASHBOARD_VERSION}
              onResetCoreLayers={resetCoreLayers}
            />
          </ErrorBoundary>
          {viewMode === 'middleeast' && (
            <ErrorBoundary inline label="Flight Radar">
              <LazyPanel
                name="FlightRadarEmbed"
                flightsActive={activeLayers.includes('flights')}
                onToggleFlights={() => toggleLayer('flights')}
              />
            </ErrorBoundary>
          )}
          {/* Live TV is always present so switching regions just swaps channels
              instead of unmounting the iframe — keeps panel stable across nav. */}
          <ErrorBoundary inline label="Live TV">
            <LazyPanel name="LiveTVPanel" viewMode={viewMode} />
          </ErrorBoundary>
        </div>

        {/* Row 3: Right sidebar */}
        <div className="right-sidebar">
          {selectedEvent && (
            <LazyPanel
              name="EventDetailsPanel"
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
          {viewMode === 'middleeast' && (
            <>
              <ErrorBoundary inline label="Iran War Theater">
                <LazyPanel name="IranWarPanel" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Impact">
                <LazyPanel name="HumanitarianPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <LazyPanel name="AcledAnalytics" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Key Figures">
                <LazyPanel name="KeyFiguresPanel" />
              </ErrorBoundary>
              <ErrorBoundary inline label="International Response">
                <LazyPanel name="InternationalResponsePanel" />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <LazyPanel name="RefugeePanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Arms & Defense">
                <LazyPanel name="ArmsDefensePanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Gulf Security">
                <LazyPanel name="IntelligencePanel" panelKey={`gulfSecurity:${sourceSetKey}`} briefingId="gulfSecurity" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Energy & Oil Impact">
                <LazyPanel name="IntelligencePanel" panelKey={`energyMarkets:${sourceSetKey}`} briefingId="energyMarkets" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Regional Headlines">
                <LazyPanel name="RegionalNewsPanel" regionName="Middle East" title="Regional Headlines" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'indopacific' && (
            <>
              <ErrorBoundary inline label="ASEAN Country News">
                <LazyPanel name="CountryNewsPanel" mode="indopacific"
                  selectedCode={selectedCountryCode}
                  onSelect={setSelectedCountryCode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="South China Sea">
                <LazyPanel name="IntelligencePanel" panelKey={`southChinaSea:${sourceSetKey}`} briefingId="southChinaSea" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Geopolitics">
                <LazyPanel name="IntelligencePanel" panelKey={`aseanDiplomacy:${sourceSetKey}`} briefingId="aseanDiplomacy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Myanmar Conflict">
                <LazyPanel name="IntelligencePanel" panelKey={`myanmarConflict:${sourceSetKey}`} briefingId="myanmarConflict" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Crisis">
                <LazyPanel name="HumanitarianPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <LazyPanel name="RefugeePanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <LazyPanel name="AcledAnalytics" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Arms & Defense">
                <LazyPanel name="ArmsDefensePanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'thailand' && (
            <>
              <ErrorBoundary inline label="Thailand Region News">
                <LazyPanel name="CountryNewsPanel" mode="thailand"
                  selectedCode={selectedCountryCode}
                  onSelect={setSelectedCountryCode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thailand Security">
                <LazyPanel name="IntelligencePanel" panelKey={`thaiSecurity:${sourceSetKey}`} briefingId="thaiSecurity" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Myanmar Border Crisis">
                <LazyPanel name="IntelligencePanel" panelKey={`myanmarConflict:${sourceSetKey}`} briefingId="myanmarConflict" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Crisis">
                <LazyPanel name="HumanitarianPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <LazyPanel name="RefugeePanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <LazyPanel name="AcledAnalytics" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thai Tech Ecosystem">
                <LazyPanel name="RegionalNewsPanel" regionName="Thailand" title="Thailand Tech Ecosystem" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="depa Directives">
                <LazyPanel name="RegionalNewsPanel" regionName="DEPA" title="depa & MDES Directives" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'global' && (
            <>
              <ErrorBoundary inline label="Global Macro">
                <LazyPanel name="RegionalNewsPanel" regionName="Global" title="Global Macro & Policy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Impact">
                <LazyPanel name="HumanitarianPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <LazyPanel name="AcledAnalytics" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <LazyPanel name="RefugeePanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Maritime Warnings">
                <LazyPanel name="MaritimeWarningsPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Arms & Defense">
                <LazyPanel name="ArmsDefensePanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
        </div>
        <div className="bottom-bar">
          <ErrorBoundary inline label="Market Radar">
            <LazyPanel name="MarketRadarPanel" viewMode={viewMode} />
          </ErrorBoundary>
          {viewMode === 'middleeast' && (
            <>
              {/* Row 1: Economics & Markets */}
              <ErrorBoundary inline label="Oil Price Chart">
                <LazyPanel name="OilPriceChart" />
              </ErrorBoundary>
              <ErrorBoundary inline label="ME Oil Dependence">
                <LazyPanel name="MiddleEastOilDependency" />
              </ErrorBoundary>
              <ErrorBoundary inline label="War Cost">
                <LazyPanel name="WarCostTracker" />
              </ErrorBoundary>
              <ErrorBoundary inline label="Sanctions Tracker">
                <LazyPanel name="SanctionsPanel" />
              </ErrorBoundary>
              <ErrorBoundary inline label="Hormuz Crisis">
                <LazyPanel name="HormuzTracker" />
              </ErrorBoundary>
              {/* Row 2: Military & Intelligence */}
              <ErrorBoundary inline label="Nuclear Program">
                <LazyPanel name="NuclearTrackerPanel" onFlyTo={handleMapFlyTo} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Diplomacy & Sanctions">
                <LazyPanel name="IntelligencePanel" panelKey={`iranDiplomacy:${sourceSetKey}`} briefingId="iranDiplomacy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Proxy Theater">
                <LazyPanel name="IntelligencePanel" panelKey={`proxyTheater:${sourceSetKey}`} briefingId="proxyTheater" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <LazyPanel name="SentimentChart" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <LazyPanel name="SeismicPanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'indopacific' && (
            <>
              <ErrorBoundary inline label="South China Sea Watch">
                <LazyPanel name="RegionalNewsPanel" regionName="SouthChinaSea" title="South China Sea Watch" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Taiwan Strait">
                <LazyPanel name="RegionalNewsPanel" regionName="Taiwan" title="Taiwan Strait" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Diplomacy">
                <LazyPanel name="RegionalNewsPanel" regionName="ASEAN" title="ASEAN Diplomacy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Global Tech News">
                <LazyPanel name="RegionalNewsPanel" regionName="SEA" title="Indo-Pacific Tech" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Global Macro">
                <LazyPanel name="RegionalNewsPanel" regionName="Global" title="Global Macro & Policy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Maritime Warnings">
                <LazyPanel name="MaritimeWarningsPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <LazyPanel name="SentimentChart" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <LazyPanel name="SeismicPanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'thailand' && (
            <>
              <ErrorBoundary inline label="Myanmar Border Crisis">
                <LazyPanel name="RegionalNewsPanel" regionName="Myanmar" title="Myanmar Border Crisis" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Watch">
                <LazyPanel name="RegionalNewsPanel" regionName="ASEAN" title="ASEAN Watch" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thailand Tech">
                <LazyPanel name="RegionalNewsPanel" regionName="Thailand" title="Thailand Tech Ecosystem" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="depa Directives">
                <LazyPanel name="RegionalNewsPanel" regionName="DEPA" title="depa & MDES" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <LazyPanel name="SentimentChart" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <LazyPanel name="SeismicPanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'global' && (
            <>
              <ErrorBoundary inline label="Global Macro">
                <LazyPanel name="RegionalNewsPanel" regionName="Global" title="Global Macro & Policy" activeSourceIds={activeSources} viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Maritime Warnings">
                <LazyPanel name="MaritimeWarningsPanel" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <LazyPanel name="SentimentChart" viewMode={viewMode} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <LazyPanel name="SeismicPanel" viewMode={viewMode} />
              </ErrorBoundary>
            </>
          )}
        </div>
        <ErrorBoundary inline label="Live Feed">
          <LiveIntelligenceFeed key={`ticker:${viewMode}:${sourceSetKey}`} activeSourceIds={activeSources} viewMode={viewMode} />
        </ErrorBoundary>

        {/* Time Machine — date slider for historical data */}
        {viewMode === 'middleeast' && (
          <ErrorBoundary inline label="Time Machine">
            <LazyPanel name="TimeMachine" onDateChange={setTimeMachineDate} />
          </ErrorBoundary>
        )}

        {/* Floating: Region selector */}
        <RegionSelector
          activeRegion={activeRegion}
          onSelectRegion={handleRegionSelect}
          viewMode={viewMode}
        />

        {/* Modal: Settings */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          activeSources={activeSources}
          toggleSource={toggleSource}
          setAllSources={setAllSources}
        />

        {/* Modal: Actor Network */}
        <ActorNetworkModal
          isOpen={isNetworkOpen}
          onClose={() => setIsNetworkOpen(false)}
        />

        {/* Modal: Source Health */}
        <SourceHealthModal
          isOpen={isSourceHealthOpen}
          onClose={() => setIsSourceHealthOpen(false)}
        />

        {/* Modal: Activity Log */}
        <ActivityLogModal
          isOpen={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
        />

        {/* Modal: About */}
        {isAboutOpen && (
          <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(25, 23, 18, 0.55)', backdropFilter: 'none',
            pointerEvents: 'auto'
          }} onClick={() => setIsAboutOpen(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="about-dashboard-title" style={{
              width: '560px', maxWidth: '92vw', maxHeight: '85vh',
              background: 'var(--panel)', backdropFilter: 'none',
              borderRadius: '0', border: '1px solid var(--line-2)',
              overflow: 'auto', padding: '28px 32px', color: 'var(--ink)'
            }} onClick={e => e.stopPropagation()}>
              {/* Primary funder */}
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', letterSpacing: '0.16em', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>FUNDED BY</div>
                <img src={`${import.meta.env.BASE_URL}pmua-logo.webp`} alt="PMUA" style={{ height: '36px', objectFit: 'contain', background: '#fff', borderRadius: '5px', padding: '3px 8px' }} />
                <div style={{ fontSize: '10px', color: 'var(--ink-2)', marginTop: '4px' }}>Program Management Unit for Area Based Development</div>
              </div>

              {/* Supporting organizations */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px', padding: '10px', background: '#fff', borderRadius: '5px' }}>
                <img src={`${import.meta.env.BASE_URL}Logo depa-01.png`} alt="depa" style={{ height: '20px', objectFit: 'contain' }} />
                <img src={`${import.meta.env.BASE_URL}mdes.png`} alt="Ministry of Digital Economy" style={{ height: '20px', objectFit: 'contain' }} />
                <img src={`${import.meta.env.BASE_URL}smart-city-thailand-logo.svg`} alt="Smart City Thailand" style={{ height: '18px', objectFit: 'contain' }} />
              </div>

              {/* Executed by */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '18px' }}>
                <div style={{ fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '0.16em', fontWeight: 700, textTransform: 'uppercase' }}>EXECUTED BY</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: '#fff', borderRadius: '5px', padding: '3px 8px' }}>
                  <img src={`${import.meta.env.BASE_URL}axiom-logo.png`} alt="Axiom AI" style={{ height: '20px', objectFit: 'contain' }} />
                  <img src={`${import.meta.env.BASE_URL}retl-logo.svg`} alt="ReTL" style={{ height: '18px', objectFit: 'contain' }} />
                </span>
              </div>

              <h2 id="about-dashboard-title" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                Global Political Dashboard
              </h2>
              <p style={{ fontSize: '9px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', marginBottom: '14px', textTransform: 'uppercase', fontWeight: 600 }}>
                GLOBEWATCH {DASHBOARD_VERSION}
              </p>

              <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: '14px' }}>
                <p style={{ marginBottom: '10px' }}>
                  This project is supported by the <strong style={{ color: 'var(--ink)' }}>Program Management Unit for Area Based Development (PMU A)</strong> and the <strong style={{ color: 'var(--ink)' }}>Digital Economy Promotion Agency (depa)</strong>, with project execution by <strong style={{ color: 'var(--ink)' }}>Axiom</strong> and <strong style={{ color: 'var(--ink)' }}>ReTL (The Reason to Live Company)</strong>.
                </p>
                <p style={{ marginBottom: '10px' }}>
                  Created by <strong style={{ color: 'var(--ink)' }}>Dr. Non Arkaraprasertkul</strong> — architect, urban designer, and smart city specialist; Harvard-affiliated doctoral researcher in anthropology and cities focused on human-centered smart cities and real-world implementation — and <strong style={{ color: 'var(--ink)' }}>Associate Professor Dr. Poon Thiengburanathum</strong>, as a public ranking model designed to explore alternative ways of understanding urban performance.
                </p>
                <p>
                  Their work sits at the intersection of urban design, data, and human behavior, bringing a distinctly people-centered perspective to how cities are measured and experienced.
                </p>
              </div>

              {/* Legal fine print */}
              <div style={{
                padding: '10px 12px', marginBottom: '14px',
                background: 'var(--paper)', borderRadius: '0',
                border: '1px solid var(--line)',
                fontSize: '10px', color: 'var(--ink-3)', lineHeight: 1.6
              }}>
                <strong style={{ color: 'var(--ink-2)' }}>Legal Notice</strong><br />
                This dashboard and all associated intellectual property — including but not limited to its design, source code, data architecture, analytical methodologies, and visual identity — are the proprietary work of Dr. Non Arkaraprasertkul and Associate Professor Dr. Poon Thiengburanathum. All rights reserved.<br /><br />
                This work is provided for informational and research purposes only. The data presented is aggregated from publicly available open-source intelligence (OSINT) feeds and should not be construed as official government intelligence or policy guidance. The creators assume no liability for decisions made based on this information.<br /><br />
                Unauthorized reproduction, redistribution, reverse engineering, or use of this work in bad faith — including but not limited to commercial exploitation, misrepresentation of authorship, or derivative works without written consent — is strictly prohibited and may be subject to legal action under applicable intellectual property laws.
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                  12 data sources · PMUA · depa · Axiom · ReTL
                </span>
                <button onClick={() => setIsAboutOpen(false)} aria-label="Close about panel" style={{
                background: 'var(--green)', border: '1px solid var(--green)',
                  borderRadius: '0', padding: '10px 18px', color: '#fff',
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase'
                }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Classification Banner — always visible, top and bottom of viewport */}
      <ClassificationBanner level="FOUO" />
    </>
  );
}

export default App;
