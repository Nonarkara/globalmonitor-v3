import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Rss, RefreshCw, Zap, Cpu } from 'lucide-react';
import { ASEAN_COUNTRIES, THAILAND_REGIONS } from '../data/regions.js';
import { fetchAseanCountryNews, fetchThaiRegionNews } from '../services/regionalCountryNews.js';

const safeTime = (d) => {
    if (!(d instanceof Date) || isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Per-country localStorage cache so switching to a previously-visited country
// shows items instantly (zero-latency feel) while a fresh fetch kicks off in
// the background. Cache TTL is informational — we always show the cache, then
// overwrite on success.
const CACHE_PREFIX = 'cnp:';
const cacheGet = (key) => {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.items?.map((it) => ({ ...it, pubDate: new Date(it.pubDate) })) || null;
    } catch { return null; }
};
const cacheSet = (key, items) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), items }));
    } catch { /* quota or disabled */ }
};

/**
 * Region-aware country / province news panel.
 *
 *   <CountryNewsPanel mode="indopacific" selectedCode={selectedCountry} onSelect={setSelectedCountry} />
 *   <CountryNewsPanel mode="thailand"    selectedCode={selectedProvince} onSelect={setSelectedProvince} />
 *
 * The chooser strip is a horizontal scrollable row of country/region chips.
 * Click a chip → selects that country → fetches its news. Auto-refreshes every 5 min.
 */
const CountryNewsPanel = ({ mode = 'indopacific', selectedCode, onSelect }) => {
    const items = mode === 'thailand' ? THAILAND_REGIONS : ASEAN_COUNTRIES;
    const labelKey = mode === 'thailand' ? 'name' : 'name';
    const codeKey = 'code';
    const fetcher = mode === 'thailand' ? fetchThaiRegionNews : fetchAseanCountryNews;
    const title = mode === 'thailand' ? 'Thailand Regions' : 'ASEAN Countries';

    const fallbackCode = items[0]?.[codeKey];
    const [localCode, setLocalCode] = useState(selectedCode || fallbackCode);
    const activeCode = selectedCode || (items.some((item) => item[codeKey] === localCode) ? localCode : fallbackCode);
    const [news, setNews] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const mounted = useRef(true);

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const load = useCallback(() => {
        if (!activeCode) return;
        const cacheKey = `${mode}:${activeCode}`;
        // Show cache instantly so the panel never looks empty when you click around.
        const cached = cacheGet(cacheKey);
        if (cached?.length) setNews(cached);
        setIsRefreshing(true);
        fetcher(activeCode)
            .then((r) => {
                if (!mounted.current) return;
                const items = r.items || [];
                if (items.length) {
                    setNews(items);
                    cacheSet(cacheKey, items);
                } else if (!cached?.length) {
                    setNews([]);
                }
            })
            .catch(() => { if (mounted.current && !cached?.length) setNews([]); })
            .finally(() => { if (mounted.current) setIsRefreshing(false); });
    }, [activeCode, fetcher, mode]);

    useEffect(() => {
        const t = setTimeout(load, 0);
        const i = setInterval(load, 5 * 60 * 1000);
        return () => { clearTimeout(t); clearInterval(i); };
    }, [load]);

    const handleSelect = (code) => {
        setLocalCode(code);
        onSelect?.(code);
    };

    return (
        <div className="bottom-card flex-column" style={{ minWidth: 0 }}>
            <div className="panel-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Rss size={14} /> {title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={load}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
                    </button>
                    <span style={{ fontSize: '0.65rem', color: 'var(--bg-dark)', fontWeight: 'bold', background: 'var(--accent-blue)', padding: '2px 6px' }}>LIVE</span>
                </div>
            </div>

            {/* Country / region chooser strip */}
            <div
                style={{
                    display: 'flex',
                    gap: 6,
                    overflowX: 'auto',
                    padding: '6px 8px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    scrollbarWidth: 'thin'
                }}
            >
                {items.map((it) => {
                    const code = it[codeKey];
                    const label = it[labelKey];
                    const isActive = code === activeCode;
                    return (
                        <button
                            key={code}
                            onClick={() => handleSelect(code)}
                            style={{
                                flexShrink: 0,
                                minHeight: 28,
                                padding: '4px 10px',
                                background: isActive ? 'rgba(56,189,248,0.18)' : 'transparent',
                                border: isActive ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(255,255,255,0.08)',
                                color: isActive ? '#dbeafe' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.65rem',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                cursor: 'pointer'
                            }}
                            title={label}
                        >
                            {code} {isActive ? '·' : ''} {isActive && <span style={{ textTransform: 'none', letterSpacing: 0 }}>{label}</span>}
                        </button>
                    );
                })}
            </div>

            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {news.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                        {isRefreshing ? 'Connecting to live feeds…' : 'No live items right now.'}
                    </div>
                )}
                {news.map((item, i) => (
                    <a
                        key={`${item.link}-${i}`}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            textDecoration: 'none',
                            color: 'inherit',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            paddingBottom: '8px',
                            display: 'block'
                        }}
                    >
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {item.tag === 'urgent' ? <Zap size={9} style={{ color: '#ef4444' }} /> : <Cpu size={9} style={{ color: '#38bdf8' }} />}
                                <span style={{ fontWeight: 'bold' }}>{item.source}</span>
                            </span>
                            <span>{safeTime(item.pubDate)}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>{item.title}</div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default CountryNewsPanel;
