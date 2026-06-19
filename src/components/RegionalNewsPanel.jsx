import React, { useEffect, useState, useCallback, useRef } from 'react';
import { fetchLiveNews } from '../services/liveNews';
import { Rss, RefreshCw } from 'lucide-react';

const safeDateString = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '--:--';
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

    const parseDepaXml = (xml) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        if (xmlDoc.querySelector("parsererror")) return [];
        const items = xmlDoc.querySelectorAll("item");
        const depaQueryStr = '"Digital Economy Promotion Agency" OR "สำนักงานส่งเสริมเศรษฐกิจดิจิทัล"';
        const newsItems = [];
        Array.from(items).forEach(item => {
            const itemTitle = item.querySelector("title")?.textContent;
            const link = item.querySelector("link")?.textContent;
            const pubDateStr = item.querySelector("pubDate")?.textContent;
            const source = item.querySelector("source")?.textContent || 'Google News';
            if (itemTitle && link) {
                if (itemTitle.includes(depaQueryStr) || itemTitle === 'Google News') return;
                newsItems.push({ title: itemTitle, link, pubDate: pubDateStr ? new Date(pubDateStr) : new Date(), source });
            }
        });
        return newsItems.slice(0, 5);
    };

    const fetchNews = useCallback(() => {
        setIsRefreshing(true);

        // Google News RSS-backed regions — fetched direct, not from liveNews aggregate
        const RSS_REGIONS = {
            Myanmar:      '"Myanmar" conflict OR border OR refugee OR junta',
            SouthChinaSea:'"South China Sea" OR "Taiwan Strait" tension OR naval OR incident',
            ASEAN:        'ASEAN geopolitics OR diplomacy OR summit OR "Southeast Asia"',
            Taiwan:       'Taiwan China military OR strait OR exercise OR invasion',
        };
        if (RSS_REGIONS[regionName]) {
            const q = encodeURIComponent(RSS_REGIONS[regionName]);
            const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en&cb=${Date.now()}`;
            const encoded = encodeURIComponent(rssUrl);
            const parseXml = (xml) => {
                const doc = new DOMParser().parseFromString(xml, 'text/xml');
                if (doc.querySelector('parsererror')) return [];
                return Array.from(doc.querySelectorAll('item')).slice(0, 5).map(item => ({
                    title: item.querySelector('title')?.textContent,
                    link: item.querySelector('link')?.textContent,
                    pubDate: new Date(item.querySelector('pubDate')?.textContent || Date.now()),
                    source: item.querySelector('source')?.textContent || 'Google News',
                })).filter(it => it.title && it.link && it.title !== 'Google News');
            };
            (async () => {
                let items = null;
                try { const r = await fetch(`https://api.allorigins.win/get?url=${encoded}`); items = parseXml((await r.json())?.contents || ''); } catch { /* try next proxy */ }
                if (!items?.length) try { const r = await fetch(`https://corsproxy.io/?url=${encoded}`); items = parseXml(await r.text()); } catch { /* fall through to empty state */ }
                if (mountedRef.current) setNews(items || []);
            })().catch(() => { if (mountedRef.current) setNews([]); })
              .finally(() => { if (mountedRef.current) setIsRefreshing(false); });
            return;
        }

        if (regionName === 'DEPA') {
            const depaSearchUrl = 'https://news.google.com/rss/search?q="Digital+Economy+Promotion+Agency"+OR+"สำนักงานส่งเสริมเศรษฐกิจดิจิทัล"&hl=th&gl=TH&ceid=TH:th';
            const freshUrl = depaSearchUrl + '&cb=' + Date.now();
            const encoded = encodeURIComponent(freshUrl);

            const tryProxy = async (url, extract) => {
                const res = await fetch(url);
                const data = await res.json();
                const xml = extract(data);
                if (!xml) throw new Error('No XML');
                const items = parseDepaXml(xml);
                if (items.length === 0) throw new Error('No items');
                return items;
            };

            const tryRawProxy = async (url) => {
                const res = await fetch(url);
                const text = await res.text();
                if (!text.includes('<')) throw new Error('Not XML');
                const items = parseDepaXml(text);
                if (items.length === 0) throw new Error('No items');
                return items;
            };

            (async () => {
                let items = null;
                try { items = await tryProxy(`https://api.allorigins.win/get?url=${encoded}`, d => d?.contents); } catch { items = items || null; }
                if (!items) try { items = await tryRawProxy(`https://api.codetabs.com/v1/proxy?quest=${encoded}`); } catch { items = items || null; }
                if (!items) try { items = await tryRawProxy(`https://corsproxy.io/?url=${encoded}`); } catch { items = items || null; }
                if (mountedRef.current) setNews(items || []);
            })()
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
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                        title="Force Refresh Data"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--bg-dark)', fontWeight: 'bold', background: 'var(--accent-blue)', padding: '2px 6px', borderRadius: '4px' }}>LIVE</span>
                </div>
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {news.map((item, i) => (
                    <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
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
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>
                            {isRefreshing ? 'Connecting to live feeds...' : 'No live items are currently available.'}
                        </div>
                        <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.15)' }}>
                            Connecting to live feeds...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegionalNewsPanel;
