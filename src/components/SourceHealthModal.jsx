import React, { useState, useEffect, useCallback } from 'react';
import { X, Database, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import dataSources from '../data/dataSources.json';
import { useEscapeKey } from '../hooks/useEscapeKey';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const SourceHealthModal = ({ isOpen, onClose }) => {
    const [healthData, setHealthData] = useState(null);

    const fetchHealth = useCallback(() => {
        fetch(`${API_BASE}/api/health`)
            .then(r => r.json())
            .then(setHealthData)
            .catch(() => setHealthData(null));
    }, []);

    useEffect(() => {
        if (isOpen) fetchHealth();
    }, [isOpen, fetchHealth]);

    useEscapeKey(isOpen, onClose);

    if (!isOpen) return null;

    const getStatus = (sourceId) => {
        if (!healthData) return { status: 'unknown', color: '#94a3b8' };
        // Try to match health data keys to source IDs
        const health = healthData.loaderHealth;
        if (!health) return { status: 'unknown', color: '#94a3b8' };
        const key = Object.keys(health).find(k => k.toLowerCase().includes(sourceId));
        if (!key) return { status: 'no-data', color: '#94a3b8' };
        const entry = health[key];
        if (entry.ok) return { status: 'healthy', color: '#22c55e', lastCheck: entry.updatedAt };
        return { status: 'error', color: '#ef4444', message: entry.message, lastCheck: entry.updatedAt };
    };

    const reliabilityColor = (score) => {
        if (score >= 9) return '#22c55e';
        if (score >= 7) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'none'
        }} onClick={onClose}>
            <div style={{
                width: '720px', maxWidth: '95vw', maxHeight: '85vh',
                background: 'rgba(14, 18, 28, 0.95)',
                backdropFilter: 'none',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.14)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Database size={16} style={{ color: '#3b82f6' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
                            Data Provenance & Source Health
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
                            {dataSources.length} sources · Backend: {healthData ? 'CONNECTED' : 'UNREACHABLE'}
                        </span>
                        <button onClick={onClose} aria-label="Close source health modal" style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '2px', padding: '6px 12px', color: 'rgba(255,255,255,0.6)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.6rem', fontFamily: 'inherit', minHeight: '32px'
                        }}>
                            <X size={14} /> Close
                        </button>
                    </div>
                </div>

                {/* Source list */}
                <div style={{ overflowY: 'auto', padding: '12px 20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.48rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Source', 'Type', 'Reliability', 'Update Freq', 'Cache TTL', 'Status', 'Methodology'].map(h => (
                                    <th key={h} style={{
                                        padding: '6px 8px', textAlign: 'left',
                                        color: 'rgba(255,255,255,0.4)', fontWeight: 600,
                                        letterSpacing: '0.8px', textTransform: 'uppercase',
                                        fontSize: '0.38rem'
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dataSources.map(src => {
                                const health = getStatus(src.id);
                                return (
                                    <tr key={src.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '8px 8px' }}>
                                            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontSize: '0.5rem' }}>
                                                {src.name}
                                            </div>
                                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.38rem' }}>
                                                {src.fullName}
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.5)' }}>
                                            {src.type}
                                        </td>
                                        <td style={{ padding: '8px 8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{
                                                    width: '24px', height: '4px', background: 'rgba(255,255,255,0.06)',
                                                    borderRadius: '2px', overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        width: `${src.reliability * 10}%`, height: '100%',
                                                        background: reliabilityColor(src.reliability), borderRadius: '2px'
                                                    }} />
                                                </div>
                                                <span style={{
                                                    color: reliabilityColor(src.reliability),
                                                    fontFamily: 'var(--font-mono)', fontWeight: 700
                                                }}>
                                                    {src.reliability}/10
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                                            {src.updateFrequency}
                                        </td>
                                        <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                                            {src.cacheTTL}
                                        </td>
                                        <td style={{ padding: '8px 8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {health.status === 'healthy' ? (
                                                    <CheckCircle size={10} style={{ color: '#22c55e' }} />
                                                ) : health.status === 'error' ? (
                                                    <AlertCircle size={10} style={{ color: '#ef4444' }} />
                                                ) : (
                                                    <Clock size={10} style={{ color: '#94a3b8' }} />
                                                )}
                                                <span style={{
                                                    color: health.color, fontWeight: 600,
                                                    fontSize: '0.4rem', textTransform: 'uppercase'
                                                }}>
                                                    {health.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{
                                            padding: '8px 8px', color: 'rgba(255,255,255,0.35)',
                                            maxWidth: '200px', lineHeight: 1.3
                                        }}>
                                            {src.methodology}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Legend */}
                    <div style={{
                        display: 'flex', gap: '16px', marginTop: '14px', padding: '8px 0',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        fontSize: '0.4rem', color: 'rgba(255,255,255,0.3)'
                    }}>
                        <span>Reliability: <strong style={{ color: '#22c55e' }}>9-10</strong> Government/Scientific · <strong style={{ color: '#f59e0b' }}>7-8</strong> Vetted OSINT · <strong style={{ color: '#ef4444' }}>&lt;7</strong> Variable</span>
                        <span>All data is cached server-side with stale fallback. Client caches via localStorage.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SourceHealthModal;
