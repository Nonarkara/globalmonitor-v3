import React, { useCallback, useMemo } from 'react';
import { Heart, Users, Building2, TrendingUp } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';
import { fetchAcledEvents } from '../services/acled';
import { fetchHumanitarian } from '../services/humanitarian';

const KPI = ({ icon, label, value, color, sub }) => (
    <div style={{
        padding: '6px 8px', borderRadius: 0,
        background: 'transparent',
        border: '1px solid var(--line)',
        textAlign: 'center', flex: 1
    }}>
        {React.createElement(icon, { size: 10, style: { color, marginBottom: '2px' } })}
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
        <div style={{ fontSize: '0.42rem', color: 'var(--ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.38rem', color: 'var(--ink-3)', marginTop: '1px' }}>{sub}</div>}
    </div>
);

// Zero-based: a cumulative series that rises 10 → 12 must not draw as a cliff.
const Sparkline = ({ data, color, width = 160, height = 32 }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data) || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
        const x = i * stepX;
        const y = height - (v / max) * (height - 4) - 2;
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

const API_BASE = import.meta.env.DEV ? 'http://localhost:8802' : '';
const DAY_MS = 86400000;

const HumanitarianPanel = ({ viewMode = 'middleeast' }) => {
    // Go through the service layer so X-Tech-Status / X-Tech-Source reach the
    // hook and demo or fallback payloads get badged instead of read as live.
    const acledFetcher = useCallback(() => fetchAcledEvents(viewMode), [viewMode]);
    const humanFetcher = useCallback(() => fetchHumanitarian(viewMode).catch(() => null), [viewMode]);
    const infraFetcher = useCallback(() =>
        fetch(`${API_BASE}/api/infrastructure`).then(r => r.json()).catch(() => null), []);

    const {
        data: acledData, isLoading, isRefreshing, isStale, error, retryCount, refresh, isSample: acledIsSample
    } = useLiveResource(acledFetcher, {
        cacheKey: `humanitarian-acled:${viewMode}`,
        intervalMs: 10 * 60 * 1000,
        isUsable: (d) => d?.features?.length > 0
    });

    const { data: humanData, isStale: humanIsStale } = useLiveResource(humanFetcher, {
        cacheKey: `humanitarian-unhcr:${viewMode}`,
        intervalMs: 30 * 60 * 1000,
        isUsable: (d) => d != null
    });

    const { data: infraData } = useLiveResource(infraFetcher, {
        cacheKey: 'humanitarian-infra',
        intervalMs: 15 * 60 * 1000,
        isUsable: (d) => d != null
    });

    // Demo unless the payload itself says ACLED produced it.
    const isDemo = Boolean(acledData) && (acledIsSample || acledData.source !== 'acled');

    const { totalFatalities, cumulativeData, displacedCount, damagedCount, fatalitiesPerDay, windowDays } = useMemo(() => {
        const events = acledData?.features?.map(f => f.properties) || [];
        const total = events.reduce((s, e) => s + (e.fatalities || 0), 0);

        // The window is the span of the events actually returned — never the
        // length of the war. A 30-day sum divided by 185 war days printed "~0".
        const dates = events.map(e => e.date).filter(Boolean).sort();
        const span = dates.length > 1
            ? Math.max(1, Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / DAY_MS))
            : null;

        // Group fatalities by date for cumulative sparkline
        const byDate = {};
        events.forEach(e => {
            if (e.date) byDate[e.date] = (byDate[e.date] || 0) + (e.fatalities || 0);
        });
        const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
        const cumulative = sorted.reduce((acc, [, count]) => [
            ...acc,
            (acc[acc.length - 1] || 0) + count
        ], []);

        // Displaced comes only from UNHCR's own total. No estimator: the old
        // `features.length * 12000` invented a displacement figure from a
        // row count and printed it under a UNHCR attribution.
        const displaced = typeof humanData?.totalDisplaced === 'number' ? humanData.totalDisplaced : null;

        // Damaged infrastructure
        const damaged = infraData?.facilities?.filter(f =>
            f.warStatus === 'damaged' || f.warStatus === 'closed' || f.warStatus === 'destroyed'
        ).length || infraData?.damagedCount || null;

        return {
            totalFatalities: total,
            cumulativeData: cumulative,
            displacedCount: displaced,
            damagedCount: damaged,
            windowDays: span,
            fatalitiesPerDay: total > 0 && span ? Math.round(total / span) : null
        };
    }, [acledData, humanData, infraData]);

    const formatNumber = (n) => {
        if (n == null) return '—';
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toLocaleString();
    };

    const acledLabel = isDemo ? 'DEMO — NOT ACLED' : 'ACLED';
    const unhcrLabel = humanData?.year ? `UNHCR ${humanData.year}` : 'UNHCR';

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid var(--line)',
                borderLeft: '2px solid var(--ink)', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Heart size={12} style={{ color: 'var(--ink-2)' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink)' }}>
                        Humanitarian Impact
                    </span>
                </div>
                <span style={{ fontSize: '0.42rem', color: isDemo ? 'var(--red)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {acledLabel} + {unhcrLabel} · {viewMode.toUpperCase()}
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
                isDemo={isDemo}
                demoLabel="DEMO — NO ACLED KEY"
            >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    <KPI
                        icon={Users}
                        label="Fatalities"
                        value={formatNumber(totalFatalities)}
                        color="var(--red)"
                        sub={isDemo ? 'demo set' : windowDays ? `reported · ${windowDays}d window` : 'reported'}
                    />
                    <KPI
                        icon={Users}
                        label="Displaced"
                        value={formatNumber(displacedCount)}
                        color="var(--ink)"
                        sub={displacedCount == null ? 'no UNHCR rows' : `${unhcrLabel}${humanIsStale ? ' · stale' : ''}`}
                    />
                    <KPI icon={Building2} label="Facilities" value={damagedCount != null ? damagedCount : '—'} color="var(--red)" sub="damaged" />
                </div>

                {/* Cumulative fatalities sparkline — never drawn from a demo set */}
                {!isDemo && cumulativeData.length > 1 && (
                    <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.42rem', color: 'var(--ink-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Cumulative Fatalities · running total, always rises
                        </div>
                        <div style={{
                            background: '#f2f0ea',
                            borderRadius: 0,
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Sparkline data={cumulativeData} color="var(--red)" width={140} height={28} />
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                                    {totalFatalities.toLocaleString()}
                                </div>
                                <div style={{ fontSize: '0.36rem', color: 'var(--ink-3)' }}>total · {windowDays}d</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Trend indicator */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 8px',
                    background: 'transparent',
                    borderRadius: 0,
                    border: '1px solid var(--line)'
                }}>
                    <TrendingUp size={10} style={{ color: 'var(--red)' }} />
                    <span style={{ fontSize: '0.42rem', color: 'var(--ink-2)' }}>
                        {isDemo
                            ? 'Demo events — no live ACLED feed configured'
                            : fatalitiesPerDay != null
                                ? `~${fatalitiesPerDay} fatalities/day over the last ${windowDays} days`
                                : 'Monitoring conflict casualties'}
                    </span>
                </div>
            </DataStatus>
        </div>
    );
};

export default HumanitarianPanel;
