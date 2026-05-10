import React, { useState, useCallback, useEffect } from 'react';
import MapContainer from './components/MapContainer';
import Sidebar from './components/Sidebar';
import RegionSelector from './components/RegionSelector';
import EventDetailsPanel from './components/EventDetailsPanel';
import WorldClock from './components/WorldClock';
import LiveIntelligenceFeed from './components/LiveIntelligenceFeed';
import IntelligencePanel from './components/IntelligencePanel';
import RegionalNewsPanel from './components/RegionalNewsPanel';
import MarketRadarPanel from './components/MarketRadarPanel';
import SettingsModal from './components/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary';
import { INTELLIGENCE_SOURCES, APAC_SOURCES } from './services/liveNews';
import { REGIONS, getRegion } from './data/regions';
import CountryNewsPanel from './components/CountryNewsPanel';
import { fetchCopernicusPreview } from './services/copernicus';
import { useLiveResource } from './hooks/useLiveResource';
import { Settings, RefreshCw, Eye, Network, Database, FileText, Printer, Info } from 'lucide-react';
import { getVisitorCount, BASE_COUNT } from './services/visitorTracker';
import EscalationGauge from './components/EscalationGauge';
import LiveTVPanel from './components/LiveTVPanel';
import MultiFrontBoard from './components/MultiFrontBoard';
import IranWarPanel from './components/IranWarPanel';
import AlertBanner from './components/AlertBanner';
import MaritimeWarningsPanel from './components/MaritimeWarningsPanel';
import SeismicPanel from './components/SeismicPanel';
import TimeMachine from './components/TimeMachine';
import HormuzTracker from './components/HormuzTracker';
import OilPriceChart from './components/OilPriceChart';
import SentimentChart from './components/SentimentChart';
import AcledAnalytics from './components/AcledAnalytics';
import FlightRadarEmbed from './components/FlightRadarEmbed';
import { useOnlineStatus } from './hooks/useOnlineStatus';
// Long-term intelligence components
import HumanitarianPanel from './components/HumanitarianPanel';
import SanctionsPanel from './components/SanctionsPanel';
import WarCostTracker from './components/WarCostTracker';
import ConflictChronicle from './components/ConflictChronicle';
import ActorNetworkModal from './components/ActorNetworkModal';
import NuclearTrackerPanel from './components/NuclearTrackerPanel';
import KeyFiguresPanel from './components/KeyFiguresPanel';
import InternationalResponsePanel from './components/InternationalResponsePanel';
import RefugeePanel from './components/RefugeePanel';
import ArmsDefensePanel from './components/ArmsDefensePanel';
// Government best-practice components
import ClassificationBanner from './components/ClassificationBanner';
import SourceHealthModal from './components/SourceHealthModal';
import ActivityLogModal from './components/ActivityLogModal';
import { logActivity, LOG_TYPES } from './services/activityLog';
import { useEscapeKey } from './hooks/useEscapeKey';
import './styles/print.css';

