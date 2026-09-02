import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchLiveNews } from '../services/liveNews';
import { fetchBackendJson } from '../services/backendClient';
import { Rss, RefreshCw } from 'lucide-react';

const safeDateString = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const RegionalNewsPanel = ({ regionName, title, activeSourceIds, viewMode = 'middleeast' }) => {
    const [news, setNews] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const fetchNews = useCallback(() => {
        setIsRefreshing(true);

        // Google News RSS-backed regions — fetched direct, not from liveNews aggregate
        const RSS_REGIONS = {
            Myanmar:      '"Myanmar" conflict OR border OR refugee OR junta',
            SouthChinaSea:'"South China Sea" OR "Taiwan Strait" tension OR naval OR incident',
            ASEAN:        'ASEAN geopolitics OR diplomacy OR summit OR "Southeast Asia"',
            Taiwan:       'Taiwan China military OR strait OR exercise OR invasion',
            // Global-theater conflict wires (global.nonarkara.org).
            Ukraine:      '"Ukraine" war OR Russia OR front OR strike OR drone OR offensive OR ceasefire',
            Africa:       'Sudan OR Sahel OR "DR Congo" OR Ethiopia conflict OR RSF OR M23 OR Darfur OR famine',
            WorldConflict:'armed conflict OR war OR ceasefire OR offensive OR insurgency OR coup -sport -football',
        };
        if (RSS_REGIONS[regionName]) {
            fetchBackendJson('/api/news-rss', { q: RSS_REGIONS[regionName] })
                .then((items) => { if (mountedRef.current) setNews(Array.isArray(items) ? items : []); })
                .catch(() => { if (mountedRef.current) setNews([]); })
                .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
            return;
        }

        if (regionName === 'DEPA') {
            fetchBackendJson('/api/news-rss', { q: '"Digital Economy Promotion Agency" OR "สำนักงานส่งเสริมเศรษฐกิจดิจิทัล"', hl: 'th-TH' })
                .then((items) => { if (mountedRef.current) setNews(Array.isArray(items) ? items : []); })
                .catch(() => { if (mountedRef.current) setNews([]); })
                .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
            return;
        }

        fetchLiveNews(activeSourceIds).then(data => {
            if (!mountedRef.current) return;
            if (!Array.isArray(data)) { setNews([]); return; }
            let sliceStart = 0;
            if (regionName === 'Global' || viewMode === 'indopacific') sliceStart = 5;
            if (regionName === 'Thailand' || viewMode === 'thailand') sliceStart = 10;

            setNews(data.slice(sliceStart, sliceStart + 5));
        }).catch(() => { if (mountedRef.current) setNews([]); })
          .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
    }, [regionName, activeSourceIds, viewMode]);

    useEffect(() => {
        const kickoff = setTimeout(fetchNews, 0);

        // Refresh regional news every 5 minutes
        const interval = setInterval(fetchNews, 5 * 60 * 1000);

        return () => {
            clearTimeout(kickoff);
            clearInterval(interval);
        };
    }, [fetchNews]);

    return (
        <div className="bottom-card flex-column">
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Rss size={14} /> {title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={fetchNews}
                        style={{ background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', padding: 0 }}
                        title="Force Refresh Data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                    </button>
                    <span style={{ fontSize: '0.65rem', color: news.length ? 'var(--green)' : 'var(--ink-3)', fontWeight: 'bold', background: 'var(--panel)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 0 }}>{news.length ? 'LIVE' : (isRefreshing ? '…' : 'NO SIGNAL')}</span>
                </div>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {news.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 'bold' }}>{item.source}</span>
                            <span>{safeDateString(item.pubDate)}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                            {item.title}
                        </div>
                    </a>
                ))}
                {news.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: '4px' }}>
                            {isRefreshing ? 'Connecting to live feeds...' : 'No live items are currently available.'}
                        </div>
                        <div style={{ fontSize: '0.5rem', color: 'var(--ink-3)' }}>
                            Connecting to live feeds...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegionalNewsPanel;
