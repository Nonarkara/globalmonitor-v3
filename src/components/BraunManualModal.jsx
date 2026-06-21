import React from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X } from 'lucide-react';

const BraunManualModal = ({ isOpen, onClose }) => {
    useEscapeKey(isOpen, onClose);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)'
        }} onClick={onClose}>
            <div style={{
                width: '100%', maxWidth: '850px', maxHeight: '90vh',
                background: '#e0e0e0',
                color: '#111',
                borderRadius: '0px',
                border: '4px solid #111',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 30px',
                    borderBottom: '4px solid #111',
                    background: '#d4d4d4'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{
                            width: '32px', height: '32px', background: '#111', color: '#e0e0e0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '18px'
                        }}>
                            M
                        </div>
                        <span style={{
                            fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            System Manual
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#111', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase'
                        }}
                    >
                        Close <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: '40px 50px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px'
                }}>
                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '30px', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                            1. Navigation
                        </h2>
                        
                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>1.1 Theater Selection</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                Use the top right tabs to switch between Middle East, ASEAN, and Thailand. Surrounding intelligence panels automatically re-orient to the selected theater.
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>1.2 Tools Menu</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                Access secondary operations (Data Health, Session Log, Print Briefing, Settings) via the Tools dropdown.
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>1.3 Map Interaction</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                Pan and zoom using mouse controls. Click on event markers (circles) to open the detailed intelligence view on the right sidebar.
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '30px', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                            2. Controls & Layers
                        </h2>
                        
                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>2.1 Sidebar Toggles</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                The left sidebar controls active map layers (Conflicts, FIRMS, Flights, Vessels). Active layers are highlighted.
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>2.2 Live Traffic</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                Flights and vessels are tracked in real-time. Zoom in to view individual object icons and movement vectors.
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', textTransform: 'uppercase' }}>2.3 Analytics Panels</div>
                            <div style={{ fontSize: '14px', lineHeight: 1.5, color: '#333' }}>
                                The right and bottom bars display live data streams and metrics. All data is real and pulled from external intelligence APIs.
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '20px 30px', borderTop: '2px solid #aaa', background: '#ccc', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#555', textTransform: 'uppercase' }}>
                    Designed according to Dieter Rams principles • Less, but better.
                </div>
            </div>
        </div>
    );
};

export default BraunManualModal;
