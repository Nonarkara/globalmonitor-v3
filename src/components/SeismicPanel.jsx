import React, { useCallback } from 'react';
import { Radio } from 'lucide-react';
import { fetchUsgsQuakes } from '../services/usgsQuakes';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';

const getMagColor = (mag) => {
    if (mag >= 6) return '#dc2626';
    if (mag >= 5) return '#ef4444';
    if (mag >= 4) return '#f59e0b';
    if (mag >= 3) return '#eab308';
    return '#22c55e';
};

const timeAgo = (timestamp) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const QuakeItem = ({ quake }) => {
    const color = getMagColor(quake.magnitude);
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px',
            borderRadius: '4px'
        }}>
            {/* Magnitude badge */}
            <div style={{
                width: '32px',
                height: '28px',
                borderRadius: '6px',
                background: `${color}18`,
                border: `1px solid ${color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 300,
                    fontFamily: 'var(--font-mono)',
                    color
                }}>
                    {quake.magnitude.toFixed(1)}
                </span>
            </div>
            {/* Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.48rem',
                    color: 'rgba(255,255,255,0.7)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {quake.place}
                </div>
                <div style={{
                    fontSize: '0.4rem',
                    color: 'rgba(255,255,255,0.3)',
                    fontFamily: 'var(--font-mono)'
                }}>
                    {timeAgo(quake.time)} · depth {quake.depth.toFixed(0)}km
                </div>
            </div>
        </div>
    );
};

const SeismicPanel = ({ viewMode = 'middleeast' }) => {
    const fetcher = useCallback(() => fetchUsgsQuakes(viewMode), [viewMode]);
    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: `usgs-quakes:${viewMode}`,
        intervalMs: 10 * 60 * 1000,
        isUsable: (d) => d?.summary != null
    });

    const summary = data?.summary || {};
    const features = (data?.features || []).slice(0, 8);
    const quakes = features.map(f => ({
        id: f.id,
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        depth: f.geometry.coordinates[2],
        type: f.properties.type
    }));

    return (
        <div className="bottom-card flex-column">
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Radio size={14} /> SEISMIC ACTIVITY
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {summary.significant > 0 && (
                        <span style={{ fontSize: '0.42rem', fontWeight: 700, color: '#ef4444' }}>
                            {summary.significant} M4.5+
                        </span>
                    )}
                    <span className="live-pill">{summary.total || 0} USGS</span>
                </div>
            </div>
            <DataStatus
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isStale={isStale}
                error={error}
                retryCount={retryCount}
                data={data}
                isEmpty={data && quakes.length === 0}
                emptyMessage="No recent seismic activity in region"
                refresh={refresh}
            >
                <div className="panel-content" style={{
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    maxHeight: '180px', overflow: 'auto', padding: '6px'
                }}>
                    <div style={{
                        display: 'flex', gap: '12px', paddingBottom: '6px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        marginBottom: '4px'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 200, fontFamily: 'var(--font-mono)', color: summary.last24h > 5 ? '#f59e0b' : 'var(--text-muted)' }}>
                                {summary.last24h || 0}
                            </div>
                            <div style={{ fontSize: '0.38rem', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--text-muted)' }}>24H</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 200, fontFamily: 'var(--font-mono)', color: getMagColor(summary.maxMagnitude || 0) }}>
                                {summary.maxMagnitude ? summary.maxMagnitude.toFixed(1) : '--'}
                            </div>
                            <div style={{ fontSize: '0.38rem', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--text-muted)' }}>MAX MAG</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 200, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {summary.total || 0}
                            </div>
                            <div style={{ fontSize: '0.38rem', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--text-muted)' }}>TOTAL</div>
                        </div>
                    </div>
                    {quakes.map((q) => <QuakeItem key={q.id} quake={q} />)}
                </div>
            </DataStatus>
            <div style={{
                padding: '4px 8px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: '0.4rem',
                color: 'rgba(255,255,255,0.25)',
                textAlign: 'right'
            }}>
                Source: US Geological Survey (USGS)
            </div>
        </div>
    );
};

export default SeismicPanel;
