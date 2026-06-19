import React, { useCallback, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';
import DataStatus from './DataStatus';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';
const EMPTY_TIMELINE = [];
const CHART_WIDTH = 200;
const CHART_HEIGHT = 60;
const CHART_PAD = 2;

const SentimentChart = ({ viewMode = 'middleeast' }) => {
    const fetcher = useCallback(() =>
        fetch(`${API_BASE}/api/sentiment?theater=${encodeURIComponent(viewMode)}`).then(r => r.json()), [viewMode]);

    const { data, isLoading, isRefreshing, isStale, error, retryCount, refresh } = useLiveResource(fetcher, {
        cacheKey: `gdelt-sentiment:${viewMode}`,
        intervalMs: 30 * 60 * 1000,
        isUsable: (d) => d?.timeline?.length >= 3
    });

    const timeline = data?.timeline || EMPTY_TIMELINE;
    const computed = useMemo(() => {
        if (timeline.length < 3) return null;

        const tones = timeline.map(d => d.tone || 0);
        const minT = Math.min(...tones, -5);
        const maxT = Math.max(...tones, 5);
        const range = Math.max(maxT - minT, 1);
        const toX = (i) => CHART_PAD + (i / (timeline.length - 1)) * (CHART_WIDTH - CHART_PAD * 2);
        const toY = (t) => CHART_PAD + (1 - (t - minT) / range) * (CHART_HEIGHT - CHART_PAD * 2);
        const zeroY = toY(0);
        const linePath = timeline.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.tone || 0).toFixed(1)}`).join(' ');
        const posArea = timeline.map((d, i) => {
            const y = toY(Math.max(d.tone || 0, 0));
            return `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${y.toFixed(1)}`;
        }).join(' ') + ` L${toX(timeline.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
        const negArea = timeline.map((d, i) => {
            const y = toY(Math.min(d.tone || 0, 0));
            return `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${y.toFixed(1)}`;
        }).join(' ') + ` L${toX(timeline.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${toX(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
        const avg = tones.reduce((a, b) => a + b, 0) / tones.length;
        const trendWindow = tones.slice(-5);
        const trend = trendWindow.reduce((a, b) => a + b, 0) / trendWindow.length;
        return {
            tones,
            zeroY,
            linePath,
            posArea,
            negArea,
            avg,
            trend,
            toX,
            toY,
            W: CHART_WIDTH,
            H: CHART_HEIGHT,
            PAD: CHART_PAD
        };
    }, [timeline]);

    if (!computed) return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '8px'
            }}>
                <Activity size={12} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Media Sentiment</span>
            </div>
            <DataStatus isLoading={isLoading} error={error} retryCount={retryCount} data={data} refresh={refresh}
                isRefreshing={isRefreshing} isStale={isStale}
                isEmpty={!isLoading && timeline.length < 3} emptyMessage="Awaiting GDELT data" />
        </div>
    );

    const { tones, zeroY, linePath, posArea, negArea, avg, trend, toX, toY, W, H, PAD } = computed;
    const latest = tones[tones.length - 1];
    const label = trend < -3 ? 'VERY NEGATIVE' : trend < -1 ? 'NEGATIVE' : trend < 1 ? 'NEUTRAL' : 'IMPROVING';
    const labelColor = trend < -3 ? '#ef4444' : trend < -1 ? '#f59e0b' : trend < 1 ? 'rgba(255,255,255,0.5)' : '#22c55e';

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '5px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #3b82f6', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={12} style={{ color: '#3b82f6' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Media Sentiment
                    </span>
                </div>
                <span style={{
                    fontSize: '0.48rem', fontWeight: 700, letterSpacing: '0.8px',
                    color: labelColor,
                    padding: '2px 6px', borderRadius: '3px',
                    background: `${labelColor}18`, border: `1px solid ${labelColor}30`
                }}>
                    {label}
                </span>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: '70px' }}>
                <defs>
                    <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
                    </linearGradient>
                </defs>

                {/* Zero line */}
                <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />

                {/* Positive/Negative fills */}
                <path d={posArea} fill="url(#posGrad)" />
                <path d={negArea} fill="url(#negGrad)" />

                {/* Tone line */}
                <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Latest dot */}
                <circle cx={toX(timeline.length - 1)} cy={toY(latest)} r="2.5" fill={latest < 0 ? '#ef4444' : '#22c55e'} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5">
                    <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                </circle>

                {/* Labels */}
                <text x={W - PAD} y={PAD + 5} textAnchor="end" fill="rgba(34,197,94,0.4)" fontSize="4" fontFamily="var(--font-mono)">+positive</text>
                <text x={W - PAD} y={H - PAD} textAnchor="end" fill="rgba(239,68,68,0.4)" fontSize="4" fontFamily="var(--font-mono)">-negative</text>
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>7-day GDELT tone</span>
                <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>avg: {avg.toFixed(1)}</span>
            </div>
        </div>
    );
};

export default SentimentChart;
