import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import warEconomy from '../data/warEconomy.json';
import { WAR_START, getDayCount } from '../data/warConstants';

const getCurrentTime = () => Date.now();

const WarCostTracker = () => {
    const [now, setNow] = useState(getCurrentTime);

    // Tick every 5 seconds for live cost counter
    useEffect(() => {
        const t = setInterval(() => setNow(getCurrentTime()), 5000);
        return () => clearInterval(t);
    }, []);

    const dayCount = getDayCount();
    const maxCat = Math.max(...warEconomy.categories.map(c => c.estimateTotal));

    // Animated cost with millisecond precision
    const elapsedMs = now - WAR_START.getTime();
    const costPerMs = (warEconomy.dailyCostEstimate * 1e6) / 86400000;
    const liveCost = Math.floor(elapsedMs * costPerMs);

    const formatCost = (n) => {
        if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
        if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
        return `$${n.toLocaleString()}`;
    };

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #f59e0b', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={12} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        War Cost Estimate
                    </span>
                </div>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                    DAY {dayCount}
                </span>
            </div>

            {/* Live cost counter */}
            <div style={{
                textAlign: 'center',
                padding: '8px 0',
                marginBottom: '8px',
                background: 'rgba(245,158,11,0.06)',
                borderRadius: '6px',
                border: '1px solid rgba(245,158,11,0.1)'
            }}>
                <div style={{
                    fontSize: '1.3rem',
                    fontWeight: 200,
                    fontFamily: 'var(--font-mono)',
                    color: '#f59e0b',
                    lineHeight: 1,
                    letterSpacing: '-0.5px'
                }}>
                    {formatCost(liveCost)}
                </div>
                <div style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.35)', marginTop: '3px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Estimated Total Cost
                </div>
                <div style={{ fontSize: '0.42rem', color: 'rgba(245,158,11,0.6)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                    ~${warEconomy.dailyCostEstimate}M / day
                </div>
            </div>

            {/* Category breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {warEconomy.categories.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            fontSize: '0.4rem', color: 'rgba(255,255,255,0.45)',
                            width: '60px', textAlign: 'right', flexShrink: 0
                        }}>
                            {cat.label}
                        </span>
                        <div style={{
                            flex: 1, height: '6px',
                            background: 'rgba(255,255,255,0.04)',
                            borderRadius: '3px', overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.max((cat.estimateTotal / maxCat) * 100, 3)}%`,
                                height: '100%', borderRadius: '3px',
                                background: cat.color,
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                        <span style={{
                            fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)',
                            fontFamily: 'var(--font-mono)', width: '32px'
                        }}>
                            ${(cat.estimateTotal / 1000).toFixed(1)}B
                        </span>
                    </div>
                ))}
            </div>

            {/* GDP impact */}
            <div style={{
                display: 'flex', gap: '6px', marginTop: '8px',
                padding: '4px 0',
                borderTop: '1px solid rgba(255,255,255,0.04)'
            }}>
                {Object.entries(warEconomy.gdpImpact).map(([country, pct]) => (
                    <div key={country} style={{
                        flex: 1, textAlign: 'center',
                        padding: '2px 0'
                    }}>
                        <div style={{
                            fontSize: '0.6rem', fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: pct < -5 ? '#ef4444' : pct < -2 ? '#f59e0b' : '#f97316'
                        }}>
                            {pct}%
                        </div>
                        <div style={{
                            fontSize: '0.35rem', color: 'rgba(255,255,255,0.35)',
                            textTransform: 'capitalize', letterSpacing: '0.3px'
                        }}>
                            {country} GDP
                        </div>
                    </div>
                ))}
            </div>

            {/* Source note */}
            <div style={{
                fontSize: '0.32rem', color: 'rgba(255,255,255,0.2)',
                marginTop: '4px', lineHeight: 1.3, fontStyle: 'italic'
            }}>
                {warEconomy.sources}
            </div>
        </div>
    );
};

export default WarCostTracker;
