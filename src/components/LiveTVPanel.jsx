import React, { useState, useCallback, useMemo } from 'react';
import { Tv, Volume2, VolumeX } from 'lucide-react';
import { getRegion } from '../data/regions.js';

const CHANNELS_PER_PAGE = 4;

/**
 * Region-aware live-TV grid. Reads channel list from the region registry.
 * Switching viewMode swaps channels with no remount-flicker because we
 * keep the iframe `src` keyed by channel id, not by region.
 */
const LiveTVPanel = ({ viewMode = 'middleeast' }) => {
  const channels = useMemo(() => getRegion(viewMode).channels, [viewMode]);
  const [activeState, setActiveState] = useState({ viewMode, channel: null });
  const [pageState, setPageState] = useState({ viewMode, page: 0 });
  const activeChannel = activeState.viewMode === viewMode ? activeState.channel : null;
  const totalPages = Math.ceil(channels.length / CHANNELS_PER_PAGE);
  const page = pageState.viewMode === viewMode ? Math.min(pageState.page, Math.max(totalPages - 1, 0)) : 0;
  const visibleChannels = channels.slice(page * CHANNELS_PER_PAGE, (page + 1) * CHANNELS_PER_PAGE);

  const handleChannelClick = useCallback((channelId) => {
    setActiveState((prev) => ({
      viewMode,
      channel: prev.viewMode === viewMode && prev.channel === channelId ? null : channelId,
    }));
  }, [viewMode]);

  return (
    <div className="grid-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      flexShrink: 0,
      maxHeight: '180px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.6rem',
        fontWeight: 600,
        letterSpacing: '1px',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
      }}>
        <Tv size={10} style={{ opacity: 0.5 }} />
        <span>LIVE</span>
        {activeChannel && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.5rem',
            color: '#ef4444',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            <span style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'pulse-dot 1.5s infinite',
            }} />
            ON AIR
          </span>
        )}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '2px',
        padding: '2px',
        flex: 1,
        minHeight: 0,
      }}>
        {visibleChannels.map((ch) => {
          const isActive = activeChannel === ch.id;
          const src = isActive ? ch.embedUrlUnmuted : ch.embedUrl;

          return (
            <div
              key={ch.id}
              style={{
                position: 'relative',
                borderRadius: '4px',
                overflow: 'hidden',
                border: isActive
                  ? `1px solid ${ch.color}`
                  : '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                transition: 'border-color 0.3s',
                boxShadow: isActive ? `0 0 8px ${ch.color}22` : 'none',
                aspectRatio: '16/9',
              }}
              onClick={() => handleChannelClick(ch.id)}
            >
              <iframe
                src={src}
                title={ch.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  pointerEvents: 'none',
                  display: 'block',
                }}
              />
              {/* Tiny channel label */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '1px 4px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pointerEvents: 'none',
              }}>
                <span style={{
                  fontSize: '0.48rem',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: '0.2px',
                }}>
                  {ch.name}
                </span>
                {isActive ? (
                  <Volume2 size={7} style={{ color: ch.color }} />
                ) : (
                  <VolumeX size={7} style={{ color: 'rgba(255,255,255,0.2)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Page dots */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '4px',
          padding: '3px 0 2px'
        }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPageState({ viewMode, page: i })}
              style={{
                width: '12px', height: '3px', borderRadius: '2px',
                background: i === page ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveTVPanel;
