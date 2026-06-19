/**
 * GDELT Sentiment — fetches tone/sentiment timeline for Middle East region.
 */

export const fetchGdeltSentiment = async (theater = 'middleeast') => {
    const query = theater === 'thailand'
        ? 'Thailand OR Bangkok OR Myanmar border'
        : theater === 'indopacific'
            ? 'Thailand OR Singapore OR Vietnam OR Philippines'
            : 'Iran OR Israel OR Gulf OR Hormuz';

    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=timelinetone&timespan=7d&format=json`;

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) throw new Error(`GDELT ${res.status}`);

        const data = await res.json();
        const timeline = (data.timeline || []).find(t => t.series)?.data || [];

        return {
            timeline: timeline.map(point => ({
                date: point.date,
                tone: point.value
            })).slice(-50),
            query,
            fetchedAt: new Date().toISOString()
        };
    } catch (err) {
        console.error('GDELT error:', err.message);
        return { timeline: [], query, fetchedAt: new Date().toISOString() };
    }
};
