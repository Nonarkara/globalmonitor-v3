import { fetchBackendJson } from './backendClient.js';
export const DEFAULT_SOURCE_IDS = ['bbc_world', 'bbc_middleeast', 'aljazeera', 'guardian_world', 'guardian_me', 'al_monitor', 'toi', 'jpost', 'reuters_world', 'ap_mideast', 'google_me', 'cna', 'bangkok_post', 'arab_news', 'rudaw', 'tasnim'];

export const KEYWORD_GROUPS = [
    { tag: 'strikes', weight: 22, terms: ['strike', 'missile', 'bomb', 'explosion', 'airstrike', 'drone', 'intercept', 'retaliation', 'attack', 'shelling', 'barrage'] },
    { tag: 'conflict', weight: 20, terms: ['iran', 'israel', 'irgc', 'idf', 'hezbollah', 'houthi', 'hamas', 'military', 'war', 'ceasefire', 'escalation', 'tensions'] },
    { tag: 'nuclear', weight: 18, terms: ['nuclear', 'enrichment', 'uranium', 'iaea', 'centrifuge', 'natanz', 'fordow', 'breakout'] },
    { tag: 'airspace', weight: 18, terms: ['airspace', 'flight', 'airport', 'airline', 'aviation', 'reroute', 'diversion', 'suspended', 'cancelled', 'no-fly'] },
    { tag: 'naval', weight: 16, terms: ['hormuz', 'strait', 'navy', 'naval', 'carrier', 'warship', 'fleet', 'persian gulf', 'gulf of oman', 'red sea'] },
    { tag: 'sanctions', weight: 14, terms: ['sanction', 'embargo', 'swift', 'treasury', 'ofac', 'blacklist', 'waiver', 'exemption'] },
    { tag: 'diplomacy', weight: 12, terms: ['diplomacy', 'negotiation', 'talks', 'un security council', 'foreign minister', 'ambassador', 'summit', 'jcpoa'] },
    { tag: 'energy', weight: 12, terms: ['oil', 'crude', 'brent', 'opec', 'gas', 'pipeline', 'energy', 'petroleum', 'lng', 'refinery'] },
    { tag: 'proxy', weight: 14, terms: ['proxy', 'militia', 'yemen', 'iraq', 'syria', 'lebanon', 'axis of resistance', 'pmu', 'quds force'] },
    { tag: 'humanitarian', weight: 10, terms: ['civilian', 'casualty', 'refugee', 'displacement', 'humanitarian', 'aid', 'crisis', 'shelter'] }
];

