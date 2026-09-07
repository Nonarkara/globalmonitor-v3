import React, { useCallback, useEffect, useState } from 'react';
import { fetchEscalation } from '../services/escalation';
import { useLiveResource } from '../hooks/useLiveResource';

const COLORS = {
    green: 'var(--ink)',
    amber: 'var(--ink)',
    red: 'var(--red)'
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

// Stated where the colour is shown, so an arbitrary cutoff becomes a stated convention.
const THRESHOLDS = '0–29 LOW · 30–49 WATCH · 50–69 ELEVATED · 70+ CRITICAL';
const BAND_MAX = { firms: 30, news: 25, markets: 25, briefings: 20 };
const BAND_LABEL = { firms: 'fires', news: 'news', markets: 'markets', briefings: 'strikes' };
const COMPONENT_KEY = { firms: 'firms', news: 'news', markets: 'market', briefings: 'strikes' };

const ageLabel = (iso, nowMs) => {
    if (!iso) return null;
    const mins = Math.round((nowMs - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(mins) || mins < 0) return null;
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.round(hours / 24)}d`;
};

const Arc = ({ color, progress, circumference, dim }) => (
    <svg width="44" height="26" viewBox="0 0 44 26" aria-hidden="true" style={{ opacity: dim ? 0.45 : 1, transition: 'opacity 0.5s ease' }}>
        <path d="M 4 24 A 18 18 0 0 1 40 24" fill="none" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" />
        {progress > 0 && (
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
        )}
    </svg>
);

const HealthDots = ({ sourceHealth }) => {
    const keys = sourceHealth ? Object.keys(sourceHealth) : ['a', 'b', 'c', 'd'];
    return (
        <div style={{ display: 'flex', gap: '3px', marginTop: '2px', minHeight: 5 }}>
            {keys.map((key) => {
                const status = sourceHealth?.[key];
                const dotColor = status === 'live' ? 'var(--green)' : status === 'sample' ? 'var(--ink-2)' : status === 'error' ? 'var(--red)' : 'var(--line-2)';
                return (
                    <div
                        key={key}
                        title={status ? `${BAND_LABEL[key] || key}: ${status}` : undefined}
                        style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, opacity: status ? 0.85 : 0.35 }}
                    />
                );
            })}
        </div>
    );
};

const EscalationGauge = ({ viewMode = 'middleeast' }) => {
    const fetcher = useCallback(() => fetchEscalation(viewMode), [viewMode]);
    const { data, isStale, lastUpdated } = useLiveResource(fetcher, {
        cacheKey: `escalation:${viewMode}`,
        intervalMs: 5 * 60 * 1000,
        // Accept the backend's deliberate NO DATA payload (score: null) so an
        // honest absence replaces a cached score instead of being rejected.
        isUsable: (d) => Boolean(d) && typeof d === 'object' && 'score' in d
    });

    // A clock that ticks in an effect, so age labels are pure during render.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);
    const radius = 18;
    const circumference = Math.PI * radius;
    const age = ageLabel(lastUpdated, nowMs);

    // No payload yet, or the backend reported every band silent.
    if (!data || data.score === null || typeof data.score !== 'number') {
        const silent = Boolean(data) && data.score === null;
        return (
            <div style={SHELL} title={silent ? 'Every input feed was silent — no score is computed from nothing.' : undefined}>
                <div style={{ position: 'relative', width: '44px', height: '26px', flexShrink: 0 }}>
                    <Arc color="var(--line)" progress={0} circumference={circumference} />
                    <div style={{
                        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                        fontSize: '0.95rem', fontWeight: 200, fontFamily: 'var(--font-mono)',
                        color: 'var(--ink-3)', lineHeight: 1, fontVariantNumeric: 'tabular-nums'
                    }}>
                        —
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '26px' }}>
                    <span style={{ fontSize: '0.48rem', fontWeight: 600, letterSpacing: '1.5px', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                        {silent ? 'NO DATA' : 'ESCALATION'}
                    </span>
                    <div style={{ width: 48, height: 14, marginTop: 2 }} aria-hidden="true" />
                    <HealthDots sourceHealth={data?.sourceHealth} />
                </div>
            </div>
        );
    }

    const { score, level, label, history, sourceHealth, components, availableMax } = data;
    const color = COLORS[level] || COLORS.amber;
    const progress = (score / 100) * circumference;
    const partial = typeof availableMax === 'number' && availableMax > 0 && availableMax < 100;

    // Name every band that is not live, in text — a 5px dot is not disclosure.
    const nonLive = sourceHealth
        ? Object.entries(sourceHealth)
            .filter(([, status]) => status !== 'live')
            .map(([key, status]) => `${BAND_LABEL[key] || key}: ${status === 'no-data' ? 'offline' : status}`)
        : [];

    const breakdown = components
        ? Object.keys(BAND_MAX).map((k) => `${BAND_LABEL[k]} ${components[COMPONENT_KEY[k]] ?? 0}/${BAND_MAX[k]}`).join(' · ')
        : '';
    const tooltip = [
        `Escalation index ${score}${partial ? ` of ${availableMax} available` : '/100'}`,
        breakdown,
        THRESHOLDS,
        age ? `updated ${age} ago${isStale ? ' · STALE' : ''}` : null
    ].filter(Boolean).join('\n');

    // Fixed 0–100 scale so the sparkline's shape means what it looks like it means.
    const sparkline = history?.length > 2 ? (() => {
        const w = 48;
        const h = 14;
        const points = history.map((pt, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - (Math.max(0, Math.min(100, pt.score)) / 100) * h;
            return `${x},${y}`;
        }).join(' ');
        return (
            <svg width={w} height={h} style={{ display: 'block', marginTop: '2px' }} aria-hidden="true">
                <polyline points={points} fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
            </svg>
        );
    })() : (
        <div style={{ width: 48, height: 14, marginTop: 2 }} aria-hidden="true" />
    );

    return (
        <div style={SHELL} title={tooltip}>
            <div style={{ position: 'relative', width: '44px', height: '26px', flexShrink: 0 }}>
                <Arc color={color} progress={progress} circumference={circumference} dim={isStale} />
                <div style={{
                    position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '0.95rem', fontWeight: 200, fontFamily: 'var(--font-mono)',
                    color, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                    minWidth: '2ch', textAlign: 'center', transition: 'color 0.5s ease',
                    opacity: isStale ? 0.6 : 1, whiteSpace: 'nowrap'
                }}>
                    {score}
                    {partial && (
                        <span style={{ fontSize: '0.45rem', color: 'var(--ink-3)', marginLeft: 1 }}>/{availableMax}</span>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '26px' }}>
                <span style={{
                    fontSize: '0.48rem',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    color: isStale ? 'var(--ink-3)' : color,
                    textTransform: 'uppercase',
                    opacity: 0.8,
                    transition: 'color 0.5s ease',
                    maxWidth: '9ch',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {label}{isStale ? ' · STALE' : ''}
                </span>
                {sparkline}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <HealthDots sourceHealth={sourceHealth} />
                    {(nonLive.length > 0 || age) && (
                        <span style={{
                            fontSize: '0.38rem', fontFamily: 'var(--font-mono)',
                            color: nonLive.length ? 'var(--ink-2)' : 'var(--ink-3)',
                            letterSpacing: '0.3px', whiteSpace: 'nowrap', maxWidth: '26ch',
                            overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2
                        }}>
                            {nonLive.length ? nonLive.join(' · ') : `${age}`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EscalationGauge;
