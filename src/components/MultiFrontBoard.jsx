import React, { useCallback } from 'react';
import { Crosshair, Shield, AlertTriangle, Flame, Anchor, Ship, Map } from 'lucide-react';
import { fetchFrontStatus } from '../services/frontStatus';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';

const ICONS = {
    crosshair: Crosshair,
    shield: Shield,
    'alert-triangle': AlertTriangle,
    flame: Flame,
    anchor: Anchor,
    ship: Ship,
    map: Map
};

const FrontCard = ({ front }) => {
    const Icon = ICONS[front.icon] || Crosshair;
    const thermal = front.thermalCount ?? front.fireCount ?? 0;

    return (
        <div
            className="multi-front-card"
            style={{ borderTop: `2px solid ${front.color}` }}
        >
            {front.status === 'CRITICAL' && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: front.color
                }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={12} style={{ color: front.color === '#ef4444' ? 'var(--red)' : front.color === '#f59e0b' ? 'var(--ink-2)' : 'var(--green)', opacity: 0.9 }} />
                <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: front.status === 'CRITICAL' ? 'var(--red)' : front.status === 'ACTIVE' ? 'var(--ink)' : 'var(--ink-3)',
                    textTransform: 'uppercase',
                    padding: '1px 5px',
                    background: '#f2f0ea',
                    borderRadius: 0,
                    minWidth: '5.5ch',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums'
                }}>
                    {front.status}
                </span>
            </div>

            <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '0.3px',
                lineHeight: 1.2
            }}>
                {front.name}
            </div>

            <div style={{
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: front.dayCount != null ? 'var(--ink)' : 'transparent',
                lineHeight: 1,
                minHeight: '15px'
            }}>
                {front.dayCount != null ? `DAY ${front.dayCount}` : ' '}
            </div>

            {/* "thermal", not "fires": these are VIIRS anomalies inside a rectangle —
                gas flares and crop burning included. "intel · 24h" states the window. */}
            <div className="multi-front-card__metrics">
                <span
                    style={{ visibility: thermal > 0 ? 'visible' : 'hidden' }}
                    title="VIIRS thermal anomalies inside this front's bounding box, last 48h — includes flares and agricultural burning"
                >
                    {thermal} thermal
                </span>
                <span style={{ visibility: front.newsHits > 0 ? 'visible' : 'hidden' }} title="Keyword matches in the last 24h of headlines">
                    {front.newsHits || 0} intel · 24h
                </span>
            </div>

            <div className="multi-front-card__headline">
                {front.latestHeadline || ' '}
            </div>
        </div>
    );
};

const MultiFrontBoard = ({ viewMode = 'middleeast' }) => {
    const fetcher = useCallback(() => fetchFrontStatus(viewMode), [viewMode]);
    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: `front-status:${viewMode}`,
        intervalMs: 5 * 60 * 1000,
        isUsable: (d) => Array.isArray(d?.fronts)
    });

    const fronts = data?.fronts || [];
    const criticalCount = fronts.filter(f => f.status === 'CRITICAL').length;
    const activeCount = fronts.filter(f => f.status === 'ACTIVE').length;
    // The backend returns no fronts when every input feed was silent. That is
    // "no signal", not "all fronts stable", and the empty state must say so.
    const silent = data?.reason === 'no-signal';

    return (
        <div className="multi-front-board" style={{
            background: 'var(--panel)',
            borderRadius: 0,
            padding: '8px',
            border: '1px solid var(--line)'
        }}>
            <div className="multi-front-board__header">
                <span style={{
                    fontSize: '0.5rem',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: 'var(--ink-2)',
                    textTransform: 'uppercase'
                }}>
                    MULTI-FRONT STATUS
                </span>
                <div style={{ display: 'flex', gap: '10px', minWidth: '12ch', justifyContent: 'flex-end' }}>
                    <span style={{
                        fontSize: '0.42rem',
                        fontWeight: 700,
                        color: 'var(--red)',
                        letterSpacing: '0.5px',
                        visibility: criticalCount > 0 ? 'visible' : 'hidden',
                        fontVariantNumeric: 'tabular-nums',
                        textTransform: 'uppercase'
                    }}>
                        {criticalCount} CRITICAL
                    </span>
                    <span style={{
                        fontSize: '0.42rem',
                        fontWeight: 700,
                        color: 'var(--ink-2)',
                        letterSpacing: '0.5px',
                        visibility: activeCount > 0 ? 'visible' : 'hidden',
                        fontVariantNumeric: 'tabular-nums',
                        textTransform: 'uppercase'
                    }}>
                        {activeCount} ACTIVE
                    </span>
                </div>
            </div>
            <DataStatus
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isStale={isStale}
                error={error}
                retryCount={retryCount}
                data={data}
                isEmpty={data && fronts.length === 0}
                emptyMessage={silent ? 'NO SIGNAL — input feeds silent, no front status computed' : 'No active front data'}
                refresh={refresh}
            >
                <div className="multi-front-board__cards">
                    {fronts.map((front) => (
                        <FrontCard key={front.id} front={front} />
                    ))}
                </div>
            </DataStatus>
        </div>
    );
};

export default MultiFrontBoard;
