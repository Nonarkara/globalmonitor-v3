import React, { useCallback, useState } from 'react';
import { Anchor, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { fetchNgaWarnings } from '../services/ngaWarnings';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';

const THREAT_COLORS = {
    HIGH: '#ef4444',
    ELEVATED: '#f59e0b',
    MODERATE: '#3b82f6',
    LOW: '#22c55e'
};

const WarningItem = ({ warning, expanded, onToggle }) => {
    const color = THREAT_COLORS[warning.threat] || THREAT_COLORS.MODERATE;
    return (
        <div
            onClick={onToggle}
            style={{
                padding: '6px 8px',
                borderLeft: `3px solid ${color}`,
                background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s',
                borderRadius: '0 4px 4px 0',
                marginBottom: '3px'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <span style={{
                        fontSize: '0.38rem', fontWeight: 700, letterSpacing: '0.5px',
                        color, padding: '1px 4px', background: `${color}15`,
                        borderRadius: '2px', flexShrink: 0
                    }}>
                        {warning.threat}
                    </span>
                    <span style={{
                        fontSize: '0.48rem', color: 'rgba(255,255,255,0.7)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        NAVAREA {warning.navArea}/{warning.subregion}
                    </span>
                </div>
                {expanded ? <ChevronUp size={10} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={10} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
            {expanded && (
                <div style={{
                    fontSize: '0.46rem', color: 'rgba(255,255,255,0.5)',
                    marginTop: '4px', lineHeight: 1.4,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: '80px', overflow: 'auto'
                }}>
                    {warning.text}
                </div>
            )}
        </div>
    );
};

const MaritimeWarningsPanel = ({ viewMode = 'middleeast' }) => {
    const [expandedId, setExpandedId] = useState(null);
    const fetcher = useCallback(() => fetchNgaWarnings(), []);
    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: 'nga-warnings',
        intervalMs: 30 * 60 * 1000,
        isUsable: (d) => Array.isArray(d?.warnings)
    });

    const warnings = data?.warnings || [];
    const highCount = data?.highThreat || 0;
    const total = data?.total || 0;

    return (
        <div className="bottom-card flex-column">
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Anchor size={14} /> MARITIME WARNINGS
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {highCount > 0 && (
                        <span style={{
                            fontSize: '0.42rem', fontWeight: 700, color: '#ef4444',
                            display: 'flex', alignItems: 'center', gap: '3px'
                        }}>
                            <AlertTriangle size={10} /> {highCount} HIGH
                        </span>
                    )}
                    <span className="live-pill">{total} NGA</span>
                </div>
            </div>
            <DataStatus
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isStale={isStale}
                error={error}
                retryCount={retryCount}
                data={data}
                isEmpty={data && warnings.length === 0}
                emptyMessage={`No active maritime warnings for ${viewMode === 'indopacific' ? 'Indo-Pacific' : viewMode === 'thailand' ? 'Thailand' : 'Middle East'} region`}
                refresh={refresh}
            >
                <div className="panel-content" style={{
                    maxHeight: '200px', overflow: 'auto',
                    padding: '6px',
                    display: 'flex', flexDirection: 'column'
                }}>
                    {warnings.slice(0, 15).map((w) => (
                        <WarningItem
                            key={w.id}
                            warning={w}
                            expanded={expandedId === w.id}
                            onToggle={() => setExpandedId(expandedId === w.id ? null : w.id)}
                        />
                    ))}
                </div>
            </DataStatus>
            <div style={{
                padding: '4px 8px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: '0.4rem',
                color: 'rgba(255,255,255,0.25)',
                textAlign: 'right'
            }}>
                Source: US National Geospatial-Intelligence Agency (NGA)
            </div>
        </div>
    );
};

export default MaritimeWarningsPanel;
