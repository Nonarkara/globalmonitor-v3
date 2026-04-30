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
    const isActive = front.status === 'CRITICAL' || front.status === 'ACTIVE';

    return (
        <div style={{
            flex: '1 1 0',
            minWidth: '110px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '8px',
            padding: '8px 10px',
            borderTop: `2px solid ${front.color}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative',
            overflow: 'hidden'
        }}>
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
                    borderRadius: '3px'
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

            {front.dayCount != null && (
                <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 200,
                    fontFamily: 'var(--font-mono)',
                    color: front.color,
                    lineHeight: 1
                }}>
                    DAY {front.dayCount}
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                {front.fireCount > 0 && (
                    <span style={{
                        fontSize: '0.44rem',
                        color: 'rgba(255,255,255,0.45)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {front.fireCount} fires
                    </span>
                )}
                {front.newsHits > 0 && (
                    <span style={{
                        fontSize: '0.44rem',
                        color: 'rgba(255,255,255,0.45)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {front.newsHits} intel
                    </span>
                )}
            </div>

            {front.latestHeadline && (
                <div style={{
                    fontSize: '0.44rem',
                    color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                }}>
                    {front.latestHeadline}
                </div>
            )}
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
        <div style={{
            background: 'rgba(10, 12, 18, 0.75)',
            backdropFilter: 'blur(16px)',
            borderRadius: '10px',
            padding: '8px',
            border: '1px solid rgba(255,255,255,0.06)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
                padding: '0 4px'
            }}>
                <span style={{
                    fontSize: '0.5rem',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase'
                }}>
                    MULTI-FRONT STATUS
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {criticalCount > 0 && (
                        <span style={{
                            fontSize: '0.42rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            letterSpacing: '0.5px'
                        }}>
                            {criticalCount} CRITICAL
                        </span>
                    )}
                    {activeCount > 0 && (
                        <span style={{
                            fontSize: '0.42rem',
                            fontWeight: 700,
                            color: '#f59e0b',
                            letterSpacing: '0.5px'
                        }}>
                            {activeCount} ACTIVE
                        </span>
                    )}
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
                <div style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto'
                }}>
                    {fronts.map((front) => (
                        <FrontCard key={front.id} front={front} />
                    ))}
                </div>
            </DataStatus>
        </div>
    );
};

export default MultiFrontBoard;
