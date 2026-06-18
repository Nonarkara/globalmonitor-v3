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
                <Icon size={12} style={{ color: front.color, opacity: 0.8 }} />
                <span style={{
                    fontSize: '0.42rem',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    color: front.color,
                    textTransform: 'uppercase',
                    padding: '1px 5px',
                    background: `${front.color}15`,
                    borderRadius: '3px',
                    minWidth: '5.5ch',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums'
                }}>
                    {front.status}
                </span>
            </div>

            <div style={{
                fontSize: '0.52rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.3px',
                lineHeight: 1.2
            }}>
                {front.name}
            </div>

            <div style={{
                fontSize: '0.72rem',
                fontWeight: 200,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: front.dayCount != null ? front.color : 'transparent',
                lineHeight: 1,
                minHeight: '0.72rem'
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
        <div className="multi-front-board" style={{
            background: 'rgba(10, 12, 18, 0.75)',
            backdropFilter: 'blur(16px)',
            borderRadius: '10px',
            padding: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
        }}>
            <div className="multi-front-board__header">
                <span style={{
                    fontSize: '0.5rem',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase'
                }}>
                    MULTI-FRONT STATUS
                </span>
                <div style={{ display: 'flex', gap: '6px', minWidth: '12ch', justifyContent: 'flex-end' }}>
                    <span style={{
                        fontSize: '0.42rem',
                        fontWeight: 700,
                        color: '#ef4444',
                        letterSpacing: '0.5px',
                        visibility: criticalCount > 0 ? 'visible' : 'hidden',
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {criticalCount} CRITICAL
                    </span>
                    <span style={{
                        fontSize: '0.42rem',
                        fontWeight: 700,
                        color: '#f59e0b',
                        letterSpacing: '0.5px',
                        visibility: activeCount > 0 ? 'visible' : 'hidden',
                        fontVariantNumeric: 'tabular-nums'
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
