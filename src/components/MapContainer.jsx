import React, { useCallback, useState, useRef, useEffect, useMemo, useReducer } from 'react';
import Map, { Marker, Source, Layer, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { AlertTriangle } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchNaturalDisasters } from '../services/nasaEonet';
import { fetchConflictsAndCrises } from '../services/reliefWeb';
import { fetchLiveWeather } from '../services/weather';
import { fetchMacroEconomy } from '../services/worldBank';
import { fetchAirQuality } from '../services/airQuality';
import { fetchFirmsData } from '../services/firms';
import { fetchInfrastructure } from '../services/infrastructure';
import { fetchFlights } from '../services/flights.js';
import { fetchVessels } from '../services/vessels.js';
import { fetchRainviewerTiles } from '../services/rainviewer.js';
import { fetchAcledEvents } from '../services/acled.js';
import { fetchFloodOps } from '../services/flood.js';
import { useLiveResource } from '../hooks/useLiveResource';
import { EO_TILE_LAYERS, getEoLayerById } from '../services/eoTiles';
import { getRegion } from '../data/regions.js';
import { setFlightCount } from '../services/flightCountBus.js';
import { setVesselCount } from '../services/vesselCountBus.js';
import { useTrafficAnimator, EMPTY_TRAFFIC } from '../hooks/useInterpolatedTraffic.js';
import { loadTrafficIcons, FLIGHT_ICON_IMAGE, VESSEL_ICON_IMAGE } from '../services/mapTrafficIcons.js';

// ponytail: no route/origin-destination API exists (airplanes.live gives position + track + speed
// only), so a "flight path" is a short heading projection — not a route spiderweb.
const EARTH_RADIUS_M = 6371000;
const PATH_LOOKAHEAD_S = 180; // 3 min look-ahead
const MAX_PATH_DISTANCE_M = 25000; // cap at 25 km regardless of speed
const MIN_PATH_VELOCITY_MS = 40; // skip slow / taxiing traffic
const MIN_PATH_ALTITUDE_M = 500;

const projectForward = (lon, lat, headingDeg, distanceM) => {
    const delta = distanceM / EARTH_RADIUS_M;
    const theta = (headingDeg * Math.PI) / 180;
    const phi1 = (lat * Math.PI) / 180;
    const lambda1 = (lon * Math.PI) / 180;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
    const lambda2 = lambda1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );
    return [(lambda2 * 180) / Math.PI, (phi2 * 180) / Math.PI];
};

// A feature the traffic layers can actually draw. Data can arrive from a live
// poll, the server's stale cache, or a browser-side last-good snapshot written
// by an OLDER build — never assume geometry is present or well-formed, because
// one bad feature here throws during render and takes the whole map down.
const isRenderablePoint = (f) => (
    f?.geometry?.type === 'Point'
    && Array.isArray(f.geometry.coordinates)
    && Number.isFinite(f.geometry.coordinates[0])
    && Number.isFinite(f.geometry.coordinates[1])
);

const buildFlightPaths = (flights) => {
    if (!flights?.features?.length) return null;
    const features = flights.features
        .filter((f) => {
            if (!isRenderablePoint(f)) return false;
            const p = f.properties || {};
            return !p.onGround
                && (p.velocity || 0) >= MIN_PATH_VELOCITY_MS
                && (p.altitude || 0) >= MIN_PATH_ALTITUDE_M
                && Number.isFinite(p.heading);
        })
        .map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            const distanceM = Math.min(f.properties.velocity * PATH_LOOKAHEAD_S, MAX_PATH_DISTANCE_M);
            const end = projectForward(lon, lat, f.properties.heading, distanceM);
            return {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [[lon, lat], end] },
                properties: { military: Boolean(f.properties?.military) }
            };
        });
    return { type: 'FeatureCollection', features };
};

// Vessel heading vectors: short look-ahead, low speed threshold, course-first direction.
const VESSEL_LOOKAHEAD_S = 120; // 2 min look-ahead
const MAX_VESSEL_PATH_M = 3000; // cap at 3 km
const MIN_VESSEL_SPEED_KNOTS = 1;
const KNOT_TO_MS = 0.514444;

// Mirrors VESSEL_COLORS in mapTrafficIcons.js — hull icon and its wake vector match.
const VESSEL_CATEGORY_COLOR = {
    cargo: '#1f6e43',
    tanker: '#a23a26',
    passenger: '#191712',
    fishing: '#6f6c63',
    pleasure: '#8f8b80',
    tug: '#8f8b80',
    other: '#a9a59a'
};

const buildVesselPaths = (vessels) => {
    if (!vessels?.features?.length) return null;
    const features = vessels.features
        .filter((f) => {
            if (!isRenderablePoint(f)) return false;
            const p = f.properties || {};
            const speedKnots = p.speed || 0;
            const direction = p.course ?? p.heading;
            return speedKnots >= MIN_VESSEL_SPEED_KNOTS && Number.isFinite(direction);
        })
        .map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            const p = f.properties || {};
            const speedMs = (p.speed || 0) * KNOT_TO_MS;
            const distanceM = Math.min(speedMs * VESSEL_LOOKAHEAD_S, MAX_VESSEL_PATH_M);
            const direction = p.course ?? p.heading;
            const end = projectForward(lon, lat, direction, distanceM);
            return {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [[lon, lat], end] },
                properties: { category: p.category || 'other' }
            };
        });
    return { type: 'FeatureCollection', features };
};

const HOVER_LAYERS = ['flights-icons', 'vessels-icons', 'acled-circles', 'firms-circles'];
const getTooltipClassName = (layerId) => [
    'traffic-tooltip',
    layerId === 'vessels-icons' ? 'traffic-tooltip--vessel'
        : layerId === 'acled-circles' ? 'traffic-tooltip--conflict'
            : layerId === 'firms-circles' ? 'traffic-tooltip--heat'
                : null,
].filter(Boolean).join(' ');

