import React, { memo } from 'react';

/**
 * Classification Banner — persistent strip at very top and bottom of viewport.
 * Standard on all government/intelligence dashboards.
 *
 * Levels: UNCLASSIFIED, CUI, FOUO, CONFIDENTIAL, SECRET, TOP SECRET
 */

const LEVELS = {
    UNCLASSIFIED: { bg: '#22c55e', color: '#000', label: 'UNCLASSIFIED' },
    CUI: { bg: '#6366f1', color: '#fff', label: 'CUI // CONTROLLED UNCLASSIFIED INFORMATION' },
    FOUO: { bg: '#3b82f6', color: '#fff', label: 'UNCLASSIFIED // FOR OFFICIAL USE ONLY' },
    CONFIDENTIAL: { bg: '#3b82f6', color: '#fff', label: 'CONFIDENTIAL' },
    SECRET: { bg: '#ef4444', color: '#fff', label: 'SECRET' },
    TOPSECRET: { bg: '#f59e0b', color: '#000', label: 'TOP SECRET' }
};

const ClassificationBanner = ({ level = 'UNCLASSIFIED' }) => {
    const config = LEVELS[level] || LEVELS.UNCLASSIFIED;

    const bannerStyle = {
        position: 'fixed',
        left: 0,
        right: 0,
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: config.bg,
        color: config.color,
        fontSize: '0.55rem',
        fontWeight: 700,
        letterSpacing: '2px',
        fontFamily: 'var(--font-mono)',
        zIndex: 99999,
        textTransform: 'uppercase',
        userSelect: 'none',
        pointerEvents: 'none'
    };

    return (
        <>
            <div style={{ ...bannerStyle, top: 0 }}>
                {config.label}
            </div>
            <div style={{ ...bannerStyle, bottom: 0 }}>
                {config.label}
            </div>
        </>
    );
};

export default memo(ClassificationBanner);
