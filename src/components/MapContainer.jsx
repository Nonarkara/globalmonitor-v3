import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import { Copy, Check, AlertTriangle } from 'lucide-react';
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
import { useLiveResource } from '../hooks/useLiveResource';
import { EO_TILE_LAYERS, getEoLayerById } from '../services/eoTiles';
import { fetchSdgLayer } from '../services/undpSdg';
import { getRegion } from '../data/regions.js';

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

const buildFlightPaths = (flights) => {
    if (!flights?.features?.length) return null;
    const features = flights.features
        .filter((f) => {
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

const MAP_MIN_ZOOM = 2.5;
const MAP_MAX_ZOOM = 18;

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
                fill: '#ef4444',
                line: '#fca5a5'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[94, -6], [109, -6], [109, 18], [94, 18], [94, -6]]]
            },
            properties: {
                fill: '#10b981',
                line: '#6ee7b7'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[32, 11], [45, 11], [45, 22], [32, 22], [32, 11]]]
            },
            properties: {
                fill: '#f59e0b',
                line: '#fcd34d'
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
                color: '#ef4444',
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
                color: '#f59e0b',
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
                color: '#38bdf8',
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
        { type: 'Feature', geometry: { type: 'Point', coordinates: [51.47, 25.28] }, properties: { color: '#ef4444', radius: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [55.36, 25.25] }, properties: { color: '#ef4444', radius: 12 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [53.68, 32.42] }, properties: { color: '#ef4444', radius: 11 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties: { color: '#10b981', radius: 12 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [103.82, 1.35] }, properties: { color: '#38bdf8', radius: 11 } }
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
                color: '#10b981',
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
                color: '#38bdf8',
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
                color: '#ef4444',
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
                color: '#f59e0b',
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
                color: '#8b5cf6',
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
                color: '#38bdf8'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[100.5, 13.75], [106.82, -6.18], [103.82, 1.35], [121.56, 25.03]]
            },
            properties: {
                color: '#10b981'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [[103.82, 1.35], [114.17, 22.32], [121.56, 25.03], [139.76, 35.68]]
            },
            properties: {
                color: '#f59e0b'
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
            properties: { name: 'Bangkok', tier: 'policy engine', color: '#10b981', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [103.82, 1.35] },
            properties: { name: 'Singapore', tier: 'logistics core', color: '#38bdf8', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [55.27, 25.2] },
            properties: { name: 'Dubai', tier: 'airspace hinge', color: '#ef4444', radius: 8 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [121.56, 25.03] },
            properties: { name: 'Taipei', tier: 'tech nexus', color: '#f59e0b', radius: 7 }
        },
        {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [106.82, -6.18] },
            properties: { name: 'Jakarta', tier: 'metro scale', color: '#8b5cf6', radius: 7 }
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
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    satellite: ESRI_SATELLITE_STYLE,
    voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
};

const MAP_STYLE_FALLBACKS = {
    dark: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    voyager: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
};