export const buildGoogleNewsSearchUrl = (query, locale = 'en-US') => {
    const [language = 'en', country = 'US'] = locale.split('-');
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}&gl=${country}&ceid=${country}:${language}`;
};

export const INTELLIGENCE_SOURCES = [
    { id: 'bbc_world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', group: 'worldwide', trustScore: 14 },
    { id: 'bbc_middleeast', name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', group: 'middle-east', trustScore: 15 },
    { id: 'bbc_business', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', group: 'worldwide', trustScore: 12 },
    { id: 'aljazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', group: 'middle-east', trustScore: 14 },
    { id: 'guardian_world', name: 'Guardian World', url: 'https://www.theguardian.com/world/rss', group: 'worldwide', trustScore: 12 },
    { id: 'guardian_me', name: 'Guardian ME', url: 'https://www.theguardian.com/world/middleeast/rss', group: 'middle-east', trustScore: 12 },
    { id: 'reuters_world', name: 'Reuters World', url: buildGoogleNewsSearchUrl('Reuters Middle East OR Iran OR Israel OR Gulf'), group: 'worldwide', trustScore: 15 },
    { id: 'ap_mideast', name: 'AP Middle East', url: buildGoogleNewsSearchUrl('AP News Middle East conflict OR Iran OR Israel'), group: 'middle-east', trustScore: 14 },
    { id: 'toi', name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', group: 'middle-east', trustScore: 12 },
    { id: 'jpost', name: 'Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', group: 'middle-east', trustScore: 12 },
    { id: 'iran_intl', name: 'Iran International', url: buildGoogleNewsSearchUrl('Iran International news Middle East'), group: 'middle-east', trustScore: 12 },
    { id: 'al_monitor', name: 'Al-Monitor', url: 'https://www.al-monitor.com/rss', group: 'middle-east', trustScore: 13 },
    { id: 'memo', name: 'Middle East Monitor', url: 'https://www.middleeastmonitor.com/feed/', group: 'middle-east', trustScore: 11 },
    { id: 'middle_east_eye', name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', group: 'middle-east', trustScore: 11 },
    { id: 'cna', name: 'Channel NewsAsia', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml', group: 'asia', trustScore: 11 },
    { id: 'bangkok_post', name: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/news.xml', group: 'thailand', trustScore: 9 },
    { id: 'diplomat', name: 'The Diplomat', url: 'https://thediplomat.com/feed/', group: 'asia', trustScore: 10 },
    { id: 'google_me', name: 'Google News ME', url: buildGoogleNewsSearchUrl('Middle East Iran Israel conflict latest'), group: 'middle-east', trustScore: 13 },
    { id: 'google_gulf', name: 'Google News Gulf', url: buildGoogleNewsSearchUrl('Gulf Strait of Hormuz Iran naval shipping'), group: 'middle-east', trustScore: 12 },
    { id: 'arab_news', name: 'Arab News', url: 'https://www.arabnews.com/rss.xml', group: 'middle-east', trustScore: 11 },
    { id: 'rudaw', name: 'Rudaw', url: 'https://www.rudaw.net/english/rss', group: 'middle-east', trustScore: 10 },
    { id: 'tasnim', name: 'Tasnim News', url: buildGoogleNewsSearchUrl('Tasnim News Agency Iran'), group: 'middle-east', trustScore: 8 },
];

export const APAC_SOURCES = INTELLIGENCE_SOURCES;

export const BRIEFING_DEFINITIONS = {
    iranStrikes: {
        id: 'iranStrikes',
        title: 'Iran Strikes & Military',
        description: 'Live strikes, missile launches, drone attacks, IRGC operations, and IDF responses across the theater.',
        queries: [
            'Iran Israel strike OR missile OR drone attack',
            'IRGC military operation OR launch OR retaliation',
            'Iran airstrike OR bombing OR intercept',
            'Israel Iran war escalation'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'middle-east'].includes(source.group),
        focusTags: ['strikes', 'conflict', 'airspace', 'naval'],
        primarySources: [
            { label: 'ACLED', url: 'https://acleddata.com/' },
            { label: 'ISW', url: 'https://www.understandingwar.org/' },
            { label: 'Janes', url: 'https://www.janes.com/' }
        ],
        fallbackItems: [
            { title: 'Tracking live strike activity, IRGC operations, and IDF responses.', link: 'https://www.understandingwar.org/', source: 'Monitor', pubDate: new Date(), tags: ['strikes', 'conflict'] }
        ]
    },
    iranDiplomacy: {
        id: 'iranDiplomacy',
        title: 'Diplomacy & Sanctions',
        description: 'Nuclear talks, JCPOA status, UN Security Council, sanctions enforcement, and diplomatic channels.',
        queries: [
            'Iran nuclear talks OR JCPOA OR enrichment',
            'Iran sanctions OR OFAC OR embargo',
            'Iran diplomacy OR UN Security Council OR IAEA',
            'Iran foreign minister OR ambassador OR negotiations'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'middle-east'].includes(source.group),
        focusTags: ['nuclear', 'sanctions', 'diplomacy', 'conflict'],
        primarySources: [
            { label: 'IAEA', url: 'https://www.iaea.org/' },
            { label: 'US Treasury', url: 'https://ofac.treasury.gov/' },
            { label: 'UN News', url: 'https://news.un.org/en/' }
        ],
        fallbackItems: [
            { title: 'Monitoring nuclear program status, sanctions regime, and diplomatic developments.', link: 'https://www.iaea.org/', source: 'Monitor', pubDate: new Date(), tags: ['nuclear', 'diplomacy'] }
        ]
    },
    gulfSecurity: {
        id: 'gulfSecurity',
        title: 'Gulf & Strait of Hormuz',
        description: 'Naval movements, strait traffic, airspace closures, Gulf state responses, and energy infrastructure threats.',
        queries: [
            '"Strait of Hormuz" OR "Persian Gulf" naval OR shipping',
            'Gulf airspace closure OR flight reroute Iran',
            'Iran navy OR IRGC naval OR tanker seizure',
            'Emirates Etihad Qatar Airways flights Iran'
        ],
        locale: 'en-AE',
        sourceFilter: (source) => ['worldwide', 'middle-east'].includes(source.group),
        focusTags: ['naval', 'airspace', 'energy', 'conflict'],
        primarySources: [
            { label: 'MarineTraffic', url: 'https://www.marinetraffic.com/' },
            { label: 'FlightRadar24', url: 'https://www.flightradar24.com/' },
            { label: 'OpenSky', url: 'https://opensky-network.org/' }
        ],
        fallbackItems: [
            { title: 'Tracking Gulf naval activity, strait shipping, and airspace disruptions.', link: 'https://www.marinetraffic.com/', source: 'Monitor', pubDate: new Date(), tags: ['naval', 'airspace'] }
        ]
    },
    proxyTheater: {
        id: 'proxyTheater',
        title: 'Proxy & Regional Spillover',
        description: 'Hezbollah, Houthi, Iraqi militias, Syrian theater, and axis-of-resistance activity across the region.',
        queries: [
            'Hezbollah Lebanon Israel OR attack OR rocket',
            'Houthi Yemen Red Sea OR shipping OR attack',
            'Iraq militia Iran proxy OR PMU',
            'Syria Iran IRGC OR Israel strike'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'middle-east'].includes(source.group),
        focusTags: ['proxy', 'conflict', 'strikes', 'humanitarian'],
        primarySources: [
            { label: 'ReliefWeb', url: 'https://reliefweb.int/' },
            { label: 'ACLED', url: 'https://acleddata.com/' },
            { label: 'Crisis Group', url: 'https://www.crisisgroup.org/' }
        ],
        fallbackItems: [
            { title: 'Monitoring proxy forces, regional spillover, and axis-of-resistance movements.', link: 'https://www.crisisgroup.org/', source: 'Monitor', pubDate: new Date(), tags: ['proxy', 'conflict'] }
        ]
    },
    energyMarkets: {
        id: 'energyMarkets',
        title: 'Energy & Oil Impact',
        description: 'Oil prices, OPEC response, energy supply disruptions, sanctions impact on global markets.',
        queries: [
            'oil price Iran conflict OR sanctions OR supply',
            'OPEC Iran production OR output',
            'Brent crude Iran OR Middle East tension',
            'energy supply disruption Iran OR Gulf'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'middle-east'].includes(source.group),
        focusTags: ['energy', 'sanctions', 'conflict', 'naval'],
        primarySources: [
            { label: 'OPEC', url: 'https://www.opec.org/' },
            { label: 'EIA', url: 'https://www.eia.gov/' },
            { label: 'Bloomberg', url: 'https://www.bloomberg.com/energy' }
        ],
        fallbackItems: [
            { title: 'Tracking energy market impacts from Iran conflict and sanctions enforcement.', link: 'https://www.opec.org/', source: 'Monitor', pubDate: new Date(), tags: ['energy', 'sanctions'] }
        ]
    },
    southChinaSea: {
        id: 'southChinaSea',
        title: 'South China Sea',
        description: 'Territorial disputes, naval incidents, UNCLOS claims, Taiwan Strait tensions, and ASEAN maritime security.',
        queries: [
            '"South China Sea" OR "Taiwan Strait" tension OR incident',
            'China Philippines OR Vietnam OR Malaysia territorial OR vessel',
            'Taiwan China military OR exercise OR incursion',
            'ASEAN maritime OR "Nine-Dash Line" OR UNCLOS'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'asia'].includes(source.group),
        focusTags: ['naval', 'conflict', 'diplomacy', 'airspace'],
        primarySources: [
            { label: 'CSIS Asia', url: 'https://www.csis.org/programs/asia-maritime-transparency-initiative' },
            { label: 'AMTI', url: 'https://amti.csis.org/' },
            { label: 'Reuters Asia', url: 'https://www.reuters.com/world/asia-pacific/' }
        ],
        fallbackItems: [
            { title: 'Tracking South China Sea incidents, UNCLOS disputes, and Taiwan Strait activity.', link: 'https://amti.csis.org/', source: 'Monitor', pubDate: new Date(), tags: ['naval', 'conflict'] }
        ]
    },
    myanmarConflict: {
        id: 'myanmarConflict',
        title: 'Myanmar Conflict & Border',
        description: 'Myanmar civil war, SAC junta operations, resistance forces, refugee flows, and Thailand border security.',
        queries: [
            'Myanmar civil war OR junta OR SAC OR resistance',
            'Myanmar Thailand border OR refugee OR displaced',
            'Myanmar Sagaing OR Shan OR Karen OR Kachin conflict',
            'Myanmar coup military OR airstrike OR ceasefire'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'asia'].includes(source.group),
        focusTags: ['conflict', 'humanitarian', 'strikes', 'proxy'],
        primarySources: [
            { label: 'ACLED', url: 'https://acleddata.com/' },
            { label: 'Irrawaddy', url: 'https://www.irrawaddy.com/' },
            { label: 'ReliefWeb', url: 'https://reliefweb.int/country/mmr' }
        ],
        fallbackItems: [
            { title: 'Monitoring Myanmar civil conflict, SAC operations, and cross-border refugee movements.', link: 'https://www.irrawaddy.com/', source: 'Monitor', pubDate: new Date(), tags: ['conflict', 'humanitarian'] }
        ]
    },
    aseanDiplomacy: {
        id: 'aseanDiplomacy',
        title: 'ASEAN Geopolitics',
        description: 'ASEAN summit decisions, US-China rivalry, trade agreements, AUKUS impact, and regional alliance shifts.',
        queries: [
            'ASEAN summit OR statement OR agreement OR chair',
            'US China ASEAN OR Southeast Asia competition OR influence',
            'AUKUS OR Quad OR "Five Eyes" Asia Pacific',
            'RCEP OR CPTPP OR ASEAN trade OR supply chain'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'asia'].includes(source.group),
        focusTags: ['diplomacy', 'energy', 'sanctions', 'conflict'],
        primarySources: [
            { label: 'ASEAN Secretariat', url: 'https://asean.org/news/' },
            { label: 'ISEAS', url: 'https://www.iseas.edu.sg/' },
            { label: 'East Asia Forum', url: 'https://www.eastasiaforum.org/' }
        ],
        fallbackItems: [
            { title: 'Monitoring ASEAN bloc decisions, US-China strategic competition, and regional trade dynamics.', link: 'https://asean.org/news/', source: 'Monitor', pubDate: new Date(), tags: ['diplomacy', 'conflict'] }
        ]
    },
    thaiSecurity: {
        id: 'thaiSecurity',
        title: 'Thailand Security',
        description: 'Southern insurgency, political stability, ISOC operations, border security, and Thai-Myanmar frontier.',
        queries: [
            'Thailand southern insurgency OR Pattani OR BRN OR separatist',
            'Thailand Myanmar border OR military OR security OR Mae Sot',
            'Thailand political stability OR protest OR election OR coup',
            'ISOC Thailand OR "Internal Security Operations Command"'
        ],
        locale: 'en-US',
        sourceFilter: (source) => ['worldwide', 'asia', 'thailand'].includes(source.group),
        focusTags: ['conflict', 'humanitarian', 'diplomacy', 'strikes'],
        primarySources: [
            { label: 'Bangkok Post', url: 'https://www.bangkokpost.com/' },
            { label: 'Benar News', url: 'https://www.benarnews.org/thai/' },
            { label: 'ACLED Thailand', url: 'https://acleddata.com/asia/' }
        ],
        fallbackItems: [
            { title: 'Monitoring Thailand southern security, political developments, and Myanmar border situation.', link: 'https://www.bangkokpost.com/', source: 'Monitor', pubDate: new Date(), tags: ['conflict', 'diplomacy'] }
        ]
    }
};

const sourceById = new Map(INTELLIGENCE_SOURCES.map((source) => [source.id, source]));

export const fetchBriefing = async (briefingId, activeSourceIds = null) => {
    const backendData = await fetchBackendJson(`/api/briefings/${briefingId}`, {
        sourceIds: Array.isArray(activeSourceIds) ? activeSourceIds.join(',') : undefined
    });

    if (backendData?.items?.length > 0) return backendData;

    // Backend returned empty — use briefing fallback items if available
    const briefing = BRIEFING_DEFINITIONS[briefingId];
    if (!briefing) throw new Error(`Unknown briefing: ${briefingId}`);

    return {
        ...briefing,
        items: briefing.fallbackItems || [],
        stats: { total: 0, highPriority: 0, dominantTags: [], lastUpdated: new Date().toISOString() },
        summary: 'No live items were returned on the latest pull. Use the official source links while the feed refreshes.'
    };
};

export const fetchLiveNews = async (activeSourceIds = null) => {
    const backendData = await fetchBackendJson('/api/ticker', {
        sourceIds: Array.isArray(activeSourceIds) ? activeSourceIds.join(',') : undefined
    });

    if (Array.isArray(backendData) && backendData.length > 0) return backendData;

    return [];
};

export const getSourceById = (sourceId) => sourceById.get(sourceId);
