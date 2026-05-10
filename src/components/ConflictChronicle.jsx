import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import milestones from '../data/conflictMilestones.json';
import { WAR_START, getDayCount } from '../data/warConstants';
import { useLiveResource } from '../hooks/useLiveResource';

const API_BASE = import.meta.env.DEV ? 'http://localhost:4000' : '';

const CATEGORY_COLORS = {
    military: '#ef4444',
    proxy: '#f97316',
    diplomatic: '#3b82f6',
    humanitarian: '#ec4899',
    economic: '#f59e0b',
    maritime: '#38bdf8'
};

const CATEGORY_LABELS = {
    military: 'MIL',
    proxy: 'PRX',
    diplomatic: 'DIP',
    humanitarian: 'HUM',
    economic: 'ECO',
    maritime: 'MAR'
};

const CHRONICLE_WIDTH = 1200;
const CHRONICLE_MARGIN = { left: 40, right: 20, top: 14, bottom: 20 };

const ConflictChronicle = ({ onFlyTo }) => {
    const [expanded, setExpanded] = useState(true);
    const [hoveredMilestone, setHoveredMilestone] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const svgRef = useRef(null);

    // Fetch ACLED data for density overlay
    const acledFetcher = useCallback(() =>
        fetch(`${API_BASE}/api/acled`).then(r => r.json()).catch(() => null), []);

    const { data: acledData } = useLiveResource(acledFetcher, {
        cacheKey: 'chronicle-acled',
        intervalMs: 15 * 60 * 1000,
        isUsable: (d) => d?.features?.length > 0
    });

    const { eventDensity, maxDensity, sortedMilestones, totalDays } = useMemo(() => {
        const days = getDayCount();

        // ACLED event density by day
        const density = new Array(days + 1).fill(0);
        if (acledData?.features) {
            acledData.features.forEach(f => {
                const d = f.properties?.eventDate?.split('T')[0] || f.properties?.event_date;
                if (d) {
                    const dayIdx = Math.floor((new Date(d) - WAR_START) / 86400000);
                    if (dayIdx >= 0 && dayIdx < density.length) density[dayIdx]++;
                }
            });
        }

        // Sort milestones
        const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));

        return {
            eventDensity: density,
            maxDensity: Math.max(...density, 1),
            sortedMilestones: sorted,
            totalDays: days
        };
    }, [acledData]);

    const WIDTH = CHRONICLE_WIDTH;
    const HEIGHT = expanded ? 70 : 0;
    const MARGIN = CHRONICLE_MARGIN;
    const plotW = WIDTH - MARGIN.left - MARGIN.right;
    const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

    const toX = (dateStr) => {
        const dayIdx = Math.floor((new Date(dateStr) - WAR_START) / 86400000);
        return MARGIN.left + (dayIdx / Math.max(totalDays, 1)) * plotW;
    };

    // Density area path
    const densityPath = useMemo(() => {
        if (!eventDensity.length || plotH <= 0) return '';
        const stepX = plotW / Math.max(eventDensity.length - 1, 1);
        const points = eventDensity.map((v, i) => {
            const x = MARGIN.left + i * stepX;
            const y = MARGIN.top + plotH - (v / maxDensity) * plotH;
            return `${x},${y}`;
        });
        return `M${MARGIN.left},${MARGIN.top + plotH} L${points.join(' L')} L${MARGIN.left + plotW},${MARGIN.top + plotH} Z`;
    }, [eventDensity, maxDensity, plotW, plotH, MARGIN.left, MARGIN.top]);

    const handleMilestoneClick = (m) => {
        if (onFlyTo && m.lat && m.lon) {
            onFlyTo({
                longitude: m.lon,
                latitude: m.lat,
                zoom: 6,
                transitionDuration: 1500
            });
        }
    };

    const handleMouseMove = (e, m) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
            setTooltipPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top - 10
            });
        }
        setHoveredMilestone(m);
    };

    // Week labels
    const weekLabels = useMemo(() => {
        const labels = [];
        for (let d = 0; d <= totalDays; d += 7) {
            labels.push({
                x: MARGIN.left + (d / Math.max(totalDays, 1)) * plotW,
                label: `W${Math.floor(d / 7) + 1}`
            });
        }
        return labels;
    }, [totalDays, plotW, MARGIN.left]);

    return (
        <div style={{
            background: 'rgba(10, 12, 18, 0.8)',
            backdropFilter: 'blur(16px)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}>
            {/* Header - always visible */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={12} style={{ color: '#38bdf8' }} />
                    <span style={{
                        fontSize: '0.52rem', fontWeight: 600, letterSpacing: '1.5px',
                        color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase'
                    }}>
                        Conflict Chronicle
                    </span>
                    <span style={{
                        fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {sortedMilestones.length} events · Day {getDayCount()}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Category legend */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                            <span key={cat} style={{
                                display: 'flex', alignItems: 'center', gap: '2px',
                                fontSize: '0.35rem', color: 'rgba(255,255,255,0.35)'
                            }}>
                                <span style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    background: color, display: 'inline-block'
                                }} />
                                {CATEGORY_LABELS[cat]}
                            </span>
                        ))}
                    </div>
                    {expanded ? <ChevronUp size={12} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                </div>
            </div>

            {/* Timeline SVG */}
            {expanded && (
                <div style={{ padding: '0 8px 6px', position: 'relative' }}>
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                        style={{ width: '100%', height: 'auto' }}
                    >
                        {/* Density area */}
                        {densityPath && (
                            <path d={densityPath} fill="rgba(56,189,248,0.08)" stroke="none" />
                        )}

                        {/* Timeline axis */}
                        <line
                            x1={MARGIN.left} y1={MARGIN.top + plotH}
                            x2={MARGIN.left + plotW} y2={MARGIN.top + plotH}
                            stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                        />

                        {/* Week labels */}
                        {weekLabels.map((w, i) => (
                            <g key={i}>
                                <line x1={w.x} y1={MARGIN.top} x2={w.x} y2={MARGIN.top + plotH}
                                    stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                <text x={w.x} y={MARGIN.top + plotH + 12}
                                    fill="rgba(255,255,255,0.2)" fontSize="7" textAnchor="middle"
                                    fontFamily="var(--font-mono)">
                                    {w.label}
                                </text>
                            </g>
                        ))}

                        {/* "TODAY" marker */}
                        <line
                            x1={MARGIN.left + plotW} y1={MARGIN.top - 2}
                            x2={MARGIN.left + plotW} y2={MARGIN.top + plotH + 2}
                            stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"
                        />
                        <text x={MARGIN.left + plotW} y={MARGIN.top - 4}
                            fill="#38bdf8" fontSize="6" textAnchor="end" fontFamily="var(--font-mono)" opacity="0.6">
                            TODAY
                        </text>

                        {/* Milestones */}
                        {sortedMilestones.map((m, i) => {
                            const x = toX(m.date);
                            const color = CATEGORY_COLORS[m.category] || '#3b82f6';
                            const r = 3 + m.severity * 0.8;
                            const isHovered = hoveredMilestone === m;
                            // Stagger y position to avoid overlap
                            const yOffset = (i % 3) * 10;
                            const cy = MARGIN.top + 8 + yOffset;

                            return (
                                <g key={i}
                                    onMouseEnter={(e) => handleMouseMove(e, m)}
                                    onMouseLeave={() => setHoveredMilestone(null)}
                                    onClick={() => handleMilestoneClick(m)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* Vertical line to axis */}
                                    <line x1={x} y1={cy + r} x2={x} y2={MARGIN.top + plotH}
                                        stroke={color} strokeWidth="0.5" opacity="0.3" />
                                    {/* Severity ring */}
                                    {m.severity >= 4 && (
                                        <circle cx={x} cy={cy} r={r + 3}
                                            fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" />
                                    )}
                                    {/* Main dot */}
                                    <circle cx={x} cy={cy} r={isHovered ? r + 1.5 : r}
                                        fill={color}
                                        stroke={isHovered ? '#fff' : 'none'}
                                        strokeWidth="1"
                                        opacity={isHovered ? 1 : 0.85}
                                        style={{ transition: 'all 0.15s' }}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Tooltip */}
                    {hoveredMilestone && (
                        <div style={{
                            position: 'absolute',
                            left: Math.min(tooltipPos.x, window.innerWidth * 0.6),
                            top: tooltipPos.y - 50,
                            background: 'rgba(10, 12, 18, 0.95)',
                            backdropFilter: 'blur(12px)',
                            border: `1px solid ${CATEGORY_COLORS[hoveredMilestone.category] || '#3b82f6'}40`,
                            borderRadius: '6px',
                            padding: '6px 10px',
                            pointerEvents: 'none',
                            zIndex: 100,
                            maxWidth: '220px'
                        }}>
                            <div style={{
                                fontSize: '0.5rem', fontWeight: 700,
                                color: CATEGORY_COLORS[hoveredMilestone.category] || '#3b82f6',
                                marginBottom: '2px'
                            }}>
                                {hoveredMilestone.title}
                            </div>
                            <div style={{
                                fontSize: '0.4rem', color: 'rgba(255,255,255,0.5)',
                                marginBottom: '2px', fontFamily: 'var(--font-mono)'
                            }}>
                                {hoveredMilestone.date}
                            </div>
                            <div style={{ fontSize: '0.4rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
                                {hoveredMilestone.description}
                            </div>
                            {hoveredMilestone.lat && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    marginTop: '3px', fontSize: '0.35rem',
                                    color: 'rgba(255,255,255,0.3)'
                                }}>
                                    <MapPin size={7} /> Click to fly to location
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConflictChronicle;
