import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Network } from 'lucide-react';
import * as d3 from 'd3';
import networkData from '../data/actorNetwork.json';
import { useEscapeKey } from '../hooks/useEscapeKey';

const EDGE_COLORS = {
    alliance: '#22c55e',
    rivalry: '#ef4444',
    proxy: '#f59e0b',
    arms: '#38bdf8'
};

const EDGE_DASH = {
    alliance: 'none',
    rivalry: '6,3',
    proxy: '4,4',
    arms: '2,4'
};

const NODE_TYPE_LABELS = {
    state: 'State Actor',
    proxy: 'Proxy / Non-State'
};

const getModalDimensions = () => ({
    width: Math.min(window.innerWidth * 0.8, 1000),
    height: Math.min(window.innerHeight * 0.75, 700)
});

const ActorNetworkModal = ({ isOpen, onClose }) => {
    const svgRef = useRef(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const simRef = useRef(null);

    useEscapeKey(isOpen, onClose);

    // Calculate dimensions on open
    useEffect(() => {
        if (!isOpen) return undefined;
        const frame = requestAnimationFrame(() => {
            setDimensions(getModalDimensions());
            setSelectedNode(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [isOpen]);

    const initGraph = useCallback(() => {
        if (!svgRef.current || !isOpen) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const nodes = networkData.nodes.map(n => ({ ...n }));
        const edges = networkData.edges.map(e => ({
            ...e,
            source: e.source,
            target: e.target
        }));

        // Create arrow markers
        const defs = svg.append('defs');
        Object.entries(EDGE_COLORS).forEach(([type, color]) => {
            defs.append('marker')
                .attr('id', `arrow-${type}`)
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 20)
                .attr('refY', 0)
                .attr('markerWidth', 5)
                .attr('markerHeight', 5)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-4L8,0L0,4')
                .attr('fill', color)
                .attr('opacity', 0.5);
        });

        const g = svg.append('g');

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([0.4, 3])
            .on('zoom', (event) => g.attr('transform', event.transform));
        svg.call(zoom);

        // Simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-350))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.size + 10));

        simRef.current = simulation;

        // Edges
        const link = g.append('g').selectAll('line')
            .data(edges)
            .join('line')
            .attr('stroke', d => EDGE_COLORS[d.type] || '#666')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-dasharray', d => EDGE_DASH[d.type] || 'none')
            .attr('marker-end', d => `url(#arrow-${d.type})`);

        // Edge labels
        const edgeLabel = g.append('g').selectAll('text')
            .data(edges)
            .join('text')
            .text(d => d.label)
            .attr('fill', 'rgba(255,255,255,0.2)')
            .attr('font-size', '7px')
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .style('pointer-events', 'none');

        // Node groups
        const node = g.append('g').selectAll('g')
            .data(nodes)
            .join('g')
            .style('cursor', 'pointer')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }))
            .on('click', (event, d) => {
                event.stopPropagation();
                setSelectedNode(d);
            });

        // Node outer ring (for proxy type)
        node.filter(d => d.type === 'proxy')
            .append('circle')
            .attr('r', d => d.size + 3)
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,2')
            .attr('opacity', 0.3);

        // Node circles
        node.append('circle')
            .attr('r', d => d.size)
            .attr('fill', d => `${d.color}30`)
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2);

        // Node labels
        node.append('text')
            .text(d => d.label)
            .attr('dy', d => d.size + 12)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(255,255,255,0.7)')
            .attr('font-size', '9px')
            .attr('font-weight', 600)
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .style('pointer-events', 'none');

        // Node initials
        node.append('text')
            .text(d => d.label.substring(0, 2).toUpperCase())
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', d => d.color)
            .attr('font-size', d => Math.max(d.size * 0.7, 8) + 'px')
            .attr('font-weight', 700)
            .attr('font-family', 'var(--font-mono)')
            .style('pointer-events', 'none');

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            edgeLabel
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Click background to deselect
        svg.on('click', () => setSelectedNode(null));
    }, [isOpen, dimensions]);

    useEffect(() => {
        initGraph();
        return () => {
            if (simRef.current) simRef.current.stop();
        };
    }, [initGraph]);

    if (!isOpen) return null;

    // Mobile fallback — D3 force-directed graph with 100+ SVG nodes and a
    // simulation that re-renders every frame on drag is unusable on a phone.
    // Show a one-liner instead.
    const isPhoneViewport = typeof window !== 'undefined' && window.innerWidth < 600;
    if (isPhoneViewport) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.85)',
                padding: '24px'
            }} onClick={onClose}>
                <div style={{
                    background: 'rgba(10, 14, 20, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '28px 24px',
                    maxWidth: '320px',
                    textAlign: 'center'
                }} onClick={e => e.stopPropagation()}>
                    <Network size={20} style={{ color: '#8b5cf6', marginBottom: '14px' }} />
                    <div style={{
                        fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)',
                        marginBottom: '8px', letterSpacing: '0.4px'
                    }}>
                        Actor / Faction Network
                    </div>
                    <div style={{
                        fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.55, marginBottom: '16px'
                    }}>
                        {networkData.nodes.length} actors · {networkData.edges.length} relationships.
                        The interactive graph is available on tablet and desktop — open globalmonitor.fly.dev on a wider screen to explore.
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.75)',
                        padding: '10px 18px',
                        fontSize: '0.75rem', fontFamily: 'inherit',
                        letterSpacing: '0.6px', cursor: 'pointer',
                        minHeight: '44px'
                    }}>
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Get edges for selected node
    const selectedEdges = selectedNode
        ? networkData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
        : [];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)'
        }} onClick={onClose}>
            <div style={{
                width: dimensions.width + 40,
                maxWidth: '95vw',
                maxHeight: '90vh',
                background: 'rgba(14, 18, 28, 0.95)',
                backdropFilter: 'blur(24px)',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Network size={16} style={{ color: '#8b5cf6' }} />
                        <span style={{
                            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1.5px',
                            color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase'
                        }}>
                            Actor / Faction Network
                        </span>
                        <span style={{
                            fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            {networkData.nodes.length} actors · {networkData.edges.length} relationships
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {Object.entries(EDGE_COLORS).map(([type, color]) => (
                                <span key={type} style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    fontSize: '0.42rem', color: 'rgba(255,255,255,0.4)'
                                }}>
                                    <span style={{
                                        width: '12px', height: '2px', background: color,
                                        display: 'inline-block', borderRadius: '1px'
                                    }} />
                                    {type}
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '6px', padding: '6px 12px',
                                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                fontSize: '0.6rem', fontFamily: 'inherit', minHeight: '32px'
                            }}
                        >
                            <X size={14} /> Close
                        </button>
                    </div>
                </div>

                {/* Graph + Detail panel */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <svg
                        ref={svgRef}
                        width={dimensions.width}
                        height={dimensions.height}
                        style={{ background: 'transparent' }}
                    />

                    {/* Detail sidebar */}
                    {selectedNode && (
                        <div style={{
                            width: '240px', flexShrink: 0,
                            padding: '16px',
                            borderLeft: '1px solid rgba(255,255,255,0.06)',
                            overflowY: 'auto'
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                marginBottom: '12px'
                            }}>
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: `${selectedNode.color}25`,
                                    border: `2px solid ${selectedNode.color}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.6rem', fontWeight: 700, color: selectedNode.color,
                                    fontFamily: 'var(--font-mono)'
                                }}>
                                    {selectedNode.label.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                                        {selectedNode.label}
                                    </div>
                                    <div style={{ fontSize: '0.4rem', color: selectedNode.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {NODE_TYPE_LABELS[selectedNode.type] || selectedNode.type}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                fontSize: '0.45rem', color: 'rgba(255,255,255,0.55)',
                                lineHeight: 1.5, marginBottom: '14px'
                            }}>
                                {selectedNode.description}
                            </div>

                            <div style={{
                                fontSize: '0.42rem', fontWeight: 600,
                                letterSpacing: '1px', color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase', marginBottom: '6px'
                            }}>
                                Relationships ({selectedEdges.length})
                            </div>

                            {selectedEdges.map((e, i) => {
                                const isSource = e.source === selectedNode.id;
                                const other = isSource ? e.target : e.source;
                                const otherNode = networkData.nodes.find(n => n.id === other);
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 0',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)'
                                    }}>
                                        <div style={{
                                            width: '6px', height: '6px', borderRadius: '50%',
                                            background: EDGE_COLORS[e.type] || '#666'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.7)' }}>
                                                {otherNode?.label || other}
                                            </div>
                                            <div style={{ fontSize: '0.38rem', color: 'rgba(255,255,255,0.3)' }}>
                                                {e.label} · {e.type}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActorNetworkModal;
