import React, { useState } from 'react';
import { INTELLIGENCE_SOURCES } from '../services/liveNews';
import { X, Check } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

const TABS = [
    { id: 'all', label: 'ALL' },
    { id: 'worldwide', label: 'WORLDWIDE' },
    { id: 'united-states', label: 'UNITED STATES' },
    { id: 'europe', label: 'EUROPE' },
    { id: 'middle-east', label: 'MIDDLE EAST' },
    { id: 'africa', label: 'AFRICA' },
    { id: 'latin-america', label: 'LATIN AMERICA' },
    { id: 'asia', label: 'ASIA' },
    { id: 'thailand', label: 'THAILAND' }
];

const SettingsModal = ({ isOpen, onClose, activeSources, toggleSource, setAllSources }) => {
    const [activeTab, setActiveTab] = useState('middle-east');
    const [filterText, setFilterText] = useState('');

    useEscapeKey(isOpen, onClose);

    if (!isOpen) return null;

    const filteredSources = INTELLIGENCE_SOURCES.filter(source => {
        const matchesTab = activeTab === 'all' || source.group === activeTab;
        const matchesText = source.name.toLowerCase().includes(filterText.toLowerCase());
        return matchesTab && matchesText;
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="grid-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-modal-title"
                onClick={(event) => event.stopPropagation()}
                style={{ width: '800px', maxWidth: '90vw', maxHeight: '85vh', padding: 0, display: 'flex', flexDirection: 'column' }}
            >

                {/* Header */}
                <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
                    <h2 id="settings-modal-title" style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '2px', fontWeight: 600 }}>NEWS SOURCES</h2>
                    <button onClick={onClose} aria-label="Close settings modal" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Filter hint */}
                <div style={{ padding: '12px 24px 0', color: '#888', fontSize: '0.8rem' }}>
                    Choose which news sources feed the live ticker and briefing panels.
                </div>

                {/* Sub-Filters & Search */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #222' }}>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '2px',
                                    border: `1px solid ${activeTab === tab.id ? '#10b981' : '#333'}`,
                                    color: activeTab === tab.id ? '#10b981' : '#888',
                                    background: 'transparent',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'var(--transition)',
                                    letterSpacing: '1px'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: '12px' }}>
                        <input
                            type="text"
                            placeholder="Filter sources..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: 'transparent',
                                border: '1px solid #333',
                                color: '#fff',
                                borderRadius: '2px',
                                fontFamily: 'inherit',
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>
                </div>

                {/* Grid of Sources */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', alignContent: 'start' }}>
                    {filteredSources.map((source) => {
                        const isActive = activeSources.includes(source.id);
                        return (
                            <div
                                key={source.id}
                                onClick={() => toggleSource(source.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    border: `1px solid ${isActive ? '#10b981' : '#333'}`,
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: '16px', height: '16px',
                                    backgroundColor: isActive ? '#10b981' : 'transparent',
                                    border: `1px solid ${isActive ? '#10b981' : '#555'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '1px'
                                }}>
                                    {isActive && <Check size={12} color="#000" strokeWidth={3} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '0.85rem', color: isActive ? '#fff' : '#888', fontWeight: isActive ? 500 : 400 }}>
                                        {source.name}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Controls */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>{activeSources.length}/{INTELLIGENCE_SOURCES.length} enabled</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => setAllSources(true)}
                            style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '2px', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '1px', transition: 'var(--transition)' }}>
                            SELECT ALL
                        </button>
                        <button
                            onClick={() => setAllSources(false)}
                            style={{ padding: '10px 24px', background: 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '2px', fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '1px', transition: 'var(--transition)' }}>
                            SELECT NONE
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsModal;
