import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';
import armsData from '../data/armsDefense.json';

const STATUS_COLORS = {
    active: '#22c55e',
    degraded: '#f59e0b',
    destroyed: '#ef4444',
    surge: '#3b82f6',
    covert: '#f59e0b',
    restricted: '#f97316'
};

const ArmsDefensePanel = ({ viewMode = 'middleeast' }) => {
    const [showFlows, setShowFlows] = useState(false);
    const { arsenalUsage } = armsData;
    const isMiddleEast = viewMode === 'middleeast';

    return (
        <div className="bottom-card" style={{ padding: '10px 12px' }}>
            <div className="panel-header" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: '5px', marginBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '2px solid #6366f1', paddingLeft: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={12} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        Arms & Defense
                    </span>
                </div>
                <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>
                    SIPRI + OSINT · {isMiddleEast ? 'MIDDLE EAST' : 'THEATER SNAPSHOT'}
                </span>
            </div>

            {!isMiddleEast && (
                <div style={{
                    padding: '8px', marginBottom: '6px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.42rem',
                    color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.5
                }}>
                    Detailed arsenal tracking is focused on the Middle East theater.<br />
                    Switch to <strong style={{ color: '#6366f1' }}>Middle East</strong> view for live SIPRI + OSINT data.
                </div>
            )}

            {/* Arsenal usage KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '6px' }}>
                {[
                    { label: 'Iran Missiles', value: arsenalUsage.iraniMissilesLaunched, color: '#ef4444' },
                    { label: 'Iran Drones', value: arsenalUsage.iraniDronesLaunched, color: '#f97316' },
                    { label: 'Intercepted', value: arsenalUsage.interceptionsTotal, color: '#3b82f6' }
                ].map(k => (
                    <div key={k.label} style={{
                        textAlign: 'center', padding: '4px',
                        background: 'rgba(255,255,255,0.04)', borderRadius: '4px'
                    }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: k.color, fontFamily: 'var(--font-mono)' }}>{k.value}</div>
                        <div style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Interception rate bar */}
            <div style={{
                padding: '4px 8px', marginBottom: '6px',
                background: 'rgba(99,102,241,0.06)', borderRadius: '4px',
                border: '1px solid rgba(99,102,241,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Overall Interception Rate
                    </span>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#6366f1', fontFamily: 'var(--font-mono)' }}>
                        {arsenalUsage.interceptionRate}
                    </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        width: arsenalUsage.interceptionRate,
                        height: '100%', borderRadius: '2px',
                        background: 'linear-gradient(90deg, #6366f1, #3b82f6)'
                    }} />
                </div>
            </div>

            {/* Defense systems */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                {armsData.defenseSystems.map((sys, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0' }}>
                        <div style={{
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: STATUS_COLORS[sys.status] || '#94a3b8', flexShrink: 0
                        }} />
                        <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.65)', flex: 1 }}>
                            {sys.name}
                        </span>
                        <span style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.3)' }}>
                            {sys.operator}
                        </span>
                        <span style={{
                            fontSize: '0.34rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                            color: STATUS_COLORS[sys.status] || '#94a3b8'
                        }}>
                            {sys.interceptRate}
                        </span>
                    </div>
                ))}
            </div>

            {/* Arms flows toggle */}
            <button
                onClick={() => setShowFlows(!showFlows)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '4px', width: '100%', marginTop: '2px',
                    padding: '3px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '4px', color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.38rem', cursor: 'pointer', fontFamily: 'inherit'
                }}
            >
                {showFlows ? <ChevronUp size={8} /> : <ChevronDown size={8} />}
                Arms Flows ({armsData.armsFlows.length} routes)
            </button>

            {showFlows && (
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {armsData.armsFlows.map((flow, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0' }}>
                            <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.5)', width: '32px', flexShrink: 0 }}>{flow.from}</span>
                            <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.2)' }}>&rarr;</span>
                            <span style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.5)', width: '40px', flexShrink: 0 }}>{flow.to}</span>
                            <span style={{ fontSize: '0.34rem', color: 'rgba(255,255,255,0.3)', flex: 1 }}>{flow.type}</span>
                            <span style={{
                                fontSize: '0.3rem', fontWeight: 700,
                                color: STATUS_COLORS[flow.status] || '#94a3b8',
                                letterSpacing: '0.3px', textTransform: 'uppercase'
                            }}>
                                {flow.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ArmsDefensePanel;
