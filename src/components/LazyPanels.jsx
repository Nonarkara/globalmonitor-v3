import React, { Suspense } from 'react';

// After a redeploy, hashed chunk files from the previous build no longer exist —
// an already-open tab that lazy-loads one gets a 404 and the error boundary
// shows "Something went wrong" on every retry. Recover with ONE forced reload
// (fresh index.html → fresh chunk URLs); the sessionStorage flag stops loops.
const RELOAD_FLAG = 'gm:chunk-reload';
const lazyWithReload = (importer) => React.lazy(() =>
    importer()
        .then((module) => {
            try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* private mode */ }
            return module;
        })
        .catch((error) => {
            let alreadyReloaded = false;
            try {
                alreadyReloaded = Boolean(sessionStorage.getItem(RELOAD_FLAG));
                if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
            } catch { alreadyReloaded = true; }
            if (!alreadyReloaded) {
                window.location.reload();
                return new Promise(() => {}); // page is reloading — never resolve
            }
            throw error;
        })
);

const PanelSkeleton = () => (
    <div className="bottom-card" style={{ padding: '10px 12px' }}>
        <div style={{
            height: '16px', width: '40%', background: 'var(--line)',
            borderRadius: 0, marginBottom: '8px'
        }} />
        <div style={{
            height: '8px', width: '100%', background: 'var(--line)',
            borderRadius: 0, marginBottom: '6px'
        }} />
        <div style={{
            height: '8px', width: '80%', background: 'var(--line)',
            borderRadius: 0
        }} />
    </div>
);

const PANELS = {
    MapContainer: lazyWithReload(() => import('./MapContainer')),
    IntelligencePanel: lazyWithReload(() => import('./IntelligencePanel')),
    RegionalNewsPanel: lazyWithReload(() => import('./RegionalNewsPanel')),
    MarketRadarPanel: lazyWithReload(() => import('./MarketRadarPanel')),
    CountryNewsPanel: lazyWithReload(() => import('./CountryNewsPanel')),
    MaritimeWarningsPanel: lazyWithReload(() => import('./MaritimeWarningsPanel')),
    SeismicPanel: lazyWithReload(() => import('./SeismicPanel')),
    TimeMachine: lazyWithReload(() => import('./TimeMachine')),
    HormuzTracker: lazyWithReload(() => import('./HormuzTracker')),
    OilPriceChart: lazyWithReload(() => import('./OilPriceChart')),
    MiddleEastOilDependency: lazyWithReload(() => import('./MiddleEastOilDependency')),
    SentimentChart: lazyWithReload(() => import('./SentimentChart')),
    AcledAnalytics: lazyWithReload(() => import('./AcledAnalytics')),
    HumanitarianPanel: lazyWithReload(() => import('./HumanitarianPanel')),
    SanctionsPanel: lazyWithReload(() => import('./SanctionsPanel')),
    WarCostTracker: lazyWithReload(() => import('./WarCostTracker')),
    NuclearTrackerPanel: lazyWithReload(() => import('./NuclearTrackerPanel')),
    KeyFiguresPanel: lazyWithReload(() => import('./KeyFiguresPanel')),
    InternationalResponsePanel: lazyWithReload(() => import('./InternationalResponsePanel')),
    RefugeePanel: lazyWithReload(() => import('./RefugeePanel')),
    ArmsDefensePanel: lazyWithReload(() => import('./ArmsDefensePanel')),
    IranWarPanel: lazyWithReload(() => import('./IranWarPanel')),
    SouthChinaSeaPanel: lazyWithReload(() => import('./SouthChinaSeaPanel')),
    ThailandStatusPanel: lazyWithReload(() => import('./ThailandStatusPanel')),
    FloodOpsPanel: lazyWithReload(() => import('./FloodOpsPanel')),
    OraclePanel: lazyWithReload(() => import('./OraclePanel')),
    LiveTVPanel: lazyWithReload(() => import('./LiveTVPanel')),
    MultiFrontBoard: lazyWithReload(() => import('./MultiFrontBoard')),
    FlightRadarEmbed: lazyWithReload(() => import('./FlightRadarEmbed')),
    EventDetailsPanel: lazyWithReload(() => import('./EventDetailsPanel')),
    ResearchView: lazyWithReload(() => import('./ResearchView')),
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
