/**
 * Strike Statistics — extracts missile/drone/interception counts
 * from intelligence feed headlines using regex patterns.
 *
 * This is a HEADLINE-MENTION statistic, not a strike count: "12 missiles" in
 * two outlets' headlines is 24 here. Consumers must label it as mentions.
 *
 * Pure function: the totals are computed from what is in the cache right now,
 * on every call. The previous version accumulated into a module-level Map, so
 * every request re-added the same headlines and the counters grew with
 * traffic rather than with events.
 */

const PATTERNS = {
    missiles: /(\d+)\s*(?:missiles?|rockets?|ballistic)/gi,
    drones: /(\d+)\s*(?:drones?|UAVs?|UAS)/gi,
    interceptions: /intercept(?:ed|ion|s)/gi,
    casualties: /(\d+)\s*(?:killed|dead|casualties|fatalities)/gi
};

const extractCount = (text, pattern) => {
    let total = 0;
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) total += num;
    }
    return total;
};

const getDateKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const zeroDay = () => ({ missiles: 0, drones: 0, interceptions: 0, casualties: 0 });

export const computeStrikeStats = (serverCache) => {
    const dailyStats = new Map();
    const todayKey = getDateKey(new Date());
    const sources = new Set();
    const seen = new Set();
    let headlineCount = 0;

    // Scan all briefing caches
    const briefingEntries = Array.from(serverCache.entries())
        .filter(([key]) => key.startsWith('briefing:'));

    for (const [, entry] of briefingEntries) {
        if (!Array.isArray(entry?.payload?.items)) continue;

        for (const item of entry.payload.items) {
            const title = item.title || '';
            // The same headline appears in several briefing caches; count it once.
            const dedupeKey = (item.link || title).trim().toLowerCase();
            if (!dedupeKey || seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            headlineCount += 1;

            // Undated items are not assigned to today — they have no day.
            if (!item.pubDate) continue;
            const dateKey = getDateKey(item.pubDate);

            if (!dailyStats.has(dateKey)) dailyStats.set(dateKey, zeroDay());
            const day = dailyStats.get(dateKey);

            day.missiles += extractCount(title, PATTERNS.missiles);
            day.drones += extractCount(title, PATTERNS.drones);
            day.interceptions += (title.match(PATTERNS.interceptions) || []).length;
            day.casualties += extractCount(title, PATTERNS.casualties);

            if (item.source) sources.add(item.source);
        }
    }

    // Build 7-day array
    const daily = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = getDateKey(d);
        daily.push({ date: key, ...(dailyStats.get(key) || zeroDay()) });
    }

    const weekTotal = daily.reduce((acc, d) => ({
        missiles: acc.missiles + d.missiles,
        drones: acc.drones + d.drones,
        interceptions: acc.interceptions + d.interceptions,
        casualties: acc.casualties + d.casualties
    }), zeroDay());

    const current = dailyStats.get(todayKey) || zeroDay();

    return {
        current,
        daily,
        weekTotal,
        headlineCount,
        method: 'regex over headlines, deduplicated by link; mentions, not verified counts',
        sources: Array.from(sources).slice(0, 6),
        source: headlineCount > 0 ? 'headline_mentions' : 'no_signal'
    };
};