const MapContainer = ({
    viewState,
    onMove,
    activeLayers,
    onMarkerClick,
    copernicusPreview,
    copernicusMode,
    copernicusRuntimeSource,
    showCopernicusOverlay,
    showStrategicContext,
    viewMode = 'middleeast',
    onRegionDotClick,
    onFlightCountChange
}) => {
    const region = getRegion(viewMode);
    const regionDots = region.dots;
    const [mapStyle, setMapStyle] = useState('dark');
    const mapRef = useRef(null);
    // Track which raster sources have failed (auth / 404 / CORS / 5xx) so the
    // user sees what is missing instead of a silently-empty map.
    const [failedSources, setFailedSources] = useState(() => new Set());
    // Cursor position in lat/lng — updated on mousemove for the readout overlay.
    const [cursor, setCursor] = useState(null);
    const [copied, setCopied] = useState(false);
    const [mapIconsReady, setMapIconsReady] = useState(false);
    const [rainviewerTiles, setRainviewerTiles] = useState(null);

    const handleMove = useCallback((event) => {
        const vs = event.viewState;
        onMove({
            ...vs,
            zoom: Math.min(Math.max(vs.zoom, MAP_MIN_ZOOM), MAP_MAX_ZOOM)
        });
    }, [onMove]);

    const flightsLayerActive = activeLayers.includes('flights');
    const weatherLayerActive = activeLayers.includes('weather');

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
    useEffect(() => {
        const map = mapRef.current?.getMap?.();
        if (!map) return;

        const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><g fill="#38bdf8"><ellipse cx="16" cy="16" rx="3" ry="12"/><path d="M2,13 L30,13 L16,20 Z"/><path d="M11,27 L16,24 L21,27 L16,30 Z"/></g></svg>`;
        const vesselTriangleSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><polygon points="8,1 15,14 1,14" fill="${fill}" stroke="rgba(255,255,255,0.55)" stroke-width="0.6"/></svg>`;
        const VESSEL_ICONS = [
            ['vessel-cargo', vesselTriangleSvg('#22c55e')],
            ['vessel-tanker', vesselTriangleSvg('#ef4444')],
            ['vessel-passenger', vesselTriangleSvg('#3b82f6')],
            ['vessel-fishing', vesselTriangleSvg('#f59e0b')],
            ['vessel-tug', vesselTriangleSvg('#ea580c')],
            ['vessel-pleasure', vesselTriangleSvg('#a855f7')],
            ['vessel-other', vesselTriangleSvg('#94a3b8')],
        ];

        let pending = 0;
        let loaded = 0;
        const markIconLoaded = () => {
            loaded += 1;
            if (loaded >= pending) {
                setMapIconsReady(true);
                try { map.triggerRepaint(); } catch { /* ignore */ }
            }
        };

        const addSvgImage = (name, svg, w, h) => {
            pending += 1;
            try { if (map.hasImage(name)) map.removeImage(name); } catch { /* ignore */ }
            const img = new Image(w, h);
            img.onload = () => {
                try { map.addImage(name, img); } catch { /* already added */ }
                markIconLoaded();
            };
            img.onerror = markIconLoaded;
            img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        };

        const loadIcons = () => {
            pending = 0;
            loaded = 0;
            setMapIconsReady(false);
            addSvgImage('plane-icon', PLANE_SVG, 32, 32);
            for (const [name, svg] of VESSEL_ICONS) {
                addSvgImage(name, svg, 16, 16);
            }
        };

        if (map.isStyleLoaded()) loadIcons();
        map.on('style.load', loadIcons);
        return () => { map.off('style.load', loadIcons); };
    }, [mapStyle]);

    const handleMouseMove = useCallback((event) => {
        const lng = event?.lngLat?.lng;
        const lat = event?.lngLat?.lat;
        if (typeof lat === 'number' && typeof lng === 'number') {
            setCursor({ lat, lng });
        }
    }, []);
    const handleMouseLeave = useCallback(() => setCursor(null), []);
    const copyCursor = useCallback(() => {
        if (!cursor) return;
        const text = `${cursor.lat.toFixed(5)}, ${cursor.lng.toFixed(5)}`;
        navigator.clipboard?.writeText(text).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 1200); },
            () => {}
        );
    }, [cursor]);

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
    const sdgResource = useLiveResource(useCallback(() => fetchSdgLayer(), []), {
        cacheKey: 'map:sdg',
        enabled: activeLayers.includes('sdg'),
        intervalMs: 24 * 60 * 60 * 1000,
        isUsable: (d) => d?.features?.length > 0
    });
    const firmsResource = useLiveResource(useCallback(() => fetchFirmsData(), []), {
        cacheKey: 'map:firms',
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
    const flightsResource = useLiveResource(useCallback(() => fetchFlights('global'), []), {
        cacheKey: 'map:flights:global',
        enabled: activeLayers.includes('flights'),
        intervalMs: 2 * 60 * 1000,
        isUsable: hasFeatureData
    });
    const acledResource = useLiveResource(useCallback(() => fetchAcledEvents(), []), {
        cacheKey: 'map:acled',
        enabled: activeLayers.includes('conflicts'),
        intervalMs: 60 * 60 * 1000,
        isUsable: hasFeatureData
    });
    const vesselsResource = useLiveResource(useCallback(() => fetchVessels(), []), {
        cacheKey: 'map:vessels',
        enabled: activeLayers.includes('vessels'),
        intervalMs: 60 * 1000,
        isUsable: hasFeatureData
    });

    const disastersData = disasterResource.data;
    const crisesData = conflictResource.data;
    const weatherData = weatherResource.data;
    const economyData = economyResource.data;
    const aqiData = aqiResource.data;
    const sdgData = sdgResource.data;
    const firmsData = firmsResource.data;
    const infraData = infraResource.data;
    const flightsData = flightsResource.data;
    const flightPaths = useMemo(() => buildFlightPaths(flightsData), [flightsData]);
    const flightCount = flightsData?.features?.length ?? 0;
    const vesselsData = vesselsResource.data;
    const vesselCount = vesselsData?.features?.length ?? 0;
    const vesselsNeedKey = vesselsData?.meta?.requiresKey;

    useEffect(() => {
        onFlightCountChange?.(flightsLayerActive ? flightCount : 0);
    }, [flightsLayerActive, flightCount, onFlightCountChange]);

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
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
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
                                        'fill-color': copernicusPreview.preset === 'ndvi' ? '#10b981' : '#38bdf8',
                                        'fill-opacity': 0.08
                                    }}
                                />
                                <Layer
                                    id="copernicus-preview-footprint-line"
                                    type="line"
                                    paint={{
                                        'line-color': copernicusPreview.preset === 'ndvi' ? '#10b981' : '#38bdf8',
                                        'line-width': 1.5,
                                        'line-dasharray': [2, 2],
                                        'line-opacity': 0.75
                                    }}
                                />
                            </Source>
                        )}
                    </>
                )}

                {/* UN SDG Choropleth Layer */}
                {activeLayers.includes('sdg') && sdgData && (
                    <Source id="sdg-data" type="geojson" data={sdgData}>
                        {/* Country Fill */}
                        <Layer
                            id="sdg-fill"
                            type="fill"
                            paint={{
                                'fill-color': [
                                    'step',
                                    ['coalesce', ['get', 'sdgValue'], 0],
                                    'rgba(148, 163, 184, 0.2)', // 0 (or null fallback) = grey
                                    20, '#fca5a5',             // 0-20% = light red
                                    40, '#f87171',             // 20-40% = red
                                    60, '#fcd34d',             // 40-60% = yellow
                                    80, '#86efac',             // 60-80% = light green
                                    95, '#4ade80',             // 80-95% = green
                                    100, '#22c55e'             // >95% = dark green
                                ],
                                'fill-opacity': 0.4
                            }}
                        />
                        {/* Country Outline */}
                        <Layer
                            id="sdg-line"
                            type="line"
                            paint={{
                                'line-color': 'rgba(255, 255, 255, 0.2)',
                                'line-width': 1
                            }}
                        />
                    </Source>
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
                                    'alert', '#ef4444',
                                    'damaged', '#ef4444',
                                    'closed', '#dc2626',
                                    'at_risk', '#f59e0b',
                                    'intermittent', '#f59e0b',
                                    'monitoring', '#eab308',
                                    '#22c55e'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 8],
                                'circle-opacity': 0.7,
                                'circle-stroke-width': 1.5,
                                'circle-stroke-color': [
                                    'match', ['get', 'status'],
                                    'alert', '#ef4444',
                                    'damaged', '#ef4444',
                                    'closed', '#dc2626',
                                    'at_risk', '#f59e0b',
                                    'intermittent', '#f59e0b',
                                    'monitoring', '#eab308',
                                    '#22c55e'
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
                                'text-color': 'rgba(255,255,255,0.7)',
                                'text-halo-color': 'rgba(0,0,0,0.8)',
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
                                    ['==', ['get', 'military'], true], '#f59e0b',
                                    '#58a6ff'
                                ],
                                'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2],
                                'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 6, 0.65, 10, 0.78]
                            }}
                        />
                    </Source>
                )}

                {/* Flights Layer — high-contrast glow dots + rotated plane icons */}
                {flightsLayerActive && flightCount > 0 && (
                    <Source id="flights-data" type="geojson" data={flightsData} key={mapIconsReady ? 'flights-icons-ready' : 'flights-icons-pending'}>
                        <Layer
                            id="flights-glow"
                            type="circle"
                            paint={{
                                'circle-color': [
                                    'case',
                                    ['==', ['get', 'military'], true], '#f59e0b',
                                    '#58a6ff'
                                ],
                                'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 4, 6, 7, 8, 10, 10],
                                'circle-opacity': 0.88,
                                'circle-stroke-width': 2,
                                'circle-stroke-color': '#ffffff',
                                'circle-stroke-opacity': 0.9
                            }}
                        />
                        <Layer
                            id="flights-icons"
                            type="symbol"
                            layout={{
                                'icon-image': 'plane-icon',
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.7, 4, 0.9, 7, 1.15, 10, 1.35],
                                'icon-rotate': ['get', 'heading'],
                                'icon-rotation-alignment': 'map',
                                'icon-allow-overlap': true,
                                'icon-ignore-placement': true,
                                'icon-pitch-alignment': 'map',
                            }}
                            paint={{ 'icon-opacity': 0.98 }}
                        />
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
                                    'Strategic developments', '#3b82f6',
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

                {/* Vessels Layer — VesselFinder-style triangles by ship category */}
                {activeLayers.includes('vessels') && vesselsData?.features?.length > 0 && (
                    <Source id="vessels-data" type="geojson" data={vesselsData} key={mapIconsReady ? 'vessels-icons-ready' : 'vessels-icons-pending'}>
                        <Layer
                            id="vessels-icons"
                            type="symbol"
                            layout={{
                                'icon-image': [
                                    'match', ['get', 'category'],
                                    'cargo', 'vessel-cargo',
                                    'tanker', 'vessel-tanker',
                                    'passenger', 'vessel-passenger',
                                    'fishing', 'vessel-fishing',
                                    'tug', 'vessel-tug',
                                    'pleasure', 'vessel-pleasure',
                                    'vessel-other'
                                ],
                                'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.45, 4, 0.6, 7, 0.75, 10, 0.95],
                                'icon-rotate': ['get', 'heading'],
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
                                'icon-opacity': 0.92,
                                'text-color': '#e2e8f0',
                                'text-halo-color': 'rgba(0,0,0,0.75)',
                                'text-halo-width': 1,
                            }}
                        />
                    </Source>
                )}

                {activeLayers.includes('conflicts') && renderSpatialAura(crisesData, 'conflicts', '#ef4444', 16)}
                {activeLayers.includes('disasters') && renderSpatialAura(disastersData, 'disasters', '#f59e0b', 14)}
                {activeLayers.includes('weather') && renderSpatialAura(weatherData, 'weather', '#38bdf8', 18)}
                {activeLayers.includes('economy') && renderSpatialAura(economyData, 'economy', '#FFC400', 12)}
                {activeLayers.includes('aqi') && renderSpatialAura(aqiData, 'aqi', '#10b981', 15)}

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
                                    background: f.properties.color || '#38bdf8',
                                    border: '1.5px solid rgba(255,255,255,0.85)',
                                    boxShadow: `0 0 12px ${f.properties.color || '#38bdf8'}cc`,
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

            {/* Satellite/Map style toggle */}
            <div className="map-style-toggle">
                {Object.entries({ dark: '🌑', satellite: '🛰️', voyager: '🗺️' }).map(([key, icon]) => (
                    <button
                        key={key}
                        className={`map-style-btn ${mapStyle === key ? 'active' : ''}`}
                        onClick={() => setMapStyle(key)}
                        aria-label={`Switch map to ${key} view`}
                        aria-pressed={mapStyle === key}
                        title={`${key.charAt(0).toUpperCase() + key.slice(1)} view`}
                    >
                        {icon}
                    </button>
                ))}
            </div>

            {/* Cursor lat/lng readout — bottom-left of map. Mono, hairline border, copy button. */}
            {cursor && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        background: 'rgba(5, 14, 32, 0.78)',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.7rem',
                        color: 'rgba(219, 234, 254, 0.92)',
                        letterSpacing: '0.4px',
                        pointerEvents: 'auto',
                    }}
                    aria-live="polite"
                >
                    <span>{cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)}</span>
                    <button
                        onClick={copyCursor}
                        title="Copy lat,lng to clipboard"
                        aria-label="Copy lat,lng to clipboard"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: copied ? '#4ade80' : 'rgba(56, 189, 248, 0.85)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                </div>
            )}

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
                        background: 'rgba(5, 14, 32, 0.78)',
                        border: '1px solid rgba(212, 168, 67, 0.45)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.65rem',
                        color: 'rgba(252, 211, 77, 0.92)',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                    }}
                    title={`Failed sources: ${[...failedSources].join(', ')}`}
                >
                    <AlertTriangle size={11} />
                    <span>{failedSources.size} layer{failedSources.size === 1 ? '' : 's'} unavailable</span>
                </div>
            )}

            {flightsLayerActive && flightCount > 0 && (
                <div
                    className="map-legend"
                    style={{ top: 12, bottom: 'auto', right: 10, left: 'auto' }}
                    aria-live="polite"
                >
                    <div className="map-legend-title">FLIGHT TRACKING</div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#58a6ff' }} />
                        <span>{flightCount.toLocaleString()} aircraft · worldwide ADS-B</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#f59e0b' }} />
                        <span>Heading vectors · 3 min look-ahead</span>
                    </div>
                </div>
            )}

            {activeLayers.includes('vessels') && (
                <div
                    className="map-legend"
                    style={{ top: flightsLayerActive && flightCount > 0 ? 88 : 12, bottom: 'auto', right: 10, left: 'auto' }}
                    aria-live="polite"
                >
                    <div className="map-legend-title">SHIP TRACKING</div>
                    {vesselCount > 0 ? (
                        <>
                            <div className="map-legend-item">
                                <span className="map-legend-line" style={{ background: '#22c55e' }} />
                                <span>Cargo · {vesselCount.toLocaleString()} vessels AIS</span>
                            </div>
                            <div className="map-legend-item">
                                <span className="map-legend-line" style={{ background: '#ef4444' }} />
                                <span>Tanker</span>
                            </div>
                            <div className="map-legend-item">
                                <span className="map-legend-line" style={{ background: '#3b82f6' }} />
                                <span>Passenger</span>
                            </div>
                            <div className="map-legend-item">
                                <span className="map-legend-line" style={{ background: '#f59e0b' }} />
                                <span>Fishing / tug</span>
                            </div>
                            <div className="map-legend-item">
                                <span className="map-legend-line" style={{ background: '#a855f7' }} />
                                <span>Pleasure · heading triangles</span>
                            </div>
                        </>
                    ) : (
                        <div className="map-legend-item">
                            <span className="map-legend-line" style={{ background: 'rgba(245,158,11,0.35)' }} />
                            <span>{vesselsNeedKey ? 'AIS key required · aisstream.io' : 'Awaiting AIS feed…'}</span>
                        </div>
                    )}
                </div>
            )}

            {showStrategicContext && (
                <div className="map-legend">
                    <div className="map-legend-title">STRATEGIC CONTEXT</div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#ef4444' }} />
                        <span>Energy route reference</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#f59e0b' }} />
                        <span>Shipping lane reference</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-line" style={{ background: '#38bdf8' }} />
                        <span>Regional city network</span>
                    </div>
                    <div className="map-legend-title" style={{ marginTop: '6px' }}>REFERENCE ZONES</div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(239,68,68,0.3)', borderColor: '#fca5a5' }} />
                        <span>Persian Gulf focus area</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(245,158,11,0.3)', borderColor: '#fcd34d' }} />
                        <span>Horn of Africa / Yemen</span>
                    </div>
                    <div className="map-legend-item">
                        <span className="map-legend-zone" style={{ background: 'rgba(16,185,129,0.3)', borderColor: '#6ee7b7' }} />
                        <span>ASEAN urban systems</span>
                    </div>
                </div>
            )}

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
                                background: 'rgba(10, 12, 18, 0.8)',
                                backdropFilter: 'blur(12px)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span style={{ fontSize: '0.7rem' }}>{layer.icon}</span>
                                <span style={{
                                    fontSize: '0.46rem',
                                    fontWeight: 600,
                                    color: 'rgba(255,255,255,0.7)',
                                    letterSpacing: '0.5px'
                                }}>
                                    {layer.name}
                                </span>
                                <span style={{
                                    fontSize: '0.38rem',
                                    color: 'rgba(255,255,255,0.35)',
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
