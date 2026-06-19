import React, { Suspense } from 'react';

const PanelSkeleton = () => (
    <div className="bottom-card" style={{ padding: '10px 12px' }}>
        <div style={{
            height: '16px', width: '40%', background: 'rgba(255,255,255,0.04)',
            borderRadius: '4px', marginBottom: '8px'
        }} />
        <div style={{
            height: '8px', width: '100%', background: 'rgba(255,255,255,0.03)',
            borderRadius: '4px', marginBottom: '6px'
        }} />
        <div style={{
            height: '8px', width: '80%', background: 'rgba(255,255,255,0.03)',
            borderRadius: '4px'
        }} />
    </div>
);

const PANELS = {
    MapContainer: React.lazy(() => import('./MapContainer')),
    IntelligencePanel: React.lazy(() => import('./IntelligencePanel')),
    RegionalNewsPanel: React.lazy(() => import('./RegionalNewsPanel')),
    MarketRadarPanel: React.lazy(() => import('./MarketRadarPanel')),
    CountryNewsPanel: React.lazy(() => import('./CountryNewsPanel')),
    MaritimeWarningsPanel: React.lazy(() => import('./MaritimeWarningsPanel')),
    SeismicPanel: React.lazy(() => import('./SeismicPanel')),
    TimeMachine: React.lazy(() => import('./TimeMachine')),
    HormuzTracker: React.lazy(() => import('./HormuzTracker')),
    OilPriceChart: React.lazy(() => import('./OilPriceChart')),
    MiddleEastOilDependency: React.lazy(() => import('./MiddleEastOilDependency')),
    SentimentChart: React.lazy(() => import('./SentimentChart')),
    AcledAnalytics: React.lazy(() => import('./AcledAnalytics')),
    HumanitarianPanel: React.lazy(() => import('./HumanitarianPanel')),
    SanctionsPanel: React.lazy(() => import('./SanctionsPanel')),
    WarCostTracker: React.lazy(() => import('./WarCostTracker')),
    NuclearTrackerPanel: React.lazy(() => import('./NuclearTrackerPanel')),
    KeyFiguresPanel: React.lazy(() => import('./KeyFiguresPanel')),
    InternationalResponsePanel: React.lazy(() => import('./InternationalResponsePanel')),
    RefugeePanel: React.lazy(() => import('./RefugeePanel')),
    ArmsDefensePanel: React.lazy(() => import('./ArmsDefensePanel')),
    IranWarPanel: React.lazy(() => import('./IranWarPanel')),
    LiveTVPanel: React.lazy(() => import('./LiveTVPanel')),
    MultiFrontBoard: React.lazy(() => import('./MultiFrontBoard')),
    FlightRadarEmbed: React.lazy(() => import('./FlightRadarEmbed')),
    EventDetailsPanel: React.lazy(() => import('./EventDetailsPanel')),
};

export const LazyMapContainer = PANELS.MapContainer;

export const LazyPanel = ({ name, panelKey, ...props }) => {
    const Component = PANELS[name];
    if (!Component) return null;
    return (
        <Suspense key={panelKey} fallback={<PanelSkeleton />}>
            <Component {...props} />
        </Suspense>
    );
};