const formatCoord = (value, axis) => {
    const abs = Math.abs(value);
    const dir = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${abs.toFixed(4)}°${dir}`;
};
const MAP_MIN_ZOOM = 3; // §11.9 — regional dashboard floor, prevents world-copy repetition
const MAP_MAX_ZOOM = 18;

const buildTargetViewState = (viewTarget, fallbackTransitionDuration = 1500) => ({
    ...viewTarget,
    transitionDuration: viewTarget.transitionDuration ?? fallbackTransitionDuration,
});

const mapViewReducer = (state, action) => {
    switch (action.type) {
    case 'move':
        return {
            ...action.viewState,
            zoom: Math.min(Math.max(action.viewState.zoom, MAP_MIN_ZOOM), MAP_MAX_ZOOM),
            transitionDuration: 0,
        };
    case 'target':
        return buildTargetViewState(action.viewTarget, state.transitionDuration);
    default:
        return state;
    }
};

const STRATEGIC_ZONES = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[44, 22], [60, 22], [60, 32], [44, 32], [44, 22]]]
            },
            properties: {
                fill: '#a23a26',
                line: '#a23a26'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[94, -6], [109, -6], [109, 18], [94, 18], [94, -6]]]
            },
            properties: {
                fill: '#1f6e43',
                line: '#1f6e43'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[32, 11], [45, 11], [45, 22], [32, 22], [32, 11]]]
            },
            properties: {
                fill: '#8f8b80',
                line: '#8f8b80'
            }
        }
    ]
};

const OPERATIONAL_CORRIDORS = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[51.47, 25.28], [55.36, 25.25], [72.88, 19.07], [100.5, 13.75]]
            },
            properties: {
                color: '#a23a26',
                width: 2.8,
                glow: 12,
                label: 'Energy Trade Route (Gulf → India → Bangkok)'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[40.0, 16.5], [56.0, 18.2], [72.0, 14.6], [90.0, 8.3], [103.82, 1.35]]
            },
            properties: {
                color: '#8f8b80',
                width: 2.4,
                glow: 10,
                label: 'Maritime Shipping Lane (Red Sea → Singapore)'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[121.47, 31.23], [121.56, 25.03], [120.98, 14.6], [103.82, 1.35]]
            },
            properties: {
                color: '#6f6c63',
                width: 2.2,
                glow: 9,
                label: 'East Asia Trade Corridor (Shanghai → Singapore)'
            }
        }
    ]
};

const ANCHOR_POINTS = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [51.47, 25.28] }, properties: { color: '#a23a26', radius: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [55.36, 25.25] }, properties: { color: '#a23a26', radius: 12 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [53.68, 32.42] }, properties: { color: '#a23a26', radius: 11 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties: { color: '#1f6e43', radius: 12 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [103.82, 1.35] }, properties: { color: '#6f6c63', radius: 11 } }
    ]
};

const URBAN_MEGAREGIONS = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[99.7, 13.15], [101.45, 13.15], [101.45, 14.55], [99.7, 14.55], [99.7, 13.15]]]
            },
            properties: {
                color: '#1f6e43',
                height: 120000,
                base: 0
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[103.45, 1.05], [104.15, 1.05], [104.15, 1.62], [103.45, 1.62], [103.45, 1.05]]]
            },
            properties: {
                color: '#6f6c63',
                height: 140000,
                base: 0
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[54.45, 24.35], [55.85, 24.35], [55.85, 25.65], [54.45, 25.65], [54.45, 24.35]]]
            },
            properties: {
                color: '#a23a26',
                height: 135000,
                base: 0
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[120.55, 24.65], [122.25, 24.65], [122.25, 25.4], [120.55, 25.4], [120.55, 24.65]]]
            },
            properties: {
                color: '#8f8b80',
                height: 105000,
                base: 0
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[106.2, -6.7], [107.25, -6.7], [107.25, -5.8], [106.2, -5.8], [106.2, -6.7]]]
            },
            properties: {
                color: '#8f8b80',
                height: 110000,
                base: 0
            }
        }
    ]
};

const CITY_NETWORK = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[54.9, 24.8], [72.88, 19.07], [100.5, 13.75], [103.82, 1.35]]
            },
            properties: {
                color: '#6f6c63'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[100.5, 13.75], [106.82, -6.18], [103.82, 1.35], [121.56, 25.03]]
            },
            properties: {
                color: '#1f6e43'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[103.82, 1.35], [114.17, 22.32], [121.56, 25.03], [139.76, 35.68]]
            },
            properties: {
                color: '#8f8b80'
            }
        }
    ]
};

const CITY_BEACONS = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [100.5, 13.75] },
            properties: { name: 'Bangkok', tier: 'policy engine', color: '#1f6e43', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [103.82, 1.35] },
            properties: { name: 'Singapore', tier: 'logistics core', color: '#6f6c63', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [55.27, 25.2] },
            properties: { name: 'Dubai', tier: 'airspace hinge', color: '#a23a26', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [121.56, 25.03] },
            properties: { name: 'Taipei', tier: 'tech nexus', color: '#8f8b80', radius: 7 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [106.82, -6.18] },
            properties: { name: 'Jakarta', tier: 'metro scale', color: '#8f8b80', radius: 7 }
        }
    ]
};

const hasFeatureData = (collection) => Array.isArray(collection?.features) && collection.features.length > 0;
const getPublicSentinelLayerId = (mode) => (mode === 'ndvi' ? 'eo-vegetation' : 'eo-true-color');
const toImageCoordinates = (bbox) => {
    const [west, south, east, north] = bbox;
    return [
        [west, north],
        [east, north],
        [east, south],
        [west, south]
    ];
};
const toFootprintFeature = (preview) => {
    const bbox = preview?.bounds?.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;

    const [west, south, east, north] = bbox;
    return {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [west, south],
                        [east, south],
                        [east, north],
                        [west, north],
                        [west, south]
                    ]]
                },
                properties: {
                    label: `${preview.theaterLabel} ${preview.presetLabel}`
                }
            }
        ]
    };
};

const renderSpatialAura = (data, id, color, baseRadius) => {
    if (!data?.features?.length) return null;

    return (
        <Source id={`${id}-aura-source`} type="geojson" data={data}>
            <Layer
                id={`${id}-aura-layer`}
                type="circle"
                paint={{
                    'circle-color': color,
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, baseRadius, 8, baseRadius * 2.4],
                    'circle-opacity': 0.08,
                    'circle-blur': 0.75,
                    'circle-stroke-color': color,
                    'circle-stroke-width': 1,
                    'circle-stroke-opacity': 0.14
                }}
            />
        </Source>
    );
};

// Inline MapLibre style spec for ESRI World Imagery — no API key required.
// Used as the satellite basemap because the MapTiler "hybrid" placeholder key that
// previously lived here was the literal docs example and rendered blank in production.
const ESRI_SATELLITE_STYLE = {
    version: 8,
    sources: {
        'esri-world-imagery': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN'
        },
        'esri-reference': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19
        }
    },
    layers: [
        { id: 'esri-world-imagery-layer', type: 'raster', source: 'esri-world-imagery' },
        { id: 'esri-reference-layer', type: 'raster', source: 'esri-reference', paint: { 'raster-opacity': 0.85 } }
    ],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
};

// Each entry can be a URL string or an inline style object — MapLibre accepts both.
// Fallback chain (per style): if the primary URL fails (CORS / 5xx / DNS), the
// onStyleError handler in <Map> will swap to the fallback so the map never goes blank.
const MAP_STYLES = {
    // Rams: a minimal, low-chroma paper map. Positron is the light instrument basemap.
    light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    satellite: ESRI_SATELLITE_STYLE,
    voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

const MAP_STYLE_FALLBACKS = {
    dark: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    voyager: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
};

const MapContainer = ({
    viewTarget,
    activeLayers,
    onMarkerClick,
    copernicusPreview,
    copernicusMode,
    copernicusRuntimeSource,
    showCopernicusOverlay,
    showStrategicContext,
    viewMode = 'middleeast',
    onRegionDotClick,
    mapStyle = 'dark',
}) => {
    const region = getRegion(viewMode);
    const regionDots = region.dots;
    const [viewState, dispatchViewState] = useReducer(
        mapViewReducer,
        viewTarget,
        (initialViewTarget) => buildTargetViewState(initialViewTarget)
    );
    const mapRef = useRef(null);
    // Track which raster sources have failed (auth / 404 / CORS / 5xx) so the
    // user sees what is missing instead of a silently-empty map.
    const [failedSources, setFailedSources] = useState(() => new Set());

    const [mapIconsReady, setMapIconsReady] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [rainviewerTiles, setRainviewerTiles] = useState(null);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [cursorCoords, setCursorCoords] = useState(null);

    const handleMove = useCallback((event) => {
        dispatchViewState({ type: 'move', viewState: event.viewState });
    }, []);

    const flightsLayerActive = activeLayers.includes('flights');
    const vesselsLayerActive = activeLayers.includes('vessels');
    const weatherLayerActive = activeLayers.includes('weather');

    useEffect(() => {
        dispatchViewState({ type: 'target', viewTarget });
    }, [viewTarget]);

    useEffect(() => {
        if (!weatherLayerActive) return undefined;
        let cancelled = false;
        fetchRainviewerTiles()
            .then((payload) => {
                if (!cancelled && payload?.tiles?.length) setRainviewerTiles(payload);
            })
            .catch(() => { /* radar overlay optional */ });
        return () => { cancelled = true; };
    }, [weatherLayerActive]);

    // Wire MapLibre's runtime error events. react-map-gl's <Map onError> only
    // surfaces some errors; the underlying map.on('error') is the canonical hook
    // that fires for tile load failures, source errors, and style errors.
    useEffect(() => {
        const map = mapRef.current?.getMap?.();
        if (!map) return undefined;
        const handler = (e) => {
            const sourceId = e?.sourceId || e?.source?.id || e?.error?.sourceId;
            if (sourceId) {
                setFailedSources((prev) => {
                    if (prev.has(sourceId)) return prev;
                    const next = new Set(prev);
                    next.add(sourceId);
                    return next;
                });
            }
        };
        map.on('error', handler);
        return () => { map.off('error', handler); };
    }, [mapStyle]);

    // Load custom SVG icons into the MapLibre sprite; re-run on style change
    // because setStyle() wipes all user-added images.
    const loadMapIcons = useCallback(() => {
        const map = mapRef.current?.getMap?.();
        if (!map) return;
        loadTrafficIcons(map, () => setMapIconsReady(true));
    }, []);

    const handleMapLoad = useCallback(() => {
        setMapReady(true);
        loadMapIcons();
    }, [loadMapIcons]);

    useEffect(() => {
        if (!mapReady) return undefined;
        const map = mapRef.current?.getMap?.();
        if (!map) return undefined;

        loadMapIcons();
        map.on('style.load', loadMapIcons);
        return () => { map.off('style.load', loadMapIcons); };
    }, [mapReady, mapStyle, loadMapIcons]);

    const handleMouseMove = useCallback((event) => {
        setCursorCoords({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        const feature = event.features?.find(
            (f) => f.layer?.id === 'flights-icons' || f.layer?.id === 'vessels-icons'
                || f.layer?.id === 'flood-stations-alert' || f.layer?.id === 'flood-stations-all'
        );
        if (feature) {
            const [longitude, latitude] = feature.geometry?.coordinates || [];
            setHoverInfo({ longitude, latitude, feature });
        } else {
            setHoverInfo(null);
        }
    }, []);
    const handleMouseLeave = useCallback(() => {
        setHoverInfo(null);
        setCursorCoords(null);
    }, []);

    const disasterResource = useLiveResource(useCallback(() => fetchNaturalDisasters(), []), {
        cacheKey: 'map:disasters',
        enabled: activeLayers.includes('disasters'),
        intervalMs: 120 * 1000,
        isUsable: hasFeatureData
    });
    const conflictResource = useLiveResource(useCallback(() => fetchConflictsAndCrises(), []), {
        cacheKey: 'map:conflicts',
        enabled: activeLayers.includes('conflicts'),
        intervalMs: 120 * 1000,
        isUsable: hasFeatureData
    });
    const weatherResource = useLiveResource(useCallback(() => fetchLiveWeather(), []), {
        cacheKey: 'map:weather',
        enabled: activeLayers.includes('weather'),
        intervalMs: 120 * 1000,
        isUsable: hasFeatureData
    });
    const economyResource = useLiveResource(useCallback(() => fetchMacroEconomy(), []), {
        cacheKey: 'map:economy',
        enabled: activeLayers.includes('economy'),
        intervalMs: 120 * 1000,
        isUsable: hasFeatureData
    });
    const aqiResource = useLiveResource(useCallback(() => fetchAirQuality(), []), {
        cacheKey: 'map:aqi',
        enabled: activeLayers.includes('aqi'),
        intervalMs: 120 * 1000,
        isUsable: hasFeatureData
    });
    const firmsResource = useLiveResource(useCallback(() => fetchFirmsData(viewMode), [viewMode]), {
        cacheKey: `map:firms:${viewMode}`,
        enabled: activeLayers.includes('firms'),
        intervalMs: 10 * 60 * 1000,
        isUsable: hasFeatureData
    });
    const infraResource = useLiveResource(useCallback(() => fetchInfrastructure(), []), {
        cacheKey: 'map:infrastructure',
        enabled: activeLayers.includes('infrastructure'),
        intervalMs: 10 * 60 * 1000,
        isUsable: hasFeatureData
    });
    const flightsResource = useLiveResource(useCallback(() => fetchFlights(viewMode), [viewMode]), {
        cacheKey: `map:flights:${viewMode}`,
        enabled: activeLayers.includes('flights'),
        intervalMs: 30 * 1000,
        isUsable: (payload) => payload?.type === 'FeatureCollection',
        maxRetries: 0
    });
    const acledResource = useLiveResource(useCallback(() => fetchAcledEvents(viewMode), [viewMode]), {
        cacheKey: `map:acled:${viewMode}`,
        enabled: activeLayers.includes('conflicts'),
        intervalMs: 60 * 60 * 1000,
        isUsable: hasFeatureData
    });
    const vesselsResource = useLiveResource(useCallback(() => fetchVessels(viewMode), [viewMode]), {
        cacheKey: `map:vessels:${viewMode}`,
        enabled: activeLayers.includes('vessels'),
        intervalMs: 30 * 1000,
        isUsable: (payload) => payload?.type === 'FeatureCollection',
        maxRetries: 0
    });
    // HII flood telemetry — Thailand theater only. One payload carries all
    // ~775 national gauges + the Chao Phraya cascade flow corridors.
    const floodResource = useLiveResource(useCallback(() => fetchFloodOps('ayutthaya'), []), {
        cacheKey: 'map:flood',
        enabled: viewMode === 'thailand',
        intervalMs: 10 * 60 * 1000,
        isUsable: (payload) => Boolean(payload?.geo?.stations?.features?.length)
    });

    const disastersData = disasterResource.data;
    const crisesData = conflictResource.data;
    const weatherData = weatherResource.data;
    const economyData = economyResource.data;
    const aqiData = aqiResource.data;
    const firmsData = firmsResource.data;
    const infraData = infraResource.data;
    const flightsData = flightsResource.data;
    const vesselsData = vesselsResource.data;
    // Marching-ants dash cycle on the flood corridors: the dashes crawl
    // downstream, making the direction of water legible at a glance. One
    // uniform paint write per tick — no geometry upload, negligible cost.
    useEffect(() => {
        if (viewMode !== 'thailand' || !floodResource.data?.geo) return undefined;
        const sequence = [
            [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
            [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
        ];
        let step = 0;
        const timer = setInterval(() => {
            const map = mapRef.current?.getMap?.();
            if (!map || !map.getLayer('flood-corridors-flow')) return;
            step = (step + 1) % sequence.length;
            try {
                map.setPaintProperty('flood-corridors-flow', 'line-dasharray', sequence[step]);
            } catch { /* style mid-swap */ }
        }, 160);
        return () => clearInterval(timer);
    }, [viewMode, floodResource.data]);

    // Imperative animators write straight into the MapLibre sources — React never
    // re-renders on the animation path (the old setState tween froze the page).
    useTrafficAnimator(mapRef, 'flights-data', flightsData, { idKey: 'hex', durationMs: 30_000, frameMs: 900, enabled: flightsLayerActive });
    useTrafficAnimator(mapRef, 'vessels-data', vesselsData, { idKey: 'mmsi', durationMs: 30_000, frameMs: 1300, enabled: vesselsLayerActive });
    // Heading look-ahead trails update on the 30s poll, not per animation frame.
    const flightPaths = useMemo(() => buildFlightPaths(flightsData), [flightsData]);
    const vesselPaths = useMemo(() => buildVesselPaths(vesselsData), [vesselsData]);
    const flightCount = flightsData?.features?.length ?? 0;
    const vesselCount = vesselsData?.features?.length ?? 0;
    const flightSourceLabel = flightsResource.isStale || flightsData?.__meta?.status === 'stale'
        ? 'ADS-B stale'
        : 'ADS-B';
    const vesselsNeedKey = vesselsData?.meta?.requiresKey;
    const vesselSourceLabel = vesselsData?.meta?.staticSnapshot
        ? 'AIS snapshot'
        : (vesselsData?.meta?.source?.replace('ais-snapshot', 'AIS snapshot')?.replace('aisstream.io', 'AIS')?.replace('vesselfinder-fleet', 'fleet') || 'AIS');
    // FIRMS and ACLED sit on the same map as traffic with no provenance line of
    // their own. Same format as the traffic rows: count · source · age.
    // A clock that ticks in an effect, so age labels are pure during render.
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);
    const ageLabel = (iso) => {
        if (!iso) return null;
        const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
        if (!Number.isFinite(mins) || mins < 0) return null;
        if (mins < 2) return 'just now';
        if (mins < 60) return mins + 'm old';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h old';
        return Math.floor(hrs / 24) + 'd old';
    };
    const firmsMeta = firmsData?.meta;
    const firmsLive = firmsMeta?.source === 'nasa-firms-live';
    const firmsCount = firmsData?.features?.length ?? 0;
    const firmsCoverage = firmsMeta?.coverage === 'partial'
        ? ' · partial ' + firmsMeta.requestsAnswered + '/' + firmsMeta.requestsAttempted + ' regions'
        : '';
    const firmsSourceLabel = firmsLive
        ? firmsCount + ' thermal · VIIRS · ' + (ageLabel(firmsMeta?.fetchedAt) || 'age unknown') + firmsCoverage
        : firmsMeta?.source === 'no_firms_key' ? 'Thermal: no FIRMS key — nothing shown'
            : firmsResource.isLoading ? 'Loading thermal…'
                : firmsMeta?.source ? 'Thermal: ' + String(firmsMeta.source).replace(/_/g, ' ') : 'Thermal: no data';
    const acledRaw = acledResource.data;
    const acledLive = acledRaw?.source === 'acled';
    const acledCount = acledRaw?.features?.length ?? 0;
    const acledSourceLabel = acledLive
        ? acledCount + (acledRaw?.truncated ? '+' : '') + ' events · ACLED · since ' + (acledRaw?.since || '—')
        : acledCount > 0 ? acledCount + ' events · DEMO — not ACLED'
            : acledResource.isLoading ? 'Loading events…' : 'Events: no data';
    const legendVisible = flightsLayerActive || vesselsLayerActive
        || activeLayers.includes('firms') || activeLayers.includes('conflicts');

    useEffect(() => {
        setFlightCount(flightCount);
    }, [flightCount]);

    useEffect(() => {
        setVesselCount(vesselCount);
    }, [vesselCount]);

    const acledData = acledResource.data;
    const publicSentinelLayerId = getPublicSentinelLayerId(copernicusMode);
    const publicSentinelLayer = getEoLayerById(publicSentinelLayerId);
    const publicOverlayVisible = Boolean(
        showCopernicusOverlay
        && copernicusRuntimeSource === 'public'
        && publicSentinelLayer
    );
    const copernicusOverlayVisible = Boolean(
        showCopernicusOverlay
        && copernicusRuntimeSource === 'copernicus'
        && copernicusPreview?.available
        && copernicusPreview?.imageDataUrl
        && Array.isArray(copernicusPreview?.bounds?.bbox)
    );
    const copernicusFootprint = copernicusOverlayVisible ? toFootprintFeature(copernicusPreview) : null;

    const renderMarkers = (data, catClass) => {
        if (!data?.features) return null;

        return data.features.map((feature, index) => {
            const [lng, lat] = feature.geometry.coordinates;
            const key = feature.properties.id || `${catClass}-${index}`;
            const markerColor = feature.properties.color || '';

            return (
                <Marker
                    key={key}
                    longitude={lng}
                    latitude={lat}
                    anchor="center"
                    onClick={(event) => {
                        event.originalEvent.stopPropagation();
                        onMarkerClick(feature);
                    }}
                >
                    <div
                        className={`pulse-marker ${catClass}`}
                        style={markerColor ? { '--marker-color': markerColor } : {}}
                    />
                </Marker>
            );
        });
    };

    return (
        <div className="map-wrapper">
            <Map
                ref={mapRef}
                mapLib={maplibregl}
                minZoom={MAP_MIN_ZOOM}
                maxZoom={MAP_MAX_ZOOM}
                renderWorldCopies={false}
                maxPitch={60}
                pitchWithRotate
                dragRotate
                touchZoomRotate
                {...viewState}
                onMove={handleMove}
                onLoad={handleMapLoad}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                interactiveLayerIds={['flights-icons', 'vessels-icons', 'flood-stations-alert', 'flood-stations-all']}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLES[mapStyle] || MAP_STYLES.dark}
            >
                {showStrategicContext && (
                    <>
                        <Source id="strategic-zones" type="geojson" data={STRATEGIC_ZONES}>
                            <Layer
                                id="strategic-zones-fill"
                                type="fill"
                                paint={{
                                    'fill-color': ['get', 'fill'],
                                    'fill-opacity': 0.08
                                }}
                            />
                            <Layer
                                id="strategic-zones-line"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'line'],
                                    'line-width': 1.4,
                                    'line-opacity': 0.42,
                                    'line-dasharray': [2, 2]
                                }}
                            />
                        </Source>

                        <Source id="operational-corridors" type="geojson" data={OPERATIONAL_CORRIDORS}>
                            <Layer
                                id="operational-corridors-glow"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'color'],
                                    'line-width': ['get', 'glow'],
                                    'line-opacity': 0.08,
                                    'line-blur': 1.3
                                }}
                            />
                            <Layer
                                id="operational-corridors-core"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'color'],
                                    'line-width': ['get', 'width'],
                                    'line-opacity': 0.55
                                }}
                            />
                        </Source>

                        <Source id="anchor-points" type="geojson" data={ANCHOR_POINTS}>
                            <Layer
                                id="anchor-points-glow"
                                type="circle"
                                paint={{
                                    'circle-color': ['get', 'color'],
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['get', 'radius'], 8, ['*', ['get', 'radius'], 1.8]],
                                    'circle-opacity': 0.07,
                                    'circle-blur': 0.7
                                }}
                            />
                            <Layer
                                id="anchor-points-core"
                                type="circle"
                                paint={{
                                    'circle-color': ['get', 'color'],
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2, 8, 4],
                                    'circle-opacity': 0.45
                                }}
                            />
                        </Source>

                        <Source id="urban-megaregions" type="geojson" data={URBAN_MEGAREGIONS}>
                            <Layer
                                id="urban-megaregions-extrusion"
                                type="fill-extrusion"
                                paint={{
                                    'fill-extrusion-color': ['get', 'color'],
                                    'fill-extrusion-height': ['get', 'height'],
                                    'fill-extrusion-base': ['get', 'base'],
                                    'fill-extrusion-opacity': 0.18
                                }}
                            />
                            <Layer
                                id="urban-megaregions-outline"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'color'],
                                    'line-width': 1.2,
                                    'line-opacity': 0.35
                                }}
                            />
                        </Source>

                        <Source id="city-network" type="geojson" data={CITY_NETWORK}>
                            <Layer
                                id="city-network-glow"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'color'],
                                    'line-width': 6,
                                    'line-opacity': 0.06
                                }}
                            />
                            <Layer
                                id="city-network-core"
                                type="line"
                                paint={{
                                    'line-color': ['get', 'color'],
                                    'line-width': 1.3,
                                    'line-opacity': 0.32,
                                    'line-dasharray': [1, 1.6]
                                }}
                            />
                        </Source>

                        <Source id="city-beacons" type="geojson" data={CITY_BEACONS}>
                            <Layer
                                id="city-beacons-glow"
                                type="circle"
                                paint={{
                                    'circle-color': ['get', 'color'],
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 10, 8, 16],
                                    'circle-opacity': 0.08,
                                    'circle-blur': 0.8
                                }}
                            />
                            <Layer
                                id="city-beacons-core"
                                type="circle"
                                paint={{
                                    'circle-color': ['get', 'color'],
                                    'circle-radius': ['get', 'radius'],
                                    'circle-opacity': 0.2,
                                    'circle-stroke-color': ['get', 'color'],
                                    'circle-stroke-width': 1.2,
                                    'circle-stroke-opacity': 0.45
                                }}
                            />
                            <Layer
                                id="city-beacons-label"
                                type="symbol"
                                layout={{
                                    'text-field': ['get', 'name'],
                                    'text-size': 11,
                                    'text-font': ['Open Sans Bold'],
                                    'text-offset': [0, 1.25],
                                    'text-anchor': 'top'
                                }}
                                paint={{
                                    'text-color': '#dbeafe',
                                    'text-halo-color': 'rgba(5, 14, 32, 0.9)',
                                    'text-halo-width': 1
                                }}
                            />
                        </Source>
                    </>
                )}

                {activeLayers.includes('weather') && rainviewerTiles?.tiles?.length > 0 && (
                    <Source
                        id="rainviewer"
                        type="raster"
                        tiles={rainviewerTiles.tiles}
                        tileSize={256}
                        maxzoom={rainviewerTiles.maxzoom || 12}
                    >
                        <Layer
                            id="rainviewer-layer"
                            type="raster"
                            maxzoom={rainviewerTiles.maxzoom || 12}
                            paint={{ 'raster-opacity': 0.42 }}
                        />
                    </Source>
                )}

                {publicOverlayVisible && (
                    <Source
                        id="public-sentinel-overlay"
                        type="raster"
                        tiles={publicSentinelLayer.tiles}
                        tileSize={publicSentinelLayer.tileSize || 256}
                        attribution={publicSentinelLayer.attribution}
                        maxzoom={publicSentinelLayer.maxzoom || 8}
                    >
                        <Layer
                            id="public-sentinel-overlay-layer"
                            type="raster"
                            paint={{
                                'raster-opacity': copernicusMode === 'ndvi' ? 0.48 : 0.36,
                                'raster-fade-duration': 500
                            }}
                        />
                    </Source>
                )}

                {/* Earth Observation Satellite Tile Layers */}
                {EO_TILE_LAYERS.map((eoLayer) => {
                    if (!activeLayers.includes(eoLayer.id)) return null;
                    if (publicOverlayVisible && eoLayer.id === publicSentinelLayerId) return null;
                    return (
                        <Source
                            key={eoLayer.id}
                            id={eoLayer.id}
                            type="raster"
                            tiles={eoLayer.tiles}
                            tileSize={eoLayer.tileSize || 256}
                            attribution={eoLayer.attribution}
                            maxzoom={eoLayer.maxzoom || 8}
                        >
                            <Layer
                                id={`${eoLayer.id}-layer`}
                                type="raster"
                                maxzoom={eoLayer.maxzoom || 8}
                                paint={{ 'raster-opacity': eoLayer.opacity || 0.6 }}
                            />
                        </Source>
                    );
                })}

                {copernicusOverlayVisible && (
                    <>
                        <Source
                            id="copernicus-preview-image"
                            type="image"
                            url={copernicusPreview.imageDataUrl}
                            coordinates={toImageCoordinates(copernicusPreview.bounds.bbox)}
                        >
                            <Layer
                                id="copernicus-preview-layer"
                                type="raster"
                                paint={{
                                    'raster-opacity': copernicusPreview.preset === 'ndvi' ? 0.72 : 0.78,
                                    'raster-fade-duration': 500
                                }}
                            />
                        </Source>

                        {copernicusFootprint && (
                            <Source id="copernicus-preview-footprint" type="geojson" data={copernicusFootprint}>
                                <Layer
                                    id="copernicus-preview-footprint-fill"
                                    type="fill"
                                    paint={{
                                        'fill-color': '#1f6e43',
                                        'fill-opacity': 0.06
                                    }}
                                />
                                <Layer
                                    id="copernicus-preview-footprint-line"
                                    type="line"
                                    paint={{
                                        'line-color': '#1f6e43',
                                        'line-width': 1.5,
                                        'line-dasharray': [2, 2],
                                        'line-opacity': 0.7
                                    }}
                                />
                            </Source>
                        )}
                    </>
                )}

                {/* FIRMS Fire/Strike Layer */}
                {activeLayers.includes('firms') && firmsData?.features?.length > 0 && (
                    <Source id="firms-data" type="geojson" data={firmsData}>
                        <Layer
                            id="firms-heatmap"
                            type="heatmap"
                            maxzoom={8}
                            paint={{
                                'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.1, 50, 0.5, 200, 1],
                                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 7, 1],
                                'heatmap-color': [
                                    'interpolate', ['linear'], ['heatmap-density'],
                                    0, 'rgba(0,0,0,0)',
                                    0.2, 'rgba(255,100,50,0.15)',
                                    0.4, 'rgba(255,80,30,0.3)',
                                    0.6, 'rgba(255,50,20,0.5)',
                                    0.8, 'rgba(255,30,10,0.7)',
                                    1, 'rgba(255,255,100,0.9)'
                                ],
                                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 20, 8, 30],
                                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 8, 0]
                            }}
                        />
                        <Layer
                            id="firms-circles"
                            type="circle"
                            minzoom={5}
                            paint={{
                                'circle-color': [
                                    'case',
                                    ['==', ['get', 'confidence'], 'high'], '#ff3b30',
                                    ['==', ['get', 'confidence'], 'h'], '#ff3b30',
                                    '#ff8c42'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 4, 12, 8],
                                'circle-opacity': 0.8,
                                'circle-blur': 0.3,
                                'circle-stroke-width': 0.5,
                                'circle-stroke-color': 'rgba(255,255,255,0.2)'
                            }}
                        />
                    </Source>
                )}

                {/* Infrastructure Layer */}
                {activeLayers.includes('infrastructure') && infraData?.features?.length > 0 && (
                    <Source id="infrastructure-data" type="geojson" data={infraData}>
                        <Layer
                            id="infra-circles"
                            type="circle"
                            paint={{
                                'circle-color': [
                                    'match', ['get', 'status'],
                                    'alert', '#a23a26',
                                    'damaged', '#a23a26',
                                    'closed', '#7c2b1c',
                                    'at_risk', '#8f8b80',
                                    'intermittent', '#8f8b80',
                                    'monitoring', '#8f8b80',
                                    '#1f6e43'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 8],
                                'circle-opacity': 0.7,
                                'circle-stroke-width': 1.5,
                                'circle-stroke-color': [
                                    'match', ['get', 'status'],
                                    'alert', '#a23a26',
                                    'damaged', '#a23a26',
                                    'closed', '#7c2b1c',
                                    'at_risk', '#8f8b80',
                                    'intermittent', '#8f8b80',
                                    'monitoring', '#8f8b80',
                                    '#1f6e43'
                                ],
                                'circle-stroke-opacity': 0.3
                            }}
                        />
                        <Layer
                            id="infra-labels"
                            type="symbol"
                            minzoom={6}
                            layout={{
                                'text-field': ['get', 'name'],
                                'text-size': 10,
                                'text-font': ['Open Sans Regular'],
                                'text-offset': [0, 1.2],
                                'text-anchor': 'top'
                            }}
                            paint={{
                                'text-color': '#191712',
                                'text-halo-color': 'rgba(255,255,255,0.85)',
                                'text-halo-width': 1
                            }}
                        />
                    </Source>
                )}

                {/* Flight path vectors — heading look-ahead, drawn under the position dots */}
                {flightsLayerActive && flightPaths?.features?.length > 0 && (
                    <Source id="flight-paths" type="geojson" data={flightPaths}>
                        <Layer
                            id="flight-paths-lines"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={{
                                'line-color': [
                                    'case',
                                    ['==', ['get', 'military'], true], '#a23a26',
                                    '#191712'
                                ],
                                'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.65, 6, 1.1, 10, 1.8],
                                'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.28, 6, 0.42, 10, 0.6]
                            }}
                        />
                    </Source>
                )}

                {/* Flights Layer — density wash at world zoom + plane icons.
                    data stays EMPTY_TRAFFIC (stable ref): the traffic animator owns
                    all setData writes, so React re-renders never touch this source. */}
                {flightsLayerActive && flightsData?.features?.length > 0 && (
                    <Source id="flights-data" type="geojson" data={EMPTY_TRAFFIC} buffer={0}>
                        <Layer
                            id="flights-density"
                            type="heatmap"
                            maxzoom={5}
                            paint={{
                                'heatmap-weight': 1,
                                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 4, 1.0, 5, 1.2],
                                'heatmap-color': [
                                    'interpolate', ['linear'], ['heatmap-density'],
                                    0, 'rgba(0,0,0,0)',
                                    0.2, 'rgba(25,23,18,0.08)',
                                    0.5, 'rgba(25,23,18,0.18)',
                                    0.8, 'rgba(25,23,18,0.28)',
                                    1, 'rgba(25,23,18,0.38)'
                                ],
                                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 10, 4, 18, 5, 22],
                                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 5, 0]
                            }}
                        />
                        <Layer
                            id="flights-glow"
                            type="circle"
                            maxzoom={8}
                            paint={{
                                'circle-color': [
                                    'case',
                                    ['==', ['get', 'military'], true], '#a23a26',
                                    '#191712'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5, 4, 7, 7, 7],
                                'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 5, 0.25, 7, 0.14],
                                'circle-blur': 0.7,
                            }}
                        />
                        {mapIconsReady && (
                            <Layer
                                id="flights-icons"
                                type="symbol"
                                layout={{
                                    'icon-image': FLIGHT_ICON_IMAGE,
                                    'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 1.1, 3, 1.4, 5, 1.7, 7, 1.7, 10, 1.6],
                                    'icon-rotate': ['get', 'heading'],
                                    'icon-rotation-alignment': 'map',
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true,
                                    'icon-pitch-alignment': 'map',
                                }}
                                paint={{
                                    'icon-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.88, 6, 0.95, 10, 1]
                                }}
                            />
                        )}
                    </Source>
                )}

                {/* ACLED Conflict Events Layer */}
                {activeLayers.includes('conflicts') && acledData?.features?.length > 0 && (
                    <Source id="acled-data" type="geojson" data={acledData}>
                        <Layer
                            id="acled-heatmap"
                            type="heatmap"
                            maxzoom={7}
                            paint={{
                                'heatmap-weight': ['interpolate', ['linear'], ['get', 'fatalities'], 0, 0.2, 10, 0.6, 50, 1],
                                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 6, 1],
                                'heatmap-color': [
                                    'interpolate', ['linear'], ['heatmap-density'],
                                    0, 'rgba(0,0,0,0)',
                                    0.15, 'rgba(255,200,50,0.12)',
                                    0.3, 'rgba(255,120,30,0.25)',
                                    0.5, 'rgba(255,60,20,0.45)',
                                    0.7, 'rgba(200,20,10,0.65)',
                                    1, 'rgba(180,0,0,0.85)'
                                ],
                                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 12, 5, 25, 7, 35],
                                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 8, 0]
                            }}
                        />
                        <Layer
                            id="acled-circles"
                            type="circle"
                            minzoom={5}
                            paint={{
                                'circle-color': [
                                    'match', ['get', 'eventType'],
                                    'Battles', '#ef4444',
                                    'Explosions/Remote violence', '#f97316',
                                    'Violence against civilians', '#dc2626',
                                    'Strategic developments', '#6f6c63',
                                    '#f59e0b'
                                ],
                                'circle-radius': [
                                    'interpolate', ['linear'],
                                    ['coalesce', ['get', 'fatalities'], 0],
                                    0, 3, 5, 5, 20, 8, 100, 14
                                ],
                                'circle-opacity': 0.75,
                                'circle-stroke-width': 1,
                                'circle-stroke-color': 'rgba(255,255,255,0.3)'
                            }}
                        />
                    </Source>
                )}

                {/* Vessel path vectors — heading look-ahead, drawn under the position dots */}
                {vesselsLayerActive && vesselPaths?.features?.length > 0 && (
                    <Source id="vessel-paths" type="geojson" data={vesselPaths}>
                        <Layer
                            id="vessel-paths-lines"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={{
                                'line-color': [
                                    'match',
                                    ['get', 'category'],
                                    ...Object.entries(VESSEL_CATEGORY_COLOR).flatMap(([k, v]) => [k, v]),
                                    '#a9a59a'
                                ],
                                'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 0.9, 10, 1.5],
                                'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.32, 6, 0.48, 10, 0.68]
                            }}
                        />
                    </Source>
                )}

                {/* Vessels Layer — density wash at world zoom + hull icons by category.
                    data stays EMPTY_TRAFFIC: the traffic animator owns all setData. */}
                {vesselsLayerActive && vesselsData?.features?.length > 0 && (
                    <Source id="vessels-data" type="geojson" data={EMPTY_TRAFFIC} buffer={0}>
                        <Layer
                            id="vessels-density"
                            type="heatmap"
                            maxzoom={5}
                            paint={{
                                'heatmap-weight': 1,
                                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 4, 0.9, 5, 1.1],
                                'heatmap-color': [
                                    'interpolate', ['linear'], ['heatmap-density'],
                                    0, 'rgba(0,0,0,0)',
                                    0.25, 'rgba(31,110,67,0.10)',
                                    0.6, 'rgba(31,110,67,0.20)',
                                    1, 'rgba(31,110,67,0.32)'
                                ],
                                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 4, 14, 5, 18],
                                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 5, 0]
                            }}
                        />
                        <Layer
                            id="vessels-glow"
                            type="circle"
                            maxzoom={8}
                            paint={{
                                'circle-color': [
                                    'match', ['get', 'category'],
                                    'cargo', '#1f6e43',
                                    'tanker', '#a23a26',
                                    'passenger', '#191712',
                                    'fishing', '#6f6c63',
                                    'tug', '#8f8b80',
                                    'pleasure', '#8f8b80',
                                    '#a9a59a'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 4, 6, 7, 6],
                                'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 5, 0.26, 7, 0.14],
                                'circle-blur': 0.7,
                            }}
                        />
                        {mapIconsReady && (
                            <Layer
                                id="vessels-icons"
                                type="symbol"
                                layout={{
                                    'icon-image': VESSEL_ICON_IMAGE,
                                    'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 1.15, 3, 1.35, 5, 1.55, 7, 1.55, 10, 1.3],
                                    // Rotate along course (matches the look-ahead path vector); fall
                                    // back to heading. Moored/drifting vessels (<1kt) point north so
                                    // a stale gyro heading doesn't spin them randomly.
                                    'icon-rotate': [
                                        'case',
                                        ['<', ['coalesce', ['get', 'speed'], 0], 1], 0,
                                        ['has', 'course'], ['get', 'course'],
                                        ['get', 'heading']
                                    ],
                                    'icon-rotation-alignment': 'map',
                                    'icon-allow-overlap': true,
                                    'icon-ignore-placement': true,
                                    'icon-pitch-alignment': 'map',
                                    'text-field': ['step', ['zoom'], '', 8, ['get', 'name']],
                                    'text-size': 9,
                                    'text-offset': [0, 1.4],
                                    'text-anchor': 'top',
                                    'text-allow-overlap': false,
                                }}
                                paint={{
                                    'icon-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.86, 6, 0.93, 10, 0.98],
                                    'text-color': '#191712',
                                    'text-halo-color': 'rgba(255,255,255,0.85)',
                                    'text-halo-width': 1,
                                }}
                            />
                        )}
                    </Source>
                )}

                {/* FloodOps — HII gauges + Chao Phraya cascade flow corridors (Thailand) */}
                {viewMode === 'thailand' && floodResource.data?.geo && (
                    <>
                        <Source id="flood-corridors" type="geojson" data={floodResource.data.geo.corridors}>
                            <Layer
                                id="flood-corridors-flow"
                                type="line"
                                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                                paint={{
                                    'line-color': ['case', ['>=', ['get', 'level'], 4], '#a23a26', '#1f6e43'],
                                    'line-width': [
                                        'interpolate', ['linear'], ['coalesce', ['get', 'discharge'], 0],
                                        0, 1.2, 200, 2.2, 600, 3.6, 1500, 5.5
                                    ],
                                    'line-opacity': 0.55,
                                    'line-dasharray': [0, 4, 3]
                                }}
                            />
                            <Layer
                                id="flood-corridors-arrows"
                                type="symbol"
                                layout={{
                                    'symbol-placement': 'line',
                                    'symbol-spacing': 110,
                                    'text-field': '▶',
                                    'text-size': 11,
                                    'text-keep-upright': false,
                                    'text-allow-overlap': true,
                                    'text-rotation-alignment': 'map',
                                    'text-pitch-alignment': 'map',
                                }}
                                paint={{
                                    'text-color': ['case', ['>=', ['get', 'level'], 4], '#a23a26', '#1f6e43'],
                                    'text-opacity': 0.9,
                                    'text-halo-color': 'rgba(255,255,255,0.8)',
                                    'text-halo-width': 1,
                                }}
                            />
                        </Source>
                        <Source id="flood-stations" type="geojson" data={floodResource.data.geo.stations}>
                            {/* Alert gauges (level ≥3 or on the cascade) — always visible */}
                            <Layer
                                id="flood-stations-alert"
                                type="circle"
                                filter={['any', ['>=', ['get', 'level'], 3], ['==', ['get', 'onCascade'], true]]}
                                paint={{
                                    'circle-color': [
                                        'match', ['get', 'level'],
                                        5, '#7c2b1c',
                                        4, '#a23a26',
                                        3, '#6f6c63',
                                        2, '#8f8b80',
                                        '#1f6e43'
                                    ],
                                    'circle-radius': [
                                        'case',
                                        ['>=', ['get', 'level'], 5], 6,
                                        ['>=', ['get', 'level'], 4], 5,
                                        ['==', ['get', 'onCascade'], true], 4.5,
                                        3.5
                                    ],
                                    'circle-opacity': 0.9,
                                    'circle-stroke-width': 1.2,
                                    'circle-stroke-color': 'rgba(255,255,255,0.9)'
                                }}
                            />
                            {/* Full national network fades in when zoomed to a basin */}
                            <Layer
                                id="flood-stations-all"
                                type="circle"
                                minzoom={7}
                                filter={['all', ['<', ['get', 'level'], 3], ['!=', ['get', 'onCascade'], true]]}
                                paint={{
                                    'circle-color': ['match', ['get', 'level'], 2, '#8f8b80', 1, '#1f6e43', '#a9a59a'],
                                    'circle-radius': 3,
                                    'circle-opacity': 0.7,
                                    'circle-stroke-width': 1,
                                    'circle-stroke-color': 'rgba(255,255,255,0.85)'
                                }}
                            />
                        </Source>
                    </>
                )}

                {hoverInfo && (
                    <Popup
                        longitude={hoverInfo.longitude}
                        latitude={hoverInfo.latitude}
                        anchor="bottom"
                        closeButton={false}
                        closeOnClick={false}
                        offset={[0, -8]}
                        className={getTooltipClassName(hoverInfo.feature.layer?.id)}
                    >
                        {(() => {
                            const p = hoverInfo.feature.properties || {};
                            const isFloodGauge = String(hoverInfo.feature.layer?.id || '').startsWith('flood-stations');
                            if (isFloodGauge) {
                                return (
                                    <div className="traffic-tooltip-content">
                                        <div className="traffic-tooltip-header">{p.code} · {p.name}</div>
                                        <div className="traffic-tooltip-row">
                                            <span>Bank</span>
                                            <span>{p.pct != null ? `${Math.round(p.pct)}%` : '—'} · lvl {p.level}/5</span>
                                        </div>
                                        <div className="traffic-tooltip-row">
                                            <span>Level</span>
                                            <span>{p.msl != null ? `${p.msl} m MSL` : '—'}</span>
                                        </div>
                                        {p.discharge != null && p.discharge !== 0 && (
                                            <div className="traffic-tooltip-row">
                                                <span>Flow</span>
                                                <span>{Math.round(p.discharge)} m³/s</span>
                                            </div>
                                        )}
                                        {p.trendCmH != null && (
                                            <div className="traffic-tooltip-row">
                                                <span>Trend</span>
                                                <span>{p.trendCmH > 0 ? '+' : ''}{p.trendCmH} cm/h</span>
                                            </div>
                                        )}
                                        {p.province && (
                                            <div className="traffic-tooltip-row">
                                                <span>Province</span>
                                                <span>{p.province}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            const isFlight = hoverInfo.feature.layer?.id === 'flights-icons' || p.hex;
                            if (isFlight) {
                                const flagEmoji = (cc) => (cc && cc.length === 2)
                                    ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
                                    : '';
                                const header = p.flightIata || (p.callsign ? p.callsign.toUpperCase() : p.hex);
                                const route = p.route || (p.origin ? `${p.origin}${p.destination ? ` → ${p.destination}` : ''}` : null);
                                return (
                                    <div className="traffic-tooltip-content">
                                        <div className="traffic-tooltip-header">
                                            {p.flag ? `${flagEmoji(p.flag)} ` : ''}{header}
                                        </div>
                                        {route && (
                                            <div className="traffic-tooltip-row">
                                                <span>Route</span>
                                                <span>{route}</span>
                                            </div>
                                        )}
                                        {p.airline && (
                                            <div className="traffic-tooltip-row">
                                                <span>Airline</span>
                                                <span>{p.airline}</span>
                                            </div>
                                        )}
                                        <div className="traffic-tooltip-row">
                                            <span>Altitude</span>
                                            <span>{Math.round(p.altitude)} m</span>
                                        </div>
                                        <div className="traffic-tooltip-row">
                                            <span>Speed</span>
                                            <span>{Math.round((p.velocity || 0) * 1.94384)} kt</span>
                                        </div>
                                        <div className="traffic-tooltip-row">
                                            <span>Heading</span>
                                            <span>{Math.round(p.heading)}°</span>
                                        </div>
                                        <div className="traffic-tooltip-row">
                                            <span>Aircraft</span>
                                            <span>{p.aircraftType || p.type || p.desc || '—'}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div className="traffic-tooltip-content">
                                    <div className="traffic-tooltip-header">{p.name || p.mmsi || 'Vessel'}</div>
                                    <div className="traffic-tooltip-row">
                                        <span>Type</span>
                                        <span>{p.category || '—'}</span>
                                    </div>
                                    <div className="traffic-tooltip-row">
                                        <span>Speed</span>
                                        <span>{p.speed} kt</span>
                                    </div>
                                    <div className="traffic-tooltip-row">
                                        <span>Course</span>
                                        <span>{Math.round(p.course)}°</span>
                                    </div>
                                    <div className="traffic-tooltip-row">
                                        <span>MMSI</span>
                                        <span>{p.mmsi}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </Popup>
                )}

                {activeLayers.includes('conflicts') && renderSpatialAura(crisesData, 'conflicts', '#a23a26', 16)}
                {activeLayers.includes('disasters') && renderSpatialAura(disastersData, 'disasters', '#8f8b80', 14)}
                {activeLayers.includes('weather') && renderSpatialAura(weatherData, 'weather', '#6f6c63', 18)}
                {activeLayers.includes('economy') && renderSpatialAura(economyData, 'economy', '#8f8b80', 12)}
                {activeLayers.includes('aqi') && renderSpatialAura(aqiData, 'aqi', '#1f6e43', 15)}

                {activeLayers.includes('disasters') && renderMarkers(disastersData, 'marker-disaster')}
                {activeLayers.includes('conflicts') && renderMarkers(crisesData, 'marker-conflict')}
                {activeLayers.includes('weather') && renderMarkers(weatherData, 'marker-weather')}
                {activeLayers.includes('economy') && renderMarkers(economyData, 'marker-economy')}
                {activeLayers.includes('aqi') && renderMarkers(aqiData, 'marker-aqi')}

                {/* Region dots (ASEAN capitals or Thai provinces). Rendered as
                    interactive markers so click → flyTo + per-country news. */}
                {regionDots?.features?.length > 0 && regionDots.features.map((f) => {
                    const [lng, lat] = f.geometry.coordinates;
                    return (
                        <Marker
                            key={f.properties.id}
                            longitude={lng}
                            latitude={lat}
                            anchor="center"
                            onClick={(event) => {
                                event.originalEvent.stopPropagation();
                                onRegionDotClick?.({ ...f.properties, longitude: lng, latitude: lat });
                            }}
                        >
                            <div
                                style={{
                                    width: 14,
                                    height: 14,
                                    background: f.properties.color || '#191712',
                                    border: '1.5px solid rgba(255,255,255,0.9)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s'
                                }}
                                title={f.properties.country || f.properties.region}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.4)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                            />
                        </Marker>
                    );
                })}
            </Map>

            <div className="map-vignette" aria-hidden="true" />
            <div className="map-grid-overlay" aria-hidden="true" />

            <div className="map-coord-readout" aria-live="polite">
                <span className="map-coord-readout__label">Cursor position</span>
                {cursorCoords
                    ? `${formatCoord(cursorCoords.lat, 'lat')}  ${formatCoord(cursorCoords.lng, 'lng')}`
                    : 'Move cursor over map'}
            </div>

            {/* Tile-health badge — only renders when one or more raster sources have failed.
                Worst-case visibility per Dr Non / §12 (Stoic transparency). */}
            {failedSources.size > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        right: 12,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: 'var(--panel)',
                        border: '1px solid var(--line-2)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--red)',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                    }}
                    title={`Some map layers could not be loaded`}
                >
                    <AlertTriangle size={11} />
                    <span>{failedSources.size} layer{failedSources.size === 1 ? '' : 's'} unavailable</span>
                </div>
            )}

            <div
                className="map-legend map-legend--traffic"
                style={{
                    top: 12,
                    bottom: 'auto',
                    right: 10,
                    left: 'auto',
                    visibility: legendVisible ? 'visible' : 'hidden',
                    pointerEvents: legendVisible ? 'auto' : 'none'
                }}
                aria-live="polite"
                aria-hidden={!legendVisible}
            >
                {/* "SOURCES", not "LIVE TRAFFIC" — an item below may read "3d old". */}
                <div className="map-legend-title">SOURCES</div>
                <div
                    className="map-legend-item"
                    style={{ visibility: flightsLayerActive ? 'visible' : 'hidden' }}
                >
                    <span className="map-legend-line" style={{ background: '#191712' }} />
                    <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '14ch', display: 'inline-block' }}>
                        {flightCount > 0 ? `${flightCount.toLocaleString()} aircraft · ${flightSourceLabel}` : '… aircraft · ADS-B'}
                    </span>
                </div>
                <div
                    className="map-legend-item"
                    style={{ visibility: vesselsLayerActive ? 'visible' : 'hidden' }}
                >
                    <span
                        className="map-legend-line"
                        style={{ background: vesselCount > 0 ? '#1f6e43' : '#d2cfc5' }}
                    />
                    <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '14ch', display: 'inline-block' }}>
                        {vesselCount > 0
                            ? `${vesselCount.toLocaleString()} vessels · ${vesselSourceLabel}`
                            : vesselsNeedKey ? 'AIS key required' : 'Awaiting AIS feed…'}
                    </span>
                </div>
                <div
                    className="map-legend-item"
                    style={{ visibility: flightsLayerActive ? 'visible' : 'hidden' }}
                >
                    <span className="map-legend-line" style={{ background: '#8f8b80' }} />
                    <span>Aircraft vectors = 3 min look-ahead · Ship vectors = 2 min</span>
                </div>
                {activeLayers.includes('firms') && (
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: firmsLive ? 'var(--red)' : '#d2cfc5' }} />
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{firmsSourceLabel}</span>
                    </div>
                )}
                {activeLayers.includes('conflicts') && (
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: acledLive ? '#191712' : 'var(--red)' }} />
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: acledLive ? undefined : 'var(--red)' }}>{acledSourceLabel}</span>
                    </div>
                )}
            </div>

            <div
                className="map-legend map-legend--strategic"
                style={{
                    visibility: showStrategicContext ? 'visible' : 'hidden',
                    pointerEvents: showStrategicContext ? 'auto' : 'none'
                }}
                aria-hidden={!showStrategicContext}
            >
                    <div className="map-legend-title">STRATEGIC CONTEXT</div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#a23a26' }} />
                        <span>Energy route reference</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#8f8b80' }} />
                        <span>Shipping lane reference</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#6f6c63' }} />
                        <span>Regional city network</span>
                    </div>
                    <div className="map-legend-title" style={{ marginTop: '6px' }}>REFERENCE ZONES</div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(162,58,38,0.18)', borderColor: '#a23a26' }} />
                        <span>Persian Gulf focus area</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(143,139,128,0.2)', borderColor: '#8f8b80' }} />
                        <span>Horn of Africa / Yemen</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(31,110,67,0.16)', borderColor: '#1f6e43' }} />
                        <span>ASEAN urban systems</span>
                    </div>
            </div>

            {/* Active EO Layer Labels */}
            {(() => {
                const activeEoLayers = EO_TILE_LAYERS.filter(l => activeLayers.includes(l.id));
                if (activeEoLayers.length === 0) return null;
                return (
                    <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        gap: '6px',
                        zIndex: 10,
                        pointerEvents: 'none'
                    }}>
                        {activeEoLayers.map(layer => (
                            <div key={layer.id} style={{
                                background: 'var(--panel)',
                                padding: '4px 10px',
                                border: '1px solid var(--line-2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span style={{ fontSize: '0.7rem' }}>{layer.icon}</span>
                                <span style={{
                                    fontSize: '0.46rem',
                                    fontWeight: 700,
                                    color: 'var(--ink)',
                                    letterSpacing: '0.5px'
                                }}>
                                    {layer.name}
                                </span>
                                <span style={{
                                    fontSize: '0.38rem',
                                    color: 'var(--ink-3)',
                                    letterSpacing: '0.3px'
                                }}>
                                    {layer.attribution}
                                </span>
                            </div>
                        ))}
                    </div>
                );
            })()}
        </div>
    );
};

export default MapContainer;
