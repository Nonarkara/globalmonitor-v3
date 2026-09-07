/**
 * Multi-Front Status Board — computes per-front status from cached FIRMS + ticker data.
 * Follows the same pattern as escalation.mjs (cache-based composite scoring).
 *
 * Two honesty rules, both copied from escalation.mjs:
 *  - sample/demo fires are never counted; only live VIIRS detections score.
 *  - an empty cache returns `fronts: []` with reason 'no-signal', never seven
 *    green STABLE cards. Absence of signal is not an all-clear.
 * "Fires" here are unfiltered VIIRS thermal anomalies inside a rectangle —
 * gas flares and crop burning included — so the payload names the field
 * `thermalCount` and the board should label it that way.
 */

const FRONTS = [
    {
        id: 'iran',
        name: 'Iran Theater',
        icon: 'crosshair',
        bbox: [44, 25, 63, 40],
        keywords: ['iran', 'irgc', 'tehran', 'isfahan', 'natanz', 'khamenei', 'persian gulf', 'iranian'],
        warStart: '2026-02-28'
    },
    {
        id: 'lebanon',
        name: 'Lebanon / Hezbollah',
        icon: 'shield',
        bbox: [35, 33, 36.5, 34.7],
        keywords: ['hezbollah', 'lebanon', 'beirut', 'south lebanon', 'litani', 'nasrallah'],
        // No dated milestone exists in this codebase for a Lebanon "day 1";
        // a DAY N counter with no basis is an invented number. Null until one
        // is added with a citation.
        warStart: null
    },
    {
        id: 'gaza',
        name: 'Gaza Ceasefire',
        icon: 'alert-triangle',
        bbox: [34.1, 31.2, 34.6, 31.6],
        keywords: ['gaza', 'gaza ceasefire', 'hamas', 'rafah', 'khan younis'],
        warStart: null
    },
    {
        id: 'iraq',
        name: 'Iraq Militias',
        icon: 'flame',
        bbox: [38, 29, 48, 38],
        keywords: ['iraq', 'iraqi militia', 'kurdistan', 'erbil', 'pmu', 'kataib', 'iraqi resistance'],
        warStart: null
    },
    {
        id: 'redsea',
        name: 'Red Sea / Houthi',
        icon: 'anchor',
        bbox: [36, 10, 50, 22],
        keywords: ['houthi', 'red sea', 'bab el-mandeb', 'yemen', 'aden', 'shipping attack'],
        warStart: null
    },
    {
        id: 'hormuz',
        name: 'Strait of Hormuz',
        icon: 'ship',
        bbox: [54, 24, 58, 28],
        keywords: ['hormuz', 'strait of hormuz', 'tanker', 'blockade', 'persian gulf', 'oil transit'],
        warStart: null
    },
    {
        id: 'syria',
        name: 'Syria Transition',
        icon: 'map',
        bbox: [35, 32, 42, 37],
        keywords: ['syria', 'sdf', 'al-sharaa', 'damascus', 'hts', 'idlib'],
        warStart: null
    }
];

const getStatus = (score) => {
    // Rams severity ramp: green (stable) → neutral greys → brick red (critical).
    if (score >= 70) return { status: 'CRITICAL', color: '#a23a26' };
    if (score >= 40) return { status: 'ACTIVE', color: '#6f6c63' };
    if (score >= 15) return { status: 'ELEVATED', color: '#8f8b80' };
    return { status: 'STABLE', color: '#1f6e43' };
};

const isInBbox = (lon, lat, bbox) =>
    lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];

const NON_LIVE_SOURCE = /sample|fallback|demo|no_[a-z_]*key/i;
const DAY_MS = 86400000;

export const computeFrontStatus = (serverCache, theater = 'middleeast') => {
    // Get FIRMS data — only live detections count toward a front's score.
    const firmsEntry = serverCache.get(`firms:${theater}`);
    const firmsSource = firmsEntry?.payload?.meta?.source || '';
    const firmsIsLive = Boolean(firmsEntry?.payload?.features?.length) && !NON_LIVE_SOURCE.test(firmsSource);
    const fires = firmsIsLive ? firmsEntry.payload.features : [];

    // Get ticker items
    let tickerItems = [];
    for (const [key, entry] of serverCache.entries()) {
        if (key.startsWith('ticker:') && Array.isArray(entry?.payload)) {
            tickerItems = entry.payload;
            break;
        }
    }

    // Get briefing items
    const briefingItems = [];
    for (const [key, entry] of serverCache.entries()) {
        if (key.startsWith('briefing:') && Array.isArray(entry?.payload?.items)) {
            briefingItems.push(...entry.payload.items);
        }
    }

    const now = Date.now();
    // The board says "24h": enforce it. Undated items are excluded rather than
    // awarded maximum recency.
    const allNews = [...tickerItems, ...briefingItems].filter((item) => {
        if (!item?.pubDate) return false;
        const age = now - new Date(item.pubDate).getTime();
        return Number.isFinite(age) && age >= 0 && age < DAY_MS;
    });

    const sourceHealth = {
        firms: firmsEntry?.payload?.features?.length ? (firmsIsLive ? 'live' : 'sample') : 'offline',
        news: allNews.length > 0 ? 'live' : 'offline'
    };

    // Cold cache: nothing to score. Say so instead of drawing seven STABLE cards.
    if (!firmsIsLive && allNews.length === 0) {
        return {
            fronts: [],
            reason: 'no-signal',
            sourceHealth,
            theater,
            windowHours: 24,
            updatedAt: new Date().toISOString()
        };
    }

    const fronts = FRONTS.map((front) => {
        // Count thermal anomalies in bbox
        const thermalCount = fires.filter((f) => {
            const [lon, lat] = f.geometry?.coordinates || [];
            return isInBbox(lon, lat, front.bbox);
        }).length;

        const matchingNews = allNews
            .filter((item) => {
                const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
                return front.keywords.some((kw) => text.includes(kw));
            })
            .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

        const keywordHits = matchingNews.length;
        const lastEvent = matchingNews[0]?.pubDate || null;
        const latestHeadline = matchingNews[0]?.title || null;

        // Composite score (0-100)
        const fireScore = Math.min(40, thermalCount * 4);
        const newsScore = Math.min(40, keywordHits * 3);
        const recencyBonus = lastEvent && (now - new Date(lastEvent).getTime()) < 3600000 ? 20 : 0;
        const total = Math.min(100, fireScore + newsScore + recencyBonus);

        const { status, color } = getStatus(total);

        // Day count if war started
        let dayCount = null;
        if (front.warStart) {
            const start = new Date(front.warStart);
            dayCount = Math.floor((now - start.getTime()) / DAY_MS);
        }

        return {
            id: front.id,
            name: front.name,
            icon: front.icon,
            score: total,
            status,
            color,
            thermalCount,
            // kept for existing consumers; same value, honest name above
            fireCount: thermalCount,
            newsHits: keywordHits,
            lastEvent,
            latestHeadline,
            dayCount
        };
    });

    return {
        fronts,
        sourceHealth,
        theater,
        windowHours: 24,
        updatedAt: new Date().toISOString()
    };
};
