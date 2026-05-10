import React, { useCallback, useMemo } from 'react';
import { Heart, Users, Building2, TrendingUp } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';
import { getDayCount } from '../data/warConstants';

const KPI = ({ icon, label, value, color, sub }) => (
    <div style={{
        padding: '6px 8px', borderRadius: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center', flex: 1
    }}>
        {React.createElement(icon, { size: 10, style: { color, marginBottom: '2px' } })}
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
        <div style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>{sub}</div>}
    </div>
);

const Sparkline = ({ data, color, width = 160, height = 32 }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    });

    const areaPoints = `0,${height} ${points.join(' ')} ${width},${height}`;

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polygon points={areaPoints} fill={`${color}15`} />
            <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
};

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const HumanitarianPanel = () => {
    const acledFetcher = useCallback(() =>
        fetch(`${API_BASE}/api/acled`).then(r => r.json()), []);
    const humanFetcher = useCallback(() =>
        fetch(`${API_BASE}/api/humanitarian`).then(r => r.json()).catch(() => null), []);
    const infraFetcher = useCallback(() =>
        fetch(`${API_BASE}/api/infrastructure`).then(r => r.json()).catch(() => null), []);

    const { data: acledData, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(acledFetcher, {
        cacheKey: 'humanitarian-acled',
        intervalMs: 10 * 60 * 1000,
        isUsable: (d) => d?.features?.length > 0
    });

    const { data: humanData } = useLiveResource(humanFetcher, {
        cacheKey: 'humanitarian-unhcr',
        intervalMs: 30 * 60 * 1000,
        isUsable: (d) => d != null
    });

    const { data: infraData } = useLiveResource(infraFetcher, {
        cacheKey: 'humanitarian-infra',
        intervalMs: 15 * 60 * 1000,
        isUsable: (d) => d != null
    });

    const { totalFatalities, cumulativeData, displacedCount, damagedCount, fatalitiesPerDay } = useMemo(() => {
        const events = acledData?.features?.map(f => f.properties) || [];
        const total = events.reduce((s, e) => s + (e.fatalities || 0), 0);
        const dayCount = getDayCount();

        // Group fatalities by date for cumulative sparkline
        const byDate = {};
        events.forEach(e => {
            const d = e.eventDate?.split('T')[0] || e.event_date;
            if (d) byDate[d] = (byDate[d] || 0) + (e.fatalities || 0);
        });
        const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
        const cumulative = sorted.reduce((acc, [, count]) => [
            ...acc,
            (acc[acc.length - 1] || 0) + count
        ], []);

        // Displaced from humanitarian data
        const displaced = humanData?.totalDisplaced || humanData?.displaced ||
            (humanData?.features?.length ? humanData.features.length * 12000 : null);

        // Damaged infrastructure
        const damaged = infraData?.facilities?.filter(f =>
            f.warStatus === 'damaged' || f.warStatus === 'closed' || f.warStatus === 'destroyed'
        ).length || infraData?.damagedCount || null;

        return {
            totalFatalities: total,
            cumulativeData: cumulative,
            displacedCount: displaced,
            damagedCount: damaged,
            fatalitiesPerDay: total > 0 ? Math.round(total / Math.max(1, dayCount)) : null
        };
    }, [acledData, humanData, infraData]);

    const formatNumber = (n) => {
        if (n == null) return '—';
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toLocaleString();
    };

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #ec4899', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Heart size={12} style={{ color: '#ec4899' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Humanitarian Impact
                    </span>
                </div>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                    ACLED + UNHCR
                </span>
            </div>

            <DataStatus
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isStale={isStale}
                error={error}
                retryCount={retryCount}
                data={acledData}
                isEmpty={acledData && !acledData.features?.length}
                emptyMessage="No humanitarian data"
                refresh={refresh}
            >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    <KPI icon={Users} label="Fatalities" value={formatNumber(totalFatalities)} color="#ef4444" sub="confirmed" />
                    <KPI icon={Users} label="Displaced" value={formatNumber(displacedCount)} color="#f59e0b" sub="estimated" />
                    <KPI icon={Building2} label="Facilities" value={damagedCount != null ? damagedCount : '—'} color="#f97316" sub="damaged" />
                </div>

                {/* Cumulative fatalities sparkline */}
                {cumulativeData.length > 1 && (
                    <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Cumulative Fatalities
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Sparkline data={cumulativeData} color="#ef4444" width={140} height={28} />
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
                                    {totalFatalities.toLocaleString()}
                                </div>
                                <div style={{ fontSize: '0.36rem', color: 'rgba(255,255,255,0.3)' }}>total</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Trend indicator */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 8px',
                    background: 'rgba(239,68,68,0.06)',
                    borderRadius: '4px',
                    border: '1px solid rgba(239,68,68,0.1)'
                }}>
                    <TrendingUp size={10} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.5)' }}>
                        {fatalitiesPerDay != null
                            ? `~${fatalitiesPerDay} fatalities/day avg`
                            : 'Monitoring conflict casualties'}
                    </span>
                </div>
            </DataStatus>
        </div>
    );
};

export default HumanitarianPanel;
