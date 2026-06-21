/**
 * Region registry — single source of truth for the three theaters
 * the dashboard supports: Middle East, Indo-Pacific (ASEAN), Thailand.
 *
 * Each region carries everything the rest of the app needs to switch into it
 * with no waiting: camera viewState, dot data for the map, RSS news sources,
 * and live-TV channel definitions. Add or remove a theater here and it
 * propagates through MapContainer, LiveTVPanel, news panels, and App.jsx.
 */

import { buildGoogleNewsSearchUrl } from '../services/liveNews.js';

// ---------------------------------------------------------------------------
// View states (camera position) per region
// ---------------------------------------------------------------------------

export const REGION_VIEW_STATES = {
    middleeast: { longitude: 53, latitude: 30, zoom: 4.5, pitch: 25, bearing: -8 },
    indopacific: { longitude: 110, latitude: 5, zoom: 3.6, pitch: 0, bearing: 0 },
    thailand: { longitude: 100.9925, latitude: 14.5, zoom: 5.6, pitch: 20, bearing: 0 },
    global: { longitude: 0, latitude: 20, zoom: 1.7, pitch: 20, bearing: -10 }
};

// ---------------------------------------------------------------------------
// ASEAN-10 capitals — rendered as dots on the Indo-Pacific map.
// Each dot links to a news query keyed by ISO country code.
// ---------------------------------------------------------------------------

export const ASEAN_COUNTRIES = [
    { code: 'TH', name: 'Thailand',     capital: 'Bangkok',         lng: 100.5018, lat: 13.7563 },
    { code: 'VN', name: 'Vietnam',      capital: 'Hanoi',           lng: 105.8542, lat: 21.0285 },
    { code: 'ID', name: 'Indonesia',    capital: 'Jakarta',         lng: 106.8456, lat:  -6.2088 },
    { code: 'MY', name: 'Malaysia',     capital: 'Kuala Lumpur',    lng: 101.6869, lat:   3.1390 },
    { code: 'SG', name: 'Singapore',    capital: 'Singapore',       lng: 103.8198, lat:   1.3521 },
    { code: 'PH', name: 'Philippines',  capital: 'Manila',          lng: 120.9842, lat:  14.5995 },
    { code: 'MM', name: 'Myanmar',      capital: 'Naypyidaw',       lng:  96.0785, lat:  19.7633 },
    { code: 'KH', name: 'Cambodia',     capital: 'Phnom Penh',      lng: 104.9282, lat:  11.5564 },
    { code: 'LA', name: 'Laos',         capital: 'Vientiane',       lng: 102.6331, lat:  17.9757 },
    { code: 'BN', name: 'Brunei',       capital: 'Bandar Seri Begawan', lng: 114.9398, lat: 4.9031 }
];

export const ASEAN_DOTS_GEOJSON = {
    type: 'FeatureCollection',
    features: ASEAN_COUNTRIES.map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
            id: `asean-${c.code}`,
            kind: 'asean-country',
            country: c.name,
            countryCode: c.code,
            capital: c.capital,
            color: '#38bdf8',
            label: c.name.toUpperCase()
        }
    }))
};

// ---------------------------------------------------------------------------
// Thailand provinces / regions — six economic-region anchors plus Bangkok
// for the Thailand-only view.
// ---------------------------------------------------------------------------

export const THAILAND_REGIONS = [
    { code: 'BKK',     name: 'Bangkok',          lng: 100.5018, lat: 13.7563 },
    { code: 'CNX',     name: 'Chiang Mai',       lng:  98.9853, lat: 18.7883 },
    { code: 'KKC',     name: 'Khon Kaen',        lng: 102.8333, lat: 16.4419 },
    { code: 'PHK',     name: 'Phuket',           lng:  98.3923, lat:  7.8804 },
    { code: 'HDY',     name: 'Hat Yai',          lng: 100.4730, lat:  7.0084 },
    { code: 'EEC',     name: 'EEC (Chonburi)',   lng: 101.0667, lat: 13.3611 },
    { code: 'KOR',     name: 'Nakhon Ratchasima',lng: 102.0840, lat: 14.9799 },
    { code: 'UDN',     name: 'Udon Thani',       lng: 102.7884, lat: 17.4138 }
];

export const THAILAND_DOTS_GEOJSON = {
    type: 'FeatureCollection',
    features: THAILAND_REGIONS.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
            id: `thai-${p.code}`,
            kind: 'thailand-region',
            region: p.name,
            regionCode: p.code,
            color: '#D4A843',
            label: p.name.toUpperCase()
        }
    }))
};

