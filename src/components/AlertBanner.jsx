import React, { useState, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { fetchEscalation } from '../services/escalation';
import { useLiveResource } from '../hooks/useLiveResource';

const AlertBanner = ({ compact = false }) => {
    const [dismissed, setDismissed] = useState(false);
    const fetcher = useCallback(() => fetchEscalation(), []);
    const { data, error } = useLiveResource(fetcher, {
        cacheKey: 'escalation-alert',
        intervalMs: 5 * 60 * 1000,
        isUsable: (d) => typeof d?.score === 'number'
    });

    if (dismissed) return null;
    if (!data && !error) return null;
    if (!data && error) return null;

    const { score, components } = data;
    if (score < 50) return null;

    const isCritical = score >= 70;
    const bgColor = 'var(--panel)';
    const borderColor = isCritical
        ? 'var(--red)'
        : 'var(--line-2)';
    const textColor = isCritical ? 'var(--red)' : 'var(--ink-2)';

    // Find dominant contributing factor
    const factors = [];
    if (components) {
        if (components.firms > 10) factors.push('thermal anomalies');
        if (components.news > 10) factors.push('intelligence signals');
        if (components.market > 10) factors.push('market volatility');
        if (components.strikes > 10) factors.push('strike activity');
    }

    return (
        <div className={compact ? 'preview-alert' : undefined} role="status" style={{
            position: compact ? 'static' : 'fixed',
            top: 18,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: bgColor,
            borderBottom: `1px solid ${borderColor}`,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: isCritical && !compact ? 'alert-pulse 3s ease-in-out infinite' : 'none'
        }}>
            <AlertTriangle size={14} style={{ color: textColor, flexShrink: 0 }} />
            <span style={{
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '1.5px',
                color: textColor,
                textTransform: 'uppercase'
            }}>
                {isCritical ? 'CRITICAL ESCALATION' : 'ELEVATED THREAT'} — SCORE {score}/100
            </span>
            {!compact && factors.length > 0 && (
                <span style={{
                    fontSize: '0.5rem',
                    color: 'var(--ink-3)',
                    letterSpacing: '0.3px'
                }}>
                    Driven by {factors.join(', ')}
                </span>
            )}
            <button
                type="button"
                aria-label="Dismiss escalation alert"
                onClick={() => setDismissed(true)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-3)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    marginLeft: 'auto'
                }}
            >
                <X size={14} />
            </button>
        </div>
    );
};

export default AlertBanner;
