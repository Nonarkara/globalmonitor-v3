import React from 'react';
import { Plane, ExternalLink } from 'lucide-react';

const FlightRadarEmbed = ({ flightsActive, flightCount, onToggleFlights }) => (
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
                color: flightsActive ? 'var(--accent-green)' : 'rgba(255,255,255,0.35)',
                padding: '1px 5px', borderRadius: '3px',
                background: flightsActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                marginLeft: 'auto'
            }}>
                {flightsActive ? 'MAP ON' : 'MAP OFF'}
            </span>
        </div>

        <button
            type="button"
            onClick={onToggleFlights}
            aria-pressed={flightsActive}
            aria-label={flightsActive ? 'Hide ADS-B flight tracking on map' : 'Show ADS-B flight tracking on map'}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', width: '100%', height: '80px',
                borderRadius: '6px',
                background: flightsActive ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${flightsActive ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.04)'}`,
                transition: 'background 0.2s, border-color 0.2s',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
                padding: 0
            }}
        >
            <Plane size={18} style={{ color: 'var(--accent-cyan)', opacity: flightsActive ? 0.95 : 0.4 }} />
            <span style={{ fontSize: 'var(--type-xs)', color: flightsActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                ADS-B Exchange · airplanes.live
            </span>
            <span style={{ fontSize: '0.5rem', color: flightsActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)' }}>
                {flightsActive && flightCount > 0
                    ? `${flightCount.toLocaleString()} aircraft on map · heading vectors`
                    : 'Tap to show live aircraft on map'}
            </span>
        </button>

        <a
            href="https://globe.adsbexchange.com/?lat=29.0&lon=47.0&zoom=4.5&mil=true"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open ADS-B Exchange globe in new tab"
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                marginTop: '6px', fontSize: '0.48rem', color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.4px', textDecoration: 'none'
            }}
        >
            Civ-Mil Radar · full screen <ExternalLink size={8} />
        </a>
    </div>
);

export default FlightRadarEmbed;
