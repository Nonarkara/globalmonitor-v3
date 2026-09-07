import React, { useCallback, useMemo, useState } from 'react';
import { Crosshair, Skull, Zap, Users, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';
import { WAR_START } from '../data/warConstants';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8802' : '';

const KPI = ({ icon, label, value, color, sub }) => (
    <div style={{
        padding: '6px 8px', borderRadius: 0,
        background: 'transparent',
        border: '1px solid var(--line)',
        textAlign: 'center'
    }}>
        {React.createElement(icon, { size: 10, style: { color, marginBottom: '2px' } })}
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
        <div style={{ fontSize: '0.45rem', color: 'var(--ink-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.4rem', color: 'var(--ink-3)', marginTop: '1px' }}>{sub}</div>}
    </div>
);

const MiniBar = ({ items, maxVal }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map(({ label, count, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.42rem', color: 'var(--ink-3)', width: '55px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: '6px', background: '#f2f0ea', borderRadius: 0, overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.max((count / maxVal) * 100, 3)}%`,
                        height: '100%', borderRadius: 0,
                        background: color
                    }} />
                </div>
                <span style={{ fontSize: '0.42rem', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', width: '14px' }}>{count}</span>
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
                color: label.includes('Explosion') ? 'var(--fill-1)' : label.includes('Battle') ? 'var(--fill-2)' : label.includes('Violence') ? 'var(--fill-3)' : 'var(--fill-4)'
            }));

        // By country
        const byCountry = {};
        events.forEach(e => { byCountry[e.country] = (byCountry[e.country] || 0) + 1; });
        const countryItems = Object.entries(byCountry)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, count]) => ({ label, count, color: 'var(--ink-2)' }));

        // Actor frequency (top 8)
        const actorCounts = {};
        events.forEach(e => { if (e.actor1) actorCounts[e.actor1] = (actorCounts[e.actor1] || 0) + 1; });
        const actorItems = Object.entries(actorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, count]) => ({
                label: label.length > 20 ? label.substring(0, 18) + '…' : label,
                count,
                color: 'var(--ink)'
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

    // Demo unless the payload itself says ACLED produced it. Curated events
    // must never wear the same badge as a live feed.
    const isDemo = Boolean(data) && data.source !== 'acled';

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid var(--line)',
                borderLeft: '2px solid var(--ink)', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Crosshair size={12} style={{ color: 'var(--ink-2)' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink)' }}>
                        Conflict Analytics
                    </span>
                </div>
                <span style={{ fontSize: '0.45rem', color: isDemo ? 'var(--red)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    {isDemo ? 'DEMO — NOT ACLED' : 'ACLED · LIVE'} · {viewMode.toUpperCase()}
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
                isDemo={isDemo}
                demoLabel="DEMO — NO ACLED KEY"
            >
                {analysis && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '8px' }}>
                            {/* The window is whatever the API actually queried — never a
                                caption the code does not enforce. `since` comes back on
                                every payload; demo payloads carry the curated set's date. */}
                            <KPI icon={Zap} label="Events" value={analysis.totalEvents} color="var(--ink)" sub={data?.since ? `since ${data.since}` : '—'} />
                            <KPI icon={Skull} label="Fatalities" value={analysis.totalFatalities} color="var(--red)" sub="reported" />
                            <KPI icon={Users} label="Actors" value={analysis.actors.size} color="var(--ink-2)" sub="unique" />
                        </div>

                        {/* Cumulative trend charts — never draw a trajectory from a demo set */}
                        {showTrend && !isDemo && analysis.cumulativeFatalities.length > 1 && (
                            <div style={{
                                marginBottom: '8px', padding: '6px 8px',
                                background: '#f2f0ea', borderRadius: 0
                            }}>
                                <div style={{ fontSize: '0.4rem', color: 'var(--ink-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                                    Cumulative Trend
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <CumulativeChart data={analysis.cumulativeEvents} color="var(--ink-2)" />
                                        <div style={{ fontSize: '0.35rem', color: 'var(--ink-3)', marginTop: '2px' }}>Events</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <CumulativeChart data={analysis.cumulativeFatalities} color="var(--red)" />
                                        <div style={{ fontSize: '0.35rem', color: 'var(--ink-3)', marginTop: '2px' }}>Fatalities</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.45rem', color: 'var(--ink-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>By Type</div>
                            <MiniBar items={analysis.typeItems} maxVal={analysis.maxType} />
                        </div>

                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '0.45rem', color: 'var(--ink-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>By Country</div>
                            <MiniBar items={analysis.countryItems} maxVal={analysis.maxCountry} />
                        </div>

                        {/* Actor ranking - collapsible */}
                        <div>
                            <button
                                onClick={() => setShowActors(!showActors)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--ink-3)', fontSize: '0.45rem',
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
