import React from 'react';
import SkeletonLoader from './SkeletonLoader';

const S = {
    container: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--sp-2) var(--sp-2)',
        gap: 'var(--sp-1)', minHeight: 40, textAlign: 'center'
    },
    label: {
        fontSize: 'var(--type-xs)', color: 'var(--text-dim)',
        letterSpacing: '0.5px', fontFamily: 'var(--font-mono)'
    },
    retryBtn: {
        marginTop: 'var(--sp-1)', padding: '3px 10px',
        fontSize: 'var(--type-xs)', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
        color: 'var(--text-muted)', cursor: 'pointer',
        letterSpacing: '0.5px', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)', transition: 'var(--transition)'
    },
    staleBadge: {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontSize: 'var(--type-xs)', color: 'var(--accent-amber)',
        padding: '2px 6px', borderRadius: '3px',
        background: 'rgba(245,158,11,0.1)', letterSpacing: '0.3px',
        fontFamily: 'var(--font-mono)'
    }
};

const DataStatus = ({
    isLoading, isRefreshing, isStale, error, retryCount,
    data, isEmpty, emptyMessage = 'No data available',
    refresh, children
}) => {
    // First load — skeleton placeholder
    if (!data && isLoading) {
        return <SkeletonLoader lines={4} showKpi={true} />;
    }

    // Error with no data
    if (!data && error) {
        return (
            <div style={S.container} role="alert">
                <span style={{ fontSize: '16px', opacity: 0.5 }} aria-hidden="true">⚠</span>
                <span style={S.label}>
                    UNAVAILABLE{retryCount > 0 ? ` (${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})` : ''}
                </span>
                {refresh && (
                    <button style={S.retryBtn} onClick={refresh} aria-label="Retry loading data">
                        TAP TO RETRY
                    </button>
                )}
            </div>
        );
    }

    // Empty data
    if (isEmpty) {
        return (
            <div style={S.container}>
                <span style={S.label}>{emptyMessage}</span>
            </div>
        );
    }

    // Has data — render children; badge slot is fixed-height so REFRESHING never shifts layout.
    return (
        <>
            <div style={{ position: 'relative', minHeight: 18, flexShrink: 0 }}>
                {(isStale || isRefreshing) && (
                    <div style={{ position: 'absolute', top: 2, right: 8, display: 'flex', gap: 6 }}>
                        {isStale && !isRefreshing && (
                            <span style={S.staleBadge} role="status">STALE</span>
                        )}
                        {isRefreshing && (
                            <span style={{ ...S.staleBadge, color: 'var(--accent-cyan)', background: 'rgba(56,189,248,0.1)' }} role="status">
                                REFRESHING
                            </span>
                        )}
                    </div>
                )}
            </div>
            {children}
        </>
    );
};

export default DataStatus;
