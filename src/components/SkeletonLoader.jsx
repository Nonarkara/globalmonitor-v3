import React from 'react';

/**
 * Skeleton loading state — pulsing placeholder bars.
 * Matches panel layouts for seamless loading transitions.
 * Red Dot: loading states must feel designed, not empty.
 */

const SkeletonLoader = ({ lines = 4, showKpi = false }) => (
    <div style={{ padding: '8px 10px' }}>
        {showKpi && (
            <div className="skeleton-kpi" style={{ marginBottom: '10px' }}>
                <div /><div /><div />
            </div>
        )}
        {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="skeleton-line" style={{
                width: `${85 - i * 8 + (i % 3) * 4}%`,
                animationDelay: `${i * 0.1}s`
            }} />
        ))}
    </div>
);

export default SkeletonLoader;
