import React, { useCallback, useMemo, useState } from 'react';
import { Crosshair, Skull, Zap, Users, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';
import { WAR_START } from '../data/warConstants';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const KPI = ({ icon, label, value, color, sub }) => (
    <div style={{
        padding: '6px 8px', borderRadius: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center'
    }}>
        {React.createElement(icon, { size: 10, style: { color, marginBottom: '2px' } })}
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
        <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>{sub}</div>}
    </div>
);

const MiniBar = ({ items, maxVal }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map(({ label, count, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.4)', width: '55px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.max((count / maxVal) * 100, 3)}%`,
                        height: '100%', borderRadius: '3px',
                        background: color
                    }} />
                </div>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', width: '14px' }}>{count}</span>
            </div>
        ))}
    </div>
);

/** Cumulative area sparkline */
const CumulativeChart = ({ data, color, width = 180, height = 36 }) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => `${i * stepX},${height - (v / max) * (height - 4) - 2}`);
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={`${color}12`} />
            <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
};

const AcledAnalytics = ({ viewMode = 'middleeast' }) => {
    const [showActors, setShowActors] = useState(false);
    const showTrend = true;

    const fetcher = useCallback(() =>
        fetch(`${API_BASE}/api/acled?theater=${encodeURIComponent(viewMode)}`).then(r => r.json()), [viewMode]);

    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: `acled-analytics:${viewMode}`,
        intervalMs: 10 * 60 * 1000,
        isUsable: (d) => d?.features?.length > 0
    });

    const analysis = useMemo(() => {
        if (!data?.features?.length) return null;
        const events = data.features.map(f => f.properties);
        const totalEvents = events.length;
        const totalFatalities = events.reduce((s, e) => s + (e.fatalities || 0), 0);
        const actors = new Set(events.map(e => e.actor1));

        // By event type
        const byType = {};
        events.forEach(e => { byType[e.eventType] = (byType[e.eventType] || 0) + 1; });
        const typeItems = Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => ({
                label: label.replace('Explosions/Remote violence', 'Explosions').replace('Violence against civilians', 'Vs Civilians'),
                count,
                color: label.includes('Explosion') ? '#f97316' : label.includes('Battle') ? '#ef4444' : label.includes('Violence') ? '#dc2626' : '#3b82f6'
            }));

        // By country
        const byCountry = {};
        events.forEach(e => { byCountry[e.country] = (byCountry[e.country] || 0) + 1; });
        const countryItems = Object.entries(byCountry)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, count]) => ({ label, count, color: '#38bdf8' }));

        // Actor frequency (top 8)
        const actorCounts = {};
        events.forEach(e => { if (e.actor1) actorCounts[e.actor1] = (actorCounts[e.actor1] || 0) + 1; });
        const actorItems = Object.entries(actorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, count]) => ({
                label: label.length > 20 ? label.substring(0, 18) + '…' : label,
                count,
                color: '#a78bfa'
            }));

        // Cumulative fatalities by date
        const byDate = {};
        events.forEach(e => {
            const d = e.eventDate?.split('T')[0] || e.event_date;
            if (d) {
                byDate[d] = byDate[d] || { events: 0, fatalities: 0 };
                byDate[d].events += 1;
                byDate[d].fatalities += (e.fatalities || 0);
            }
        });
        const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
        let runFatal = 0, runEvents = 0;
        const cumulativeFatalities = sorted.map(([, v]) => { runFatal += v.fatalities; return runFatal; });
        const cumulativeEvents = sorted.map(([, v]) => { runEvents += v.events; return runEvents; });

        return {
            totalEvents, totalFatalities, actors, typeItems, countryItems, actorItems,
            cumulativeFatalities, cumulativeEvents,
            maxType: Math.max(...typeItems.map(t => t.count)),
            maxCountry: Math.max(...countryItems.map(c => c.count)),
            maxActor: actorItems.length ? Math.max(...actorItems.map(a => a.count)) : 1,
            source: data.source
        };
    }, [data]);

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #f97316', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Crosshair size={12} style={{ color: '#f97316' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Conflict Analytics
                    </span>
                </div>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                    ACLED · {analysis?.source === 'acled' ? 'LIVE' : 'CURATED'} · {viewMode.toUpperCase()}
                </span>
            </div>

            <DataStatus
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                isStale={isStale}
                error={error}
                retryCount={retryCount}
                data={data}
                isEmpty={data && !data.features?.length}
                emptyMessage="No conflict data"
                refresh={refresh}
            >
                {analysis && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '8px' }}>
                            <KPI icon={Zap} label="Events" value={analysis.totalEvents} color="#f97316" sub="since war start" />
                            <KPI icon={Skull} label="Fatalities" value={analysis.totalFatalities} color="#ef4444" sub="confirmed" />
                            <KPI icon={Users} label="Actors" value={analysis.actors.size} color="#3b82f6" sub="unique" />
                        </div>

                        {/* Cumulative trend charts */}
                        {showTrend && analysis.cumulativeFatalities.length > 1 && (
                            <div style={{
                                marginBottom: '8px', padding: '6px 8px',
                                background: 'rgba(255,255,255,0.03)', borderRadius: '6px'
                            }}>
                                <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                                    Cumulative Trend
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <CumulativeChart data={analysis.cumulativeEvents} color="#f97316" />
                                        <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Events</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <CumulativeChart data={analysis.cumulativeFatalities} color="#ef4444" />
                                        <div style={{ fontSize: '0.35rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Fatalities</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>By Type</div>
                            <MiniBar items={analysis.typeItems} maxVal={analysis.maxType} />
                        </div>

                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>By Country</div>
                            <MiniBar items={analysis.countryItems} maxVal={analysis.maxCountry} />
                        </div>

                        {/* Actor ranking - collapsible */}
                        <div>
                            <button
                                onClick={() => setShowActors(!showActors)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.35)', fontSize: '0.45rem',
                                    letterSpacing: '0.8px', textTransform: 'uppercase',
                                    padding: 0, marginBottom: '3px', fontFamily: 'inherit'
                                }}
                            >
                                <BarChart3 size={8} />
                                Top Actors
                                {showActors ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                            </button>
                            {showActors && (
                                <MiniBar items={analysis.actorItems} maxVal={analysis.maxActor} />
                            )}
                        </div>
                    </>
                )}
            </DataStatus>
        </div>
    );
};

export default AcledAnalytics;
