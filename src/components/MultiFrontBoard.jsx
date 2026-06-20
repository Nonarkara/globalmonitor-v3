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
                    padding: '2px 6px',
                    border: '1px solid var(--line-2)',
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
                letterSpacing: 'normal',
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
                {front.dayCount != null ? `DAY ${front.dayCount}` : '\u00A0'}
            </div>

            <div className="multi-front-card__metrics">
                <span style={{ visibility: front.fireCount > 0 ? 'visible' : 'hidden' }}>
                    {front.fireCount || 0} fires
                </span>
                <span style={{ visibility: front.newsHits > 0 ? 'visible' : 'hidden' }}>
                    {front.newsHits || 0} intel
                </span>
            </div>

            <div className="multi-front-card__headline">
                {front.latestHeadline || '\u00A0'}
            </div>
        </div>
    );
};

const MultiFrontBoard = () => {
    const fetcher = useCallback(() => fetchFrontStatus(), []);
    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: 'front-status',
        intervalMs: 5 * 60 * 1000,
        isUsable: (d) => Array.isArray(d?.fronts)
    });

    const fronts = data?.fronts || [];
    const criticalCount = fronts.filter(f => f.status === 'CRITICAL').length;
    const activeCount = fronts.filter(f => f.status === 'ACTIVE').length;

    return (
        <div className="multi-front-board grid-panel">
            <div className="multi-front-board__header">
                <span className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
                    MULTI-FRONT STATUS
                </span>
                <div style={{ display: 'flex', gap: '10px', minWidth: '12ch', justifyContent: 'flex-end' }}>
                    <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        color: 'var(--red)',
                        letterSpacing: '0.14em',
                        visibility: criticalCount > 0 ? 'visible' : 'hidden',
                        fontVariantNumeric: 'tabular-nums',
                        textTransform: 'uppercase'
                    }}>
                        {criticalCount} CRITICAL
                    </span>
                    <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        color: 'var(--ink-2)',
                        letterSpacing: '0.14em',
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
                emptyMessage="No active front data"
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
