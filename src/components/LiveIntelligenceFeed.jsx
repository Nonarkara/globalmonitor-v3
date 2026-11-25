import React, { useCallback, useState } from 'react';
import { fetchLiveNews } from '../services/liveNews';
import { RefreshCw } from 'lucide-react';
import { useLiveResource } from '../hooks/useLiveResource';

const LiveIntelligenceFeed = ({ activeSourceIds, staticFeed = false }) => {
    const [paused, setPaused] = useState(false);
    const cacheKey = `ticker:${Array.isArray(activeSourceIds) && activeSourceIds.length ? activeSourceIds.join(',') : 'default'}`;
    const fetcher = useCallback(() => fetchLiveNews(activeSourceIds), [activeSourceIds]);
    const {
        data: rawNews,
        isRefreshing,
        isLoading,
        isStale,
        error,
        refresh
    } = useLiveResource(fetcher, {
        cacheKey,
        intervalMs: 3 * 60 * 1000,
        isUsable: (items) => Array.isArray(items) && items.length > 0
    });

    const news = Array.isArray(rawNews) ? rawNews : [];

    if (!isLoading && news.length === 0 && !isStale && !error) {
        return (
            <div className="news-ticker-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.45rem', color: 'var(--ink-3)', letterSpacing: '0.5px' }}>
                    Status: Live headline feeds are temporarily unavailable. Last-good data will reappear when the sources respond.
                </span>
            </div>
        );
    }

    return (
        <div className="news-ticker-wrapper">
            <div className="news-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 'bold', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 0, background: 'var(--panel)', border: '1px solid var(--line)' }}>
                    {isStale ? 'STALE' : 'LIVE INTEL'}
                </span>
                {!staticFeed && news.length > 0 && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
                    {paused ? 'Resume' : 'Pause'}
                </button>}
                <button
                    onClick={refresh}
                    style={{ background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', padding: 0 }}
                    title="Force Refresh Data"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                </button>
            </div>
            <div className="news-marquee-container">
                <div className={`news-marquee ${staticFeed || news.length === 0 ? 'news-marquee-static' : ''}`}
                    style={paused ? { animationPlayState: 'paused' } : undefined}>
                    {/* Duplicate for infinite scroll illusion */}
                    {(news.length > 0 ? (staticFeed ? news : [...news, ...news]) : [{
                        title: error ? 'Live headline feeds are temporarily unavailable. Last-good data will reappear when the sources respond.' : 'Connecting to live headline feeds...',
                        link: '',
                        source: error ? 'Feed Status' : 'Sync',
                        tags: [isStale ? 'stale' : 'loading']
                    }]).map((item, index) => (
                        <a
                            key={index}
                            href={item.link || undefined}
                            target={item.link ? '_blank' : undefined}
                            rel={item.link ? 'noopener noreferrer' : undefined}
                            className="news-item"
                        >
                            <span className="source">{item.source}:</span> {item.title}
                            {item.tags?.[0] && <span style={{ marginLeft: '8px', color: 'var(--ink-2)', fontSize: '0.75rem' }}>#{item.tags[0]}</span>}
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LiveIntelligenceFeed;