// ---------------------------------------------------------------------------
// Per-country news queries — Google News RSS combining tech + urgent news.
// Each entry is for one ASEAN country. Same shape used for Thailand province.
// ---------------------------------------------------------------------------

const tq = (terms) => buildGoogleNewsSearchUrl(terms, 'en-US');

export const ASEAN_NEWS_QUERIES = {
    TH: {
        tech:   tq('Thailand technology OR startup OR digital economy OR DEPA OR fintech'),
        urgent: tq('Thailand breaking news OR protest OR flood OR accident')
    },
    VN: {
        tech:   tq('Vietnam technology OR startup OR semiconductor OR VinFast OR Vingroup'),
        urgent: tq('Vietnam breaking news OR typhoon OR protest OR conflict')
    },
    ID: {
        tech:   tq('Indonesia technology OR Gojek OR GoTo OR startup OR EV battery'),
        urgent: tq('Indonesia breaking news OR earthquake OR volcano OR Jakarta')
    },
    MY: {
        tech:   tq('Malaysia technology OR semiconductor OR Penang OR data center'),
        urgent: tq('Malaysia breaking news OR flood OR politics OR Anwar')
    },
    SG: {
        tech:   tq('Singapore technology OR fintech OR startup OR Grab OR Temasek'),
        urgent: tq('Singapore breaking news OR MAS OR cyber OR alert')
    },
    PH: {
        tech:   tq('Philippines technology OR fintech OR BPO OR startup OR Mynt'),
        urgent: tq('Philippines breaking news OR typhoon OR West Philippine Sea')
    },
    MM: {
        tech:   tq('Myanmar technology OR digital OR mobile OR internet'),
        urgent: tq('Myanmar breaking news OR junta OR conflict OR Rohingya')
    },
    KH: {
        tech:   tq('Cambodia technology OR digital economy OR startup'),
        urgent: tq('Cambodia breaking news OR Hun Manet OR election')
    },
    LA: {
        tech:   tq('Laos technology OR digital OR Belt and Road OR rail'),
        urgent: tq('Laos breaking news OR dam OR Mekong')
    },
    BN: {
        tech:   tq('Brunei technology OR digital OR oil OR LNG'),
        urgent: tq('Brunei breaking news OR Sultan')
    }
};

// Thai province / sector queries (Thailand-mode bottom bar)
export const THAI_NEWS_QUERIES = {
    BKK: { tech: tq('Bangkok technology OR fintech OR True OR AIS'),         urgent: tq('Bangkok breaking news OR flood OR PM2.5 OR protest') },
    CNX: { tech: tq('Chiang Mai technology OR digital nomad OR startup'),    urgent: tq('Chiang Mai PM2.5 OR haze OR flood OR breaking') },
    KKC: { tech: tq('Khon Kaen smart city OR rail OR university'),           urgent: tq('Khon Kaen breaking OR flood OR Isaan') },
    PHK: { tech: tq('Phuket sandbox OR digital nomad OR tourism tech'),      urgent: tq('Phuket breaking news OR tsunami OR tourist') },
    HDY: { tech: tq('Hat Yai Songkhla technology OR cross-border'),          urgent: tq('Hat Yai breaking OR flood OR Deep South unrest') },
    EEC: { tech: tq('EEC Eastern Economic Corridor OR EV OR semiconductor'), urgent: tq('EEC Chonburi Rayong incident OR factory') },
    KOR: { tech: tq('Nakhon Ratchasima Korat tech OR rail OR EV'),           urgent: tq('Korat breaking news OR drought') },
    UDN: { tech: tq('Udon Thani tech OR rail OR Laos border trade'),         urgent: tq('Udon Thani breaking OR flood') }
};

// ---------------------------------------------------------------------------
// Live TV channels per region. Channel-based YouTube embeds (live_stream)
// are used where possible because their IDs are stable; rotating live video
// IDs change weekly. Mute-first for autoplay compliance.
// ---------------------------------------------------------------------------

const ytChannel = (channelId) =>
    `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1&controls=0&modestbranding=1`;
const ytChannelUnmuted = (channelId) =>
    `https://www.youtube.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=0&controls=0&modestbranding=1`;
