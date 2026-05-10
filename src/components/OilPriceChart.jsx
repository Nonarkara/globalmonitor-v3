import React, { useCallback } from 'react';
import { TrendingUp, Droplets } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const WAR_EVENTS = [
    { date: '2026-02-28', label: 'War starts', color: '#ef4444' },
    { date: '2026-03-04', label: 'Hormuz closed', color: '#f59e0b' },
    { date: '2026-03-08', label: '$100 crossed', color: '#f97316' },
    { date: '2026-03-18', label: 'Peak $126', color: '#dc2626' }
];

const OilPriceChart = () => {
    const fetcher = useCallback(() =>
        fetch(`${API_BASE}/api/oil-prices`).then(r => r.json()), []);

    const { data, isLoading, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: 'oil-prices',
        intervalMs: 30 * 60 * 1000,
        isUsable: (d) => d?.brent?.length > 0
    });

    if (!data?.brent?.length) return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid var(--accent-amber)', paddingLeft: '8px'
            }}>
                <Droplets size={12} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Oil Price</span>
            </div>
            <DataStatus isLoading={isLoading} error={error} retryCount={retryCount} data={data} refresh={refresh}
                isEmpty={!isLoading && !data?.brent?.length} emptyMessage="Awaiting EIA data" />
        </div>
    );

    const brent = data.brent;
    const prices = brent.map(d => d.price);
    const minP = Math.min(...prices) - 5;
    const maxP = Math.max(...prices) + 5;
    const W = 220, H = 100, PAD = 2;

    const toX = (i) => PAD + (i / (brent.length - 1)) * (W - PAD * 2);
    const toY = (p) => PAD + (1 - (p - minP) / (maxP - minP)) * (H - PAD * 2);

    const linePath = brent.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.price).toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L${toX(brent.length - 1).toFixed(1)},${H} L${toX(0).toFixed(1)},${H} Z`;

    const latest = brent[brent.length - 1];
    const first = brent[0];
    const change = ((latest.price - first.price) / first.price * 100).toFixed(1);

    // $100 threshold line
    const y100 = toY(100);

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '6px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #ef4444', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Droplets size={12} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Brent Crude
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: latest.price > 100 ? '#ef4444' : '#f59e0b' }}>
                        ${latest.price.toFixed(1)}
                    </span>
                    <span style={{
                        fontSize: '0.5rem', fontWeight: 700,
                        color: change > 0 ? '#ef4444' : '#22c55e',
                        padding: '1px 5px', borderRadius: '3px',
                        background: change > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'
                    }}>
                        <TrendingUp size={8} style={{ display: 'inline', marginRight: '2px' }} />
                        +{change}%
                    </span>
                </div>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: '120px' }}>
                <defs>
                    <linearGradient id="oilGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* $100 threshold */}
                {y100 > PAD && y100 < H - PAD && (
                    <>
                        <line x1={PAD} y1={y100} x2={W - PAD} y2={y100} stroke="rgba(239,68,68,0.2)" strokeWidth="0.5" strokeDasharray="3,3" />
                        <text x={W - PAD - 1} y={y100 - 2} textAnchor="end" fill="rgba(239,68,68,0.4)" fontSize="5" fontFamily="var(--font-mono)">$100</text>
                    </>
                )}

                {/* Area fill */}
                <path d={areaPath} fill="url(#oilGrad)" />

                {/* Price line */}
                <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Event markers */}
                {WAR_EVENTS.map((evt, ei) => {
                    const idx = brent.findIndex(d => d.date >= evt.date);
                    if (idx < 0) return null;
                    const x = toX(idx), y = toY(brent[idx].price);
                    return (
                        <g key={ei}>
                            <line x1={x} y1={y} x2={x} y2={H} stroke={evt.color} strokeWidth="0.4" strokeDasharray="2,2" opacity="0.5" />
                            <circle cx={x} cy={y} r="2.5" fill={evt.color} stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" />
                            <text x={x} y={H - 2} textAnchor="middle" fill={evt.color} fontSize="3.5" fontFamily="var(--font-mono)" opacity="0.8">
                                {evt.label}
                            </text>
                        </g>
                    );
                })}

                {/* Latest price dot */}
                <circle cx={toX(brent.length - 1)} cy={toY(latest.price)} r="3" fill="#ef4444" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8">
                    <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
                </circle>
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>Feb 27</span>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>War premium: $14-18/bbl</span>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>Mar 29</span>
            </div>
        </div>
    );
};

export default OilPriceChart;
