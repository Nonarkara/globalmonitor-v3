import React from 'react';
import { Plane, ExternalLink } from 'lucide-react';

const FlightRadarEmbed = () => (
    <div className="bottom-card" style={{ padding: '6px 8px', flexShrink: 0 }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            marginBottom: '4px', paddingBottom: '3px',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
            <Plane size={10} style={{ color: 'var(--accent-cyan)' }} aria-hidden="true" />
            <span style={{ fontSize: 'var(--type-xs)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                Live Airspace
            </span>
            <span style={{
                fontSize: '0.4rem', fontWeight: 700, letterSpacing: '0.5px',
                color: 'var(--accent-green)', padding: '1px 5px', borderRadius: '3px',
                background: 'rgba(34,197,94,0.1)', marginLeft: 'auto'
            }}>LIVE</span>
        </div>
        <a
            href="https://globe.adsbexchange.com/?lat=29.0&lon=47.0&zoom=4.5&mil=true"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open live airspace tracker in new tab"
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', height: '80px',
                borderRadius: '6px', textDecoration: 'none',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'all 0.2s', cursor: 'pointer'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.06)'; e.currentTarget.style.borderColor = 'rgba(56,189,248,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
        >
            <Plane size={18} style={{ color: 'var(--accent-cyan)', opacity: 0.4 }} />
            <span style={{ fontSize: 'var(--type-xs)', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                ADS-B Exchange <ExternalLink size={8} />
            </span>
            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)' }}>
                airplanes.live · Military + Civil
            </span>
        </a>
    </div>
);

export default FlightRadarEmbed;
