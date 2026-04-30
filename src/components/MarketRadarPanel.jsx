import React, { useCallback } from 'react';
import { fetchMarketRadar } from '../services/marketData';
import { Activity, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';

const CATEGORIES = [
    { label: 'COMMODITIES', match: (s) => s?.includes && (s.includes('Gold') || s.includes('Silver') || s.includes('Oil') || s.includes('Crude')) },
    { label: 'INDICES', match: (s) => s?.startsWith && (s.startsWith('S&P') || s.startsWith('TASI') || s.startsWith('TA-125')) },
    { label: 'CRYPTO', match: (s) => s && ['BTC', 'ETH'].includes(s) },
    { label: 'FX RATES', match: (s) => s?.includes && s.includes('/') },
];

const categorize = (items) => {
    const groups = CATEGORIES.map((cat) => ({
        label: cat.label,
        items: items.filter((item) => cat.match(item.symbol))
    }));
    const matched = new Set(groups.flatMap((g) => g.items.map((i) => i.symbol)));
    const rest = items.filter((item) => !matched.has(item.symbol));
    if (rest.length > 0) groups.push({ label: 'OTHER', items: rest });
    return groups.filter((g) => g.items.length > 0);
};

const OIL_THRESHOLDS = [
    { price: 200, label: '$200', level: 'EXTREME', color: '#dc2626' },
    { price: 150, label: '$150', level: 'CRITICAL', color: '#ef4444' },
    { price: 100, label: '$100', level: 'HIGH', color: '#f59e0b' },
    { price: 80, label: '$80', level: 'ELEVATED', color: '#eab308' },
];

const OilCrisisHeader = ({ items }) => {
    const oilItem = items.find(i => i.symbol?.includes('Brent') || i.symbol?.includes('Crude') || i.symbol?.includes('Oil'));
    if (!oilItem) return null;

    const price = parseFloat(String(oilItem.price).replace(/[^0-9.]/g, ''));
    if (!price || price < 80) return null;

    const currentThreshold = OIL_THRESHOLDS.find(t => price >= t.price) || OIL_THRESHOLDS[OIL_THRESHOLDS.length - 1];
    const maxPrice = 220;
    const pctPosition = Math.min(100, (price / maxPrice) * 100);

    // Estimate supply disruption based on price level
    const disruption = price >= 150 ? 20 : price >= 100 ? 12 : price >= 80 ? 5 : 0;

    return (
        <div style={{
            background: `${currentThreshold.color}10`,
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '6px',
            border: `1px solid ${currentThreshold.color}25`
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                        fontSize: '0.42rem', fontWeight: 700, letterSpacing: '1px',
                        color: currentThreshold.color, textTransform: 'uppercase',
                        padding: '1px 5px', background: `${currentThreshold.color}20`, borderRadius: '3px'
                    }}>
                        OIL CRISIS — {currentThreshold.level}
                    </span>
                </div>
                <span style={{
                    fontSize: '0.44rem', color: 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-mono)'
                }}>
                    ~{disruption}% supply disrupted
                </span>
            </div>

            {/* Price threshold bar */}
            <div style={{ position: 'relative', height: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pctPosition}%`,
                    background: `linear-gradient(90deg, #22c55e 0%, #eab308 36%, #f59e0b 45%, #ef4444 68%, #dc2626 90%)`,
                    borderRadius: '6px',
                    transition: 'width 1s ease'
                }} />
                {/* Threshold markers */}
                {OIL_THRESHOLDS.slice().reverse().map((t) => (
                    <div key={t.price} style={{
                        position: 'absolute',
                        left: `${(t.price / maxPrice) * 100}%`,
                        top: 0, bottom: 0,
                        width: '1px',
                        background: 'rgba(255,255,255,0.2)'
                    }}>
                        <span style={{
                            position: 'absolute', top: '-11px', transform: 'translateX(-50%)',
                            fontSize: '0.36rem', color: 'rgba(255,255,255,0.3)',
                            fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap'
                        }}>
                            {t.label}
                        </span>
                    </div>
                ))}
                {/* Current price marker */}
                <div style={{
                    position: 'absolute',
                    left: `${pctPosition}%`,
                    top: '-2px', bottom: '-2px',
                    width: '3px',
                    background: 'white',
                    borderRadius: '2px',
                    boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                    transform: 'translateX(-50%)'
                }} />
            </div>
            <div style={{
                fontSize: '0.44rem', color: 'rgba(255,255,255,0.35)',
                marginTop: '4px', fontFamily: 'var(--font-mono)', textAlign: 'right'
            }}>
                {oilItem.symbol}: ${price.toFixed(2)} ({oilItem.changePerc})
            </div>
        </div>
    );
};

const MarketRadarPanel = ({ viewMode = 'middleeast' }) => {
    const fetcher = useCallback(() => fetchMarketRadar(), []);
    const {
        data: markets = [],
        lastUpdated,
        isRefreshing,
        isLoading,
        isStale,
        error,
        refresh
    } = useLiveResource(fetcher, {
        cacheKey: 'market-radar',
        intervalMs: 60000,
        isUsable: (items) => Array.isArray(items) && items.length > 0
    });
    const safeMarkets = markets || [];
    const statusLabel = isStale ? 'STALE' : (error && safeMarkets.length === 0 ? 'OFFLINE' : 'LIVE');
    const groups = categorize(safeMarkets);

    return (
        <div className="bottom-card flex-column">
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={14} /> MARKET RADAR
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={refresh}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                        title="Refresh market data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                    </button>
                    <span className={`live-pill ${statusLabel !== 'LIVE' ? 'live-pill-muted' : ''}`}>{statusLabel}</span>
                </div>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Oil Crisis Header — Middle East only; oil is the ME-war story.
                    Outside ME, surfacing it overweights Iran/Gulf and misleads. */}
                {viewMode === 'middleeast' && safeMarkets.length > 0 && <OilCrisisHeader items={safeMarkets} />}
                <div className="panel-lead" style={{ marginBottom: 0, fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.3px' }}>
                    {lastUpdated ? `Last update ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first live quote...'}
                </div>
                <div className="radar-groups">
                    {groups.map((group) => (
                        <div key={group.label} className="radar-group">
                            <div className="radar-group-label">{group.label}</div>
                            <ul className="radar-list">
                                {group.items.map((item, index) => (
                                    <li key={index} className="radar-item">
                                        <div className="radar-token">
                                            <strong>{item.symbol}</strong>
                                        </div>
                                        <div className="radar-price">
                                            <span>{item.price}</span>
                                            <span className={`change ${item.isPositive ? 'positive' : 'negative'}`}>
                                                {item.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {item.changePerc}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {safeMarkets.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            {isLoading ? 'Connecting to live markets...' : 'No live market data available right now.'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketRadarPanel;