const ytVideo = (videoId) =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&enablejsapi=1&controls=0&modestbranding=1`;
const ytVideoUnmuted = (videoId) =>
    `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&enablejsapi=1&controls=0&modestbranding=1`;

// Middle East TV — extracted from the original LiveTVPanel.
export const TV_CHANNELS_MIDDLEEAST = [
    { id: 'aljazeera-en',     name: 'Al Jazeera',    lang: 'EN', color: '#D4A843', embedUrl: ytVideo('gCNeDWCI0vo'),                              embedUrlUnmuted: ytVideoUnmuted('gCNeDWCI0vo') },
    { id: 'aljazeera-ar',     name: 'الجزيرة',         lang: 'AR', color: '#D4A843', embedUrl: ytVideo('bNyUyrR0PHo'),                              embedUrlUnmuted: ytVideoUnmuted('bNyUyrR0PHo') },
    { id: 'france24-en',      name: 'France 24',     lang: 'EN', color: '#0055A4', embedUrl: ytChannel('UCQfwfsi5VrQ8yKZ-UWmAEFg'),               embedUrlUnmuted: ytChannelUnmuted('UCQfwfsi5VrQ8yKZ-UWmAEFg') },
    { id: 'sky-news-arabia',  name: 'Sky News',      lang: 'عربية', color: '#C41230', embedUrl: ytVideo('U--OjmpjF5o'),                          embedUrlUnmuted: ytVideoUnmuted('U--OjmpjF5o') },
    { id: 'earthlive-me',     name: 'ME Cams',       lang: 'LIVE', color: '#22c55e', embedUrl: ytVideo('gmtlJ_m2r5A'),                            embedUrlUnmuted: ytVideoUnmuted('gmtlJ_m2r5A') },
    { id: 'earthlive-cctv',   name: 'City CCTV',     lang: 'LIVE', color: '#22c55e', embedUrl: ytVideo('2Sl8n9clE8E'),                            embedUrlUnmuted: ytVideoUnmuted('2Sl8n9clE8E') },
    { id: 'i24-news',         name: 'i24 News',      lang: 'EN', color: '#0088CC', embedUrl: ytChannel('UCp1VEgMfOGBIIwlMDBJwFgA'),               embedUrlUnmuted: ytChannelUnmuted('UCp1VEgMfOGBIIwlMDBJwFgA') },
    { id: 'trt-world',        name: 'TRT World',     lang: 'EN', color: '#E30A17', embedUrl: ytChannel('UC7fWeaHhqgM4Lba5uttl0SA'),               embedUrlUnmuted: ytChannelUnmuted('UC7fWeaHhqgM4Lba5uttl0SA') }
];

// Indo-Pacific TV — Channel News Asia (SG), NHK World (JP), KBS World (KR),
// ABC News Australia, DW (Asia coverage), WION (India/Asia), Bloomberg TV.
export const TV_CHANNELS_INDOPACIFIC = [
    { id: 'cna',          name: 'CNA',            lang: 'EN', color: '#E60023', embedUrl: ytChannel('UCXi6CllNFjlb-kiuHNuKPOA'), embedUrlUnmuted: ytChannelUnmuted('UCXi6CllNFjlb-kiuHNuKPOA') },
    { id: 'nhk-world',    name: 'NHK World',      lang: 'EN', color: '#FF0000', embedUrl: ytChannel('UCSPEjw8F2nQDtmUKPFNF7_A'), embedUrlUnmuted: ytChannelUnmuted('UCSPEjw8F2nQDtmUKPFNF7_A') },
    { id: 'kbs-world',    name: 'KBS World',      lang: 'EN', color: '#0046A6', embedUrl: ytChannel('UC5BMQOsAB8hKUyHu9KI6yig'), embedUrlUnmuted: ytChannelUnmuted('UC5BMQOsAB8hKUyHu9KI6yig') },
    { id: 'abc-au',       name: 'ABC News AU',    lang: 'EN', color: '#FFCC00', embedUrl: ytChannel('UCVgO39Bk5sMo66-6o6Spn6Q'), embedUrlUnmuted: ytChannelUnmuted('UCVgO39Bk5sMo66-6o6Spn6Q') },
    { id: 'dw-news',      name: 'DW News',        lang: 'EN', color: '#0033A0', embedUrl: ytChannel('UCknLrEdhRCp1aegoMqRaCZg'), embedUrlUnmuted: ytChannelUnmuted('UCknLrEdhRCp1aegoMqRaCZg') },
    { id: 'wion',         name: 'WION',           lang: 'EN', color: '#E94B3C', embedUrl: ytChannel('UC_gUM8rL-Lrg6O3adPW9K1g'), embedUrlUnmuted: ytChannelUnmuted('UC_gUM8rL-Lrg6O3adPW9K1g') },
    { id: 'bloomberg-tv', name: 'Bloomberg',      lang: 'EN', color: '#000000', embedUrl: ytChannel('UCIALMKvObZNtJ6AmdCLP7Lg'), embedUrlUnmuted: ytChannelUnmuted('UCIALMKvObZNtJ6AmdCLP7Lg') },
    { id: 'bangkok-cam',  name: 'Bangkok Live',   lang: 'LIVE', color: '#22c55e', embedUrl: ytVideo('h1wly909BYw'),                embedUrlUnmuted: ytVideoUnmuted('h1wly909BYw') }
];

// Thailand-only TV — Thai PBS World + regional channels + Thai-language anchors.
export const TV_CHANNELS_THAILAND = [
    { id: 'thai-pbs-world', name: 'Thai PBS World', lang: 'EN', color: '#D4A843', embedUrl: ytChannel('UCb6lpMAyRvWtltkChxIjwUg'), embedUrlUnmuted: ytChannelUnmuted('UCb6lpMAyRvWtltkChxIjwUg') },
    { id: 'thai-pbs',       name: 'Thai PBS',       lang: 'TH', color: '#D4A843', embedUrl: ytChannel('UC6QH1HXGl6chl0kZP1KEcUg'), embedUrlUnmuted: ytChannelUnmuted('UC6QH1HXGl6chl0kZP1KEcUg') },
    { id: 'tnn-thailand',   name: 'TNN',            lang: 'TH', color: '#0088CC', embedUrl: ytChannel('UCRijo3ddMTht_IHyNSNXpNQ'), embedUrlUnmuted: ytChannelUnmuted('UCRijo3ddMTht_IHyNSNXpNQ') },
    { id: 'nation-tv',      name: 'Nation TV',      lang: 'TH', color: '#E60023', embedUrl: ytChannel('UC8i4HhYJ-IVSNaNfIM8XaUw'), embedUrlUnmuted: ytChannelUnmuted('UC8i4HhYJ-IVSNaNfIM8XaUw') },
    { id: 'matichon',       name: 'Matichon TV',    lang: 'TH', color: '#22c55e', embedUrl: ytChannel('UCUKAZ2VDFsmKqV9EmESsdgw'), embedUrlUnmuted: ytChannelUnmuted('UCUKAZ2VDFsmKqV9EmESsdgw') },
    { id: 'cna',            name: 'CNA',            lang: 'EN', color: '#E60023', embedUrl: ytChannel('UCXi6CllNFjlb-kiuHNuKPOA'), embedUrlUnmuted: ytChannelUnmuted('UCXi6CllNFjlb-kiuHNuKPOA') },
    { id: 'bangkok-cam',    name: 'Bangkok Live',   lang: 'LIVE', color: '#22c55e', embedUrl: ytVideo('h1wly909BYw'),                embedUrlUnmuted: ytVideoUnmuted('h1wly909BYw') },
    { id: 'phuket-cam',     name: 'Phuket Cam',     lang: 'LIVE', color: '#22c55e', embedUrl: ytVideo('CL45U17CjIM'),                embedUrlUnmuted: ytVideoUnmuted('CL45U17CjIM') }
];

// ---------------------------------------------------------------------------
// Single getter for any region — the consumer side of the registry.
// ---------------------------------------------------------------------------

export const REGIONS = {
    middleeast: {
        id: 'middleeast',
        label: 'Middle East',
        viewState: REGION_VIEW_STATES.middleeast,
        dots: null,
        channels: TV_CHANNELS_MIDDLEEAST
    },
    indopacific: {
        id: 'indopacific',
        label: 'Indo-Pacific',
        viewState: REGION_VIEW_STATES.indopacific,
        dots: ASEAN_DOTS_GEOJSON,
        channels: TV_CHANNELS_INDOPACIFIC
    },
    thailand: {
        id: 'thailand',
        label: 'Thailand',
        viewState: REGION_VIEW_STATES.thailand,
        dots: THAILAND_DOTS_GEOJSON,
        channels: TV_CHANNELS_THAILAND
    },
    global: {
        id: 'global',
        label: 'Global',
        viewState: REGION_VIEW_STATES.global,
        dots: null,
        channels: TV_CHANNELS_MIDDLEEAST
    }
};

export const getRegion = (id) => REGIONS[id] || REGIONS.middleeast;
