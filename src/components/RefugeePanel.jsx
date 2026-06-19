import React from 'react';
import { Users, TrendingUp } from 'lucide-react';
import refugeeData from '../data/refugeeData.json';

const Sparkline = ({ data, color, width = 120, height = 28 }) => {
    if (!data || data.length < 2) return null;
    const vals = data.map(d => d.cumulative);
    const max = Math.max(...vals);
    const stepX = width / (vals.length - 1);
    const points = vals.map((v, i) => `${i * stepX},${height - (v / max) * (height - 4) - 2}`);
    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={`${color}12`} />
            <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
};

const formatNum = (n) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
    return n.toLocaleString();
};

const REGION_FALLBACK = {
    indopacific: {
        totalDisplaced: 1_450_000,
        internallyDisplaced: 980_000,
        crossBorderRefugees: 470_000,
        countries: [
            { name: 'Myanmar', count: 1_200_000, color: '#ef4444' },
            { name: 'Afghanistan', count: 180_000, color: '#f97316' },
            { name: 'Sri Lanka', count: 40_000, color: '#f59e0b' },
            { name: 'Bangladesh', count: 20_000, color: '#3b82f6' },
            { name: 'Thailand', count: 10_000, color: '#22c55e' }
        ],
        timeline: [
            { cumulative: 1_300_000 }, { cumulative: 1_340_000 },
            { cumulative: 1_390_000 }, { cumulative: 1_420_000 }, { cumulative: 1_450_000 }
        ],
        aidResponse: { unhcrFundingGap: '62%', corridorsOpen: 3, corridorsBlocked: 5 }
    },
    thailand: {
        totalDisplaced: 120_000,
        internallyDisplaced: 45_000,
        crossBorderRefugees: 75_000,
        countries: [
            { name: 'Myanmar', count: 95_000, color: '#ef4444' },
            { name: 'Thailand (IDP)', count: 20_000, color: '#f97316' },
            { name: 'Cambodia', count: 3_000, color: '#f59e0b' },
            { name: 'Laos', count: 1_500, color: '#3b82f6' },
            { name: 'Others', count: 500, color: '#22c55e' }
        ],
        timeline: [
            { cumulative: 95_000 }, { cumulative: 102_000 },
            { cumulative: 110_000 }, { cumulative: 116_000 }, { cumulative: 120_000 }
        ],
        aidResponse: { unhcrFundingGap: '41%', corridorsOpen: 2, corridorsBlocked: 1 }
    }
};

const RefugeePanel = ({ viewMode = 'middleeast' }) => {
    const data = viewMode === 'middleeast' ? refugeeData : (REGION_FALLBACK[viewMode] || REGION_FALLBACK.indopacific);
    const maxCount = Math.max(...data.countries.map(c => c.count));

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #f472b6', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={12} style={{ color: '#f472b6' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Displacement Tracker
                    </span>
                </div>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                    UNHCR + IOM · {viewMode === 'middleeast' ? 'MIDDLE EAST' : viewMode === 'thailand' ? 'THAILAND' : 'INDO-PACIFIC'}
                </span>
            </div>

            {/* Headline number */}
            <div style={{
                textAlign: 'center', padding: '6px 0', marginBottom: '6px',
                background: 'rgba(244,114,182,0.06)', borderRadius: '6px',
                border: '1px solid rgba(244,114,182,0.1)'
            }}>
                <div style={{
                    fontSize: '1.2rem', fontWeight: 200, fontFamily: 'var(--font-mono)',
                    color: '#f472b6', lineHeight: 1
                }}>
                    {formatNum(data.totalDisplaced)}
                </div>
                <div style={{ fontSize: '0.36rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    Total Displaced Persons
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{formatNum(data.internallyDisplaced)}</div>
                    <div style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Internal</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f97316', fontFamily: 'var(--font-mono)' }}>{formatNum(data.crossBorderRefugees)}</div>
                    <div style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Cross-border</div>
                </div>
            </div>

            {/* Displacement sparkline */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '4px 6px', marginBottom: '6px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '4px'
            }}>
                <Sparkline data={data.timeline} color="#f472b6" />
                <div style={{ textAlign: 'right' }}>
                    <TrendingUp size={8} style={{ color: '#f472b6', marginBottom: '1px' }} />
                    <div style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.3)' }}>5-week trend</div>
                </div>
            </div>

            {/* Country breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {data.countries.slice(0, 5).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.4)', width: '50px', textAlign: 'right', flexShrink: 0 }}>{c.name}</span>
                        <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.max((c.count / maxCount) * 100, 3)}%`,
                                height: '100%', borderRadius: '3px', background: c.color
                            }} />
                        </div>
                        <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', width: '28px' }}>{formatNum(c.count)}</span>
                    </div>
                ))}
            </div>

            {/* Aid status */}
            <div style={{
                display: 'flex', gap: '6px', marginTop: '6px', padding: '3px 0',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: '0.36rem', color: 'rgba(255,255,255,0.3)'
            }}>
                <span>Funding gap: <strong style={{ color: '#ef4444' }}>{data.aidResponse.unhcrFundingGap}</strong></span>
                <span>Corridors: <strong style={{ color: '#22c55e' }}>{data.aidResponse.corridorsOpen}</strong>/<strong style={{ color: '#ef4444' }}>{data.aidResponse.corridorsBlocked}</strong></span>
            </div>
        </div>
    );
};

export default RefugeePanel;