function App() {
  const [activeLayers, setActiveLayers] = useState(['disasters', 'weather', 'economy', 'conflicts', 'aqi', 'firms']);
  const [activeRegion, setActiveRegion] = useState('middleeast');
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
  const [activeSources, setActiveSources] = useState(INTELLIGENCE_SOURCES.map((source) => source.id));
  const [copernicusMode, setCopernicusMode] = useState('true-color');
  const [showCopernicusOverlay, setShowCopernicusOverlay] = useState(true);
  const [showStrategicContext, setShowStrategicContext] = useState(false);

  const [visitorCount, setVisitorCount] = useState(BASE_COUNT);
  useEffect(() => { getVisitorCount().then(setVisitorCount); }, []);
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

  const [viewState, setViewState] = useState({
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

  const handleRegionSelect = useCallback((regionId, targetViewState) => {
    setActiveRegion(regionId);
    setViewState(prev => ({
      ...prev,
      ...targetViewState,
      transitionDuration: 1500,
    }));
  }, []);

  /** Chronicle fly-to handler */
  const handleChronicleFlyTo = useCallback((target) => {
    setViewState(prev => ({
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
    const list = viewMode === 'middleeast' ? INTELLIGENCE_SOURCES : APAC_SOURCES;
    setActiveSources(enable ? list.map((source) => source.id) : []);
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
          <MapContainer
            viewState={viewState}
            onMove={setViewState}
            activeLayers={activeLayers}
            onMarkerClick={setSelectedEvent}
            copernicusPreview={copernicusResource.data}
            copernicusMode={copernicusMode}
            copernicusRuntimeSource={copernicusRuntimeSource}
            showCopernicusOverlay={showCopernicusOverlay}
            showStrategicContext={showStrategicContext}
            timeMachineDate={timeMachineDate}
            viewMode={viewMode}
            onRegionDotClick={(props) => {
              const code = props?.countryCode || props?.regionCode;
              if (code) setSelectedCountryCode(code);
              if (typeof props?.latitude === 'number' && typeof props?.longitude === 'number') {
                setViewState((prev) => ({
                  ...prev,
                  longitude: props.longitude,
                  latitude: props.latitude,
                  zoom: Math.max(prev.zoom, viewMode === 'thailand' ? 6.5 : 4.5),
                  transitionDuration: 800,
                }));
              }
            }}
          />
        </ErrorBoundary>

        {/* Row 1: World Clock */}
        <ErrorBoundary inline label="World Clock">
          <WorldClock viewMode={viewMode} />
        </ErrorBoundary>

        {/* Row 2: Header bar — 3-section layout: logos | center title | controls */}
        <div className="header-bar grid-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: Sponsor logos in white pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto', background: '#fff', padding: '3px 8px', borderRadius: '5px' }}>
            <img src={`${import.meta.env.BASE_URL}pmua-logo.webp`} alt="PMUA" style={{ height: '18px', objectFit: 'contain' }} />
            <img src={`${import.meta.env.BASE_URL}Logo depa-01.png`} alt="depa" style={{ height: '14px', objectFit: 'contain' }} />
            <img src={`${import.meta.env.BASE_URL}axiom-logo.png`} alt="Axiom" style={{ height: '14px', objectFit: 'contain' }} />
            <img src={`${import.meta.env.BASE_URL}retl-logo.svg`} alt="ReTL" style={{ height: '14px', objectFit: 'contain' }} />
          </div>

          {/* Center: Title + Escalation + Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'center' }}>
              <span style={{ fontWeight: 300, letterSpacing: '2.5px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }}>
                Global Political Dashboard
              </span>
              <span style={{ fontWeight: 500, letterSpacing: '1.5px', fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                {getRegion(viewMode).label} · GlobeWatch · v8.0
              </span>
            </div>
            <ErrorBoundary inline label="Escalation">
              <EscalationGauge />
            </ErrorBoundary>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px',
              fontFamily: 'var(--font-mono)'
            }}>
              <Eye size={9} style={{ opacity: 0.35 }} />
              {visitorCount.toLocaleString()}
            </div>
            {!backendUp && (
              <span style={{
                fontSize: '0.45rem', fontWeight: 700, letterSpacing: '1px',
                color: '#ef4444', padding: '2px 6px',
                background: 'rgba(239,68,68,0.1)', borderRadius: '4px',
                border: '1px solid rgba(239,68,68,0.2)'
              }}>
                OFFLINE
              </span>
            )}
          </div>
          {/* Right: Controls */}
          <div style={{ display: 'flex', gap: '6px', flex: '0 0 auto' }}>
            {viewMode === 'middleeast' && (
              <button
                onClick={() => setIsNetworkOpen(true)}
                aria-label="Open actor and faction network analysis"
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  color: 'rgba(139,92,246,0.7)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '0.6rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.3s',
                  letterSpacing: '0.5px'
                }}
              >
                <Network size={11} aria-hidden="true" /> Actors
              </button>
            )}
            <div
              role="tablist"
              aria-label="Theater region selector"
              style={{
                display: 'inline-flex',
                gap: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {Object.values(REGIONS).map((r) => {
                const isActive = viewMode === r.id;
                return (
                  <button
                    key={r.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setViewMode(r.id);
                      setActiveRegion(r.id === 'middleeast' ? 'middleeast' : r.id === 'indopacific' ? 'asean' : 'thailand');
                      setViewState({ ...r.viewState, transitionDuration: 1200 });
                      setActiveSources(r.id === 'middleeast'
                        ? INTELLIGENCE_SOURCES.map(s => s.id)
                        : APAC_SOURCES.map(s => s.id));
                      setSelectedCountryCode(null);
                    }}
                    style={{
                      background: isActive ? 'rgba(56,189,248,0.18)' : 'transparent',
                      border: 'none',
                      borderLeft: r.id === 'middleeast' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: isActive ? '#dbeafe' : 'rgba(255,255,255,0.55)',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      fontFamily: 'inherit',
                      letterSpacing: '0.6px',
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      minHeight: 28,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setIsSourceHealthOpen(true)} title="Data Sources & Health" aria-label="View data source health and provenance"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <Database size={11} aria-hidden="true" />
            </button>
            <button onClick={() => setIsActivityLogOpen(true)} title="Session Activity Log" aria-label="View session activity log"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <FileText size={11} aria-hidden="true" />
            </button>
            <button onClick={() => { logActivity(LOG_TYPES.USER_ACTION, 'Print briefing initiated'); window.print(); }} title="Print Briefing" aria-label="Print intelligence briefing"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <Printer size={11} aria-hidden="true" />
            </button>
            <button onClick={() => setIsAboutOpen(true)} title="About this project" aria-label="About this project"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <Info size={11} aria-hidden="true" />
            </button>
            <button onClick={handleRefreshAll} title="Refresh all data sources" aria-label="Refresh all data sources" disabled={isRefreshingAll}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: isRefreshingAll ? 'rgba(56,189,248,0.8)' : 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: isRefreshingAll ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <RefreshCw size={11} aria-hidden="true" className={isRefreshingAll ? 'spin-anim' : ''} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} title="Settings" aria-label="Open intelligence source settings"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)',
                padding: '5px 8px', borderRadius: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}>
              <Settings size={11} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Row 3: Multi-Front Status Board */}
        {viewMode === 'middleeast' && (
          <div style={{ gridColumn: '2 / -1', gridRow: 3, pointerEvents: 'auto' }}>
            <ErrorBoundary inline label="Multi-Front Board">
              <MultiFrontBoard />
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
            />
          </ErrorBoundary>
          {viewMode === 'middleeast' && (
            <ErrorBoundary inline label="Flight Radar">
              <FlightRadarEmbed />
            </ErrorBoundary>
          )}
          {/* Live TV is always present so switching regions just swaps channels
              instead of unmounting the iframe — keeps panel stable across nav. */}
          <ErrorBoundary inline label="Live TV">
            <LiveTVPanel viewMode={viewMode} />
          </ErrorBoundary>
        </div>

        {/* Row 3: Right sidebar */}
        <div className="right-sidebar">
          {selectedEvent && (
            <EventDetailsPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
          {viewMode === 'middleeast' && (
            <>
              <ErrorBoundary inline label="Iran War Theater">
                <IranWarPanel activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Impact">
                <HumanitarianPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <AcledAnalytics />
              </ErrorBoundary>
              <ErrorBoundary inline label="Key Figures">
                <KeyFiguresPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="International Response">
                <InternationalResponsePanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <RefugeePanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Arms & Defense">
                <ArmsDefensePanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Gulf Security">
                <IntelligencePanel key={`gulfSecurity:${sourceSetKey}`} briefingId="gulfSecurity" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Energy & Oil Impact">
                <IntelligencePanel key={`energyMarkets:${sourceSetKey}`} briefingId="energyMarkets" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Regional Headlines">
                <RegionalNewsPanel regionName="Middle East" title="Regional Headlines" activeSourceIds={activeSources} />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'indopacific' && (
            <>
              <ErrorBoundary inline label="ASEAN Country News">
                <CountryNewsPanel
                  mode="indopacific"
                  selectedCode={selectedCountryCode}
                  onSelect={setSelectedCountryCode}
                />
              </ErrorBoundary>
              <ErrorBoundary inline label="South China Sea">
                <IntelligencePanel key={`southChinaSea:${sourceSetKey}`} briefingId="southChinaSea" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Geopolitics">
                <IntelligencePanel key={`aseanDiplomacy:${sourceSetKey}`} briefingId="aseanDiplomacy" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Myanmar Conflict">
                <IntelligencePanel key={`myanmarConflict:${sourceSetKey}`} briefingId="myanmarConflict" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Crisis">
                <HumanitarianPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <RefugeePanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <AcledAnalytics />
              </ErrorBoundary>
              <ErrorBoundary inline label="Arms & Defense">
                <ArmsDefensePanel />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'thailand' && (
            <>
              <ErrorBoundary inline label="Thailand Region News">
                <CountryNewsPanel
                  mode="thailand"
                  selectedCode={selectedCountryCode}
                  onSelect={setSelectedCountryCode}
                />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thailand Security">
                <IntelligencePanel key={`thaiSecurity:${sourceSetKey}`} briefingId="thaiSecurity" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Myanmar Border Crisis">
                <IntelligencePanel key={`myanmarConflict:${sourceSetKey}`} briefingId="myanmarConflict" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Humanitarian Crisis">
                <HumanitarianPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Displacement Tracker">
                <RefugeePanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Conflict Analytics">
                <AcledAnalytics />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thai Tech Ecosystem">
                <RegionalNewsPanel regionName="Thailand" title="Thailand Tech Ecosystem" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="depa Directives">
                <RegionalNewsPanel regionName="DEPA" title="depa & MDES Directives" activeSourceIds={activeSources} />
              </ErrorBoundary>
            </>
          )}
        </div>

        {/* Row 4: Conflict Chronicle — timeline between map and bottom bar */}
        {viewMode === 'middleeast' && (
          <div className="chronicle-row">
            <ErrorBoundary inline label="Conflict Chronicle">
              <ConflictChronicle onFlyTo={handleChronicleFlyTo} />
            </ErrorBoundary>
          </div>
        )}

        {/* Row 5: Bottom bar — 5-column grid, 2 rows */}
        <div className="bottom-bar">
          <ErrorBoundary inline label="Market Radar">
            <MarketRadarPanel viewMode={viewMode} />
          </ErrorBoundary>
          {viewMode === 'middleeast' && (
            <>
              {/* Row 1: Economics & Markets */}
              <ErrorBoundary inline label="Oil Price Chart">
                <OilPriceChart />
              </ErrorBoundary>
              <ErrorBoundary inline label="War Cost">
                <WarCostTracker />
              </ErrorBoundary>
              <ErrorBoundary inline label="Sanctions Tracker">
                <SanctionsPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Hormuz Crisis">
                <HormuzTracker />
              </ErrorBoundary>
              {/* Row 2: Military & Intelligence */}
              <ErrorBoundary inline label="Nuclear Program">
                <NuclearTrackerPanel onFlyTo={handleChronicleFlyTo} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Diplomacy & Sanctions">
                <IntelligencePanel key={`iranDiplomacy:${sourceSetKey}`} briefingId="iranDiplomacy" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Proxy Theater">
                <IntelligencePanel key={`proxyTheater:${sourceSetKey}`} briefingId="proxyTheater" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <SentimentChart />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <SeismicPanel />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'indopacific' && (
            <>
              <ErrorBoundary inline label="South China Sea Watch">
                <RegionalNewsPanel regionName="SouthChinaSea" title="South China Sea Watch" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Taiwan Strait">
                <RegionalNewsPanel regionName="Taiwan" title="Taiwan Strait" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Diplomacy">
                <RegionalNewsPanel regionName="ASEAN" title="ASEAN Diplomacy" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Global Tech News">
                <RegionalNewsPanel regionName="SEA" title="Indo-Pacific Tech" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Global Macro">
                <RegionalNewsPanel regionName="Global" title="Global Macro & Policy" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Maritime Warnings">
                <MaritimeWarningsPanel />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <SentimentChart />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <SeismicPanel />
              </ErrorBoundary>
            </>
          )}
          {viewMode === 'thailand' && (
            <>
              <ErrorBoundary inline label="Myanmar Border Crisis">
                <RegionalNewsPanel regionName="Myanmar" title="Myanmar Border Crisis" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="ASEAN Watch">
                <RegionalNewsPanel regionName="ASEAN" title="ASEAN Watch" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Thailand Tech">
                <RegionalNewsPanel regionName="Thailand" title="Thailand Tech Ecosystem" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="depa Directives">
                <RegionalNewsPanel regionName="DEPA" title="depa & MDES" activeSourceIds={activeSources} />
              </ErrorBoundary>
              <ErrorBoundary inline label="Media Sentiment">
                <SentimentChart />
              </ErrorBoundary>
              <ErrorBoundary inline label="Seismic Activity">
                <SeismicPanel />
              </ErrorBoundary>
            </>
          )}
        </div>

        {/* Row 6: Live news ticker */}
        <ErrorBoundary inline label="Live Feed">
          <LiveIntelligenceFeed key={`ticker:${sourceSetKey}`} activeSourceIds={activeSources} />
        </ErrorBoundary>

        {/* Time Machine — date slider for historical data */}
        {viewMode === 'middleeast' && (
          <ErrorBoundary inline label="Time Machine">
            <TimeMachine onDateChange={setTimeMachineDate} />
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
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)'
          }} onClick={() => setIsAboutOpen(false)}>
            <div style={{
              width: '560px', maxWidth: '92vw', maxHeight: '85vh',
              background: 'rgba(14,18,28,0.95)', backdropFilter: 'blur(24px)',
              borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'auto', padding: '28px 32px'
            }} onClick={e => e.stopPropagation()}>
              {/* Primary funder */}
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', letterSpacing: '2px', marginBottom: '8px' }}>FUNDED BY</div>
                <img src={`${import.meta.env.BASE_URL}pmua-logo.webp`} alt="PMUA" style={{ height: '36px', objectFit: 'contain', filter: 'brightness(1.8) contrast(0.9)', opacity: 0.9 }} />
                <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>Program Management Unit for Area Based Development</div>
              </div>

              {/* Supporting organizations */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <img src={`${import.meta.env.BASE_URL}Logo depa-01.png`} alt="depa" style={{ height: '20px', objectFit: 'contain', filter: 'brightness(1.8) contrast(0.9)', opacity: 0.75 }} />
                <img src={`${import.meta.env.BASE_URL}mdes.png`} alt="Ministry of Digital Economy" style={{ height: '20px', objectFit: 'contain', filter: 'brightness(1.8) contrast(0.9)', opacity: 0.65 }} />
                <img src={`${import.meta.env.BASE_URL}smart-city-thailand-logo.svg`} alt="Smart City Thailand" style={{ height: '18px', objectFit: 'contain', filter: 'brightness(1.5)', opacity: 0.6 }} />
              </div>

              {/* Executed by */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '18px' }}>
                <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', letterSpacing: '2px' }}>EXECUTED BY</div>
                <img src={`${import.meta.env.BASE_URL}axiom-logo.png`} alt="Axiom AI" style={{ height: '20px', objectFit: 'contain', filter: 'brightness(1.8) contrast(0.9)', opacity: 0.8 }} />
                <img src={`${import.meta.env.BASE_URL}retl-logo.svg`} alt="ReTL" style={{ height: '18px', objectFit: 'contain', filter: 'brightness(1.8) invert(1)', opacity: 0.8 }} />
              </div>

              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '4px', letterSpacing: '0.5px' }}>
                Global Political Dashboard
              </h2>
              <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', letterSpacing: '1px', marginBottom: '14px' }}>
                GLOBEWATCH v8.0
              </p>

              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: '14px' }}>
                <p style={{ marginBottom: '10px' }}>
                  This project is supported by the <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Program Management Unit for Area Based Development (PMU A)</strong> and the <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Digital Economy Promotion Agency (depa)</strong>, with project execution by <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Axiom</strong> and <strong style={{ color: 'rgba(255,255,255,0.85)' }}>ReTL (The Reason to Live Company)</strong>.
                </p>
                <p style={{ marginBottom: '10px' }}>
                  Created by <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Dr. Non Arkaraprasertkul</strong> — architect, urban designer, and smart city specialist; Harvard-affiliated doctoral researcher in anthropology and cities focused on human-centered smart cities and real-world implementation — and <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Associate Professor Dr. Poon Thiengburanathum</strong>, as a public ranking model designed to explore alternative ways of understanding urban performance.
                </p>
                <p>
                  Their work sits at the intersection of urban design, data, and human behavior, bringing a distinctly people-centered perspective to how cities are measured and experienced.
                </p>
              </div>

              {/* Legal fine print */}
              <div style={{
                padding: '10px 12px', marginBottom: '14px',
                background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.04)',
                fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6
              }}>
                <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Legal Notice</strong><br />
                This dashboard and all associated intellectual property — including but not limited to its design, source code, data architecture, analytical methodologies, and visual identity — are the proprietary work of Dr. Non Arkaraprasertkul and Associate Professor Dr. Poon Thiengburanathum. All rights reserved.<br /><br />
                This work is provided for informational and research purposes only. The data presented is aggregated from publicly available open-source intelligence (OSINT) feeds and should not be construed as official government intelligence or policy guidance. The creators assume no liability for decisions made based on this information.<br /><br />
                Unauthorized reproduction, redistribution, reverse engineering, or use of this work in bad faith — including but not limited to commercial exploitation, misrepresentation of authorship, or derivative works without written consent — is strictly prohibited and may be subject to legal action under applicable intellectual property laws.
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
                  12 data sources · PMUA · depa · Axiom · ReTL
                </span>
                <button onClick={() => setIsAboutOpen(false)} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', padding: '6px 16px', color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', fontSize: '0.65rem', fontFamily: 'inherit'
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
