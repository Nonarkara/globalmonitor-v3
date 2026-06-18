import React, { useCallback } from 'react';
import { fetchEscalation } from '../services/escalation';
import { useLiveResource } from '../hooks/useLiveResource';

const COLORS = {
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444'
};

const SHELL = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 4px',
    minWidth: '148px',
    minHeight: '32px',
    contain: 'layout'
};

const EscalationGauge = () => {
    const fetcher = useCallback(() => fetchEscalation(), []);
    const { data } = useLiveResource(fetcher, {
        cacheKey: 'escalation',
        intervalMs: 5 * 60 * 1000,
        isUsable: (d) => typeof d?.score === 'number'
    });

    if (!data) {
        return (
            <div style={SHELL}>
                <div style={{ position: 'relative', width: '44px', height: '26px', flexShrink: 0 }}>
                    <svg width="44" height="26" viewBox="0 0 44 26" aria-hidden="true">
                        <path
                            d="M 4 24 A 18 18 0 0 1 40 24"
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                    </svg>
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.95rem',
                        fontWeight: 200,
                        fontFamily: 'var(--font-mono)',
                        color: 'rgba(255,255,255,0.2)',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        —
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '26px' }}>
                    <span style={{
                        fontSize: '0.48rem',
                        fontWeight: 600,
                        letterSpacing: '1.5px',
                        color: 'rgba(255,255,255,0.25)',
                        textTransform: 'uppercase'
                    }}>
                        ESCALATION
                    </span>
                    <div style={{ width: 48, height: 14, marginTop: 2 }} aria-hidden="true" />
                    <div style={{ display: 'flex', gap: 3, marginTop: 2, minHeight: 4 }} aria-hidden="true">
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                </div>
            </div>
        );
    }

    const { score, level, label, history, sourceHealth } = data;
    const color = COLORS[level] || COLORS.amber;

    const radius = 18;
    const circumference = Math.PI * radius;
    const progress = (score / 100) * circumference;

    const sparkline = history?.length > 1 ? (() => {
        const max = Math.max(...history.map(h => h.score), 1);
        const w = 48;
        const h = 14;
        const points = history.map((pt, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - (pt.score / max) * h;
            return `${x},${y}`;
        }).join(' ');
        return (
            <svg width={w} height={h} style={{ display: 'block', marginTop: '2px' }}>
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    opacity="0.5"
                />
            </svg>
        );
    })() : (
        <div style={{ width: 48, height: 14, marginTop: 2 }} aria-hidden="true" />
    );

    const healthKeys = sourceHealth ? Object.keys(sourceHealth) : ['a', 'b', 'c'];

    return (
        <div style={SHELL}>
            <div style={{ position: 'relative', width: '44px', height: '26px', flexShrink: 0 }}>
                <svg width="44" height="26" viewBox="0 0 44 26">
                    <path
                        d="M 4 24 A 18 18 0 0 1 40 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 4 24 A 18 18 0 0 1 40 24"
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={circumference - progress}
                        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
                    />
                </svg>
                <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.95rem',
                    fontWeight: 200,
                    fontFamily: 'var(--font-mono)',
                    color: color,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '2ch',
                    textAlign: 'center',
                    transition: 'color 0.5s ease'
                }}>
                    {score}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '26px' }}>
                <span style={{
                    fontSize: '0.48rem',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: color,
                    textTransform: 'uppercase',
                    opacity: 0.8,
                    transition: 'color 0.5s ease',
                    maxWidth: '9ch',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {label}
                </span>
                {sparkline}
                <div style={{ display: 'flex', gap: '3px', marginTop: '2px', minHeight: 4 }}>
                    {healthKeys.map((key) => {
                        const status = sourceHealth?.[key];
                        const dotColor = status === 'live' ? '#22c55e' : status === 'sample' ? '#f59e0b' : status === 'error' ? '#ef4444' : 'rgba(255,255,255,0.08)';
                        return (
                            <div
                                key={key}
                                title={status ? `${key}: ${status}` : undefined}
                                style={{
                                    width: '4px', height: '4px', borderRadius: '50%',
                                    background: dotColor, opacity: status ? 0.7 : 0.35
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default EscalationGauge;
