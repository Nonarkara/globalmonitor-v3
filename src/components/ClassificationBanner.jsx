import React, { memo } from 'react';

/**
 * Classification Banner — RAMS status tag block at top and bottom of viewport.
 * Black ink tag + paper text per RAMS status banner pattern.
 */

const LEVELS = {
    UNCLASSIFIED: { label: 'UNCLASSIFIED' },
    CUI: { label: 'CUI // CONTROLLED UNCLASSIFIED INFORMATION' },
    FOUO: { label: 'UNCLASSIFIED // FOR OFFICIAL USE ONLY' },
    CONFIDENTIAL: { label: 'CONFIDENTIAL' },
    SECRET: { label: 'SECRET' },
    TOPSECRET: { label: 'TOP SECRET' }
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
        background: 'var(--ink)',
        color: 'var(--paper)',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.18em',
        fontFamily: 'var(--font-sans)',
        zIndex: 99999,
        textTransform: 'uppercase',
        userSelect: 'none',
        pointerEvents: 'none',
        borderBottom: '1px solid var(--line-2)',
    };

    const bottomStyle = {
        ...bannerStyle,
        borderBottom: 'none',
        borderTop: '1px solid var(--line-2)',
    };

    return (
        <>
            <div style={{ ...bannerStyle, top: 0 }}>
                {config.label}
            </div>
            <div style={{ ...bottomStyle, bottom: 0 }}>
                {config.label}
            </div>
        </>
    );
};

export default memo(ClassificationBanner);
