/**
 * Earth Observation Tile Layers
 *
 * Provides raster tile layer configurations for MapLibre from:
 *   - NASA GIBS (Global Imagery Browse Services) — VIIRS, MODIS
 *   - JAXA GSMaP (precipitation)
 *   - Sentinel-5P (NO₂ air pollution)
 *   - EO Dashboard indicators
 *
 * All endpoints are free, no API key needed.
 */

/** Build a GIBS WMTS tile URL.
 *
 *  The time slot is the literal token `default`, which GIBS resolves to the most
 *  recent date it actually holds for that layer. Every layer used to be pinned to
 *  "2 days ago", but each product has its own lag — AMSR2 soil moisture runs ~6
 *  days behind — so the fixed offset 404'd for anything that did not match. */
const gibsTileUrl = (layer, tileMatrix = 'GoogleMapsCompatible_Level9', format = 'png') =>
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/default/${tileMatrix}/{z}/{y}/{x}.${format}`;

/** Expand one GIBS tile template into 3 subdomain-rotated URLs so MapLibre can round-robin.
 *  If one subdomain stalls, the others keep the layer alive. NASA GIBS supports
 *  gibs.earthdata, gibs-a.earthdata, gibs-b.earthdata as load-balanced mirrors. */
const gibsRedundant = (url) => [
    url,
    url.replace('gibs.earthdata.nasa.gov', 'gibs-a.earthdata.nasa.gov'),
    url.replace('gibs.earthdata.nasa.gov', 'gibs-b.earthdata.nasa.gov')
];

/**
 * All available Earth Observation raster layers.
 * Each entry produces a MapLibre raster source + layer config.
 */
export const EO_TILE_LAYERS = [
    {
        id: 'eo-nightlights',
        name: 'Nightlights (VIIRS)',
        description: 'City lights observed by the Suomi-NPP satellite',
        group: 'satellite',
        icon: '🌃',
        tiles: gibsRedundant(
            gibsTileUrl('VIIRS_SNPP_DayNightBand_AtSensor_M15', 'GoogleMapsCompatible_Level8', 'jpg')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / VIIRS',
        // Default-on, so it sits under the operational layers rather than shouting.
        opacity: 0.5,
        maxzoom: 8
    },
    {
        id: 'eo-vegetation',
        name: 'Vegetation (NDVI)',
        description: 'Global vegetation index from MODIS satellite',
        group: 'satellite',
        icon: '🌿',
        tiles: gibsRedundant(
            gibsTileUrl('MODIS_Terra_NDVI_8Day', 'GoogleMapsCompatible_Level9', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / MODIS Terra',
        opacity: 0.6,
        maxzoom: 8
    },
    {
        id: 'eo-true-color',
        name: 'True Color (VIIRS)',
        description: 'Daily true-color satellite imagery',
        group: 'satellite',
        icon: '🛰️',
        tiles: gibsRedundant(
            gibsTileUrl('VIIRS_SNPP_CorrectedReflectance_TrueColor', 'GoogleMapsCompatible_Level9', 'jpg')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / VIIRS',
        opacity: 0.7,
        maxzoom: 9
    },
    {
        id: 'eo-sea-surface-temp',
        name: 'Sea Surface Temp',
        description: 'Ocean temperature from MODIS satellite',
        group: 'satellite',
        icon: '🌊',
        tiles: gibsRedundant(
            gibsTileUrl('MODIS_Aqua_L3_SST_MidIR_Monthly', 'GoogleMapsCompatible_Level7', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / MODIS Aqua',
        opacity: 0.6,
        maxzoom: 7
    },
    {
        id: 'eo-fires',
        name: 'Active Fires (VIIRS)',
        description: 'Thermal anomalies detected by VIIRS satellite',
        group: 'satellite',
        icon: '🔥',
        tiles: gibsRedundant(
            gibsTileUrl('VIIRS_SNPP_Thermal_Anomalies_375m_All', 'GoogleMapsCompatible_Level9', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / VIIRS',
        opacity: 0.85,
        maxzoom: 9
    },
    {
        id: 'eo-precipitation',
        name: 'Precipitation (IMERG)',
        description: 'Global rainfall estimates from GPM satellite',
        group: 'satellite',
        icon: '🌧️',
        tiles: gibsRedundant(
            gibsTileUrl('IMERG_Precipitation_Rate', 'GoogleMapsCompatible_Level6', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / GPM IMERG',
        opacity: 0.6,
        maxzoom: 6
    },
    {
        id: 'eo-snow-cover',
        name: 'Snow Cover (MODIS)',
        description: 'Global snow coverage from MODIS',
        group: 'satellite',
        icon: '❄️',
        tiles: gibsRedundant(
            gibsTileUrl('MODIS_Terra_NDSI_Snow_Cover', 'GoogleMapsCompatible_Level9', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / MODIS',
        opacity: 0.55,
        maxzoom: 8
    },
    {
        id: 'eo-aerosol',
        name: 'Aerosol (MODIS)',
        description: 'Atmospheric aerosol optical depth',
        group: 'satellite',
        icon: '💨',
        tiles: gibsRedundant(
            gibsTileUrl('MODIS_Combined_Value_Added_AOD', 'GoogleMapsCompatible_Level6', 'png')
        ),
        tileSize: 256,
        attribution: 'NASA GIBS / MODIS',
        // 0.55 buried the aircraft and vessel icons when on at first paint.
        opacity: 0.38,
        maxzoom: 6
    },
    {
        id: 'eo-jaxa-soil-moisture',
        name: 'JAXA GCOM-W Soil Moisture',
        description: 'Land surface soil moisture from JAXA GCOM-W1 AMSR2 (LPRM downscaled C1 band, daytime daily)',
        group: 'satellite',
        icon: '🇯🇵',
        tiles: gibsRedundant(
            gibsTileUrl('LPRM_AMSR2_Downscaled_Surface_Soil_Moisture_C1_Band_Day_Daily', 'GoogleMapsCompatible_Level6', 'png')
        ),
        tileSize: 256,
        attribution: 'JAXA GCOM-W / NASA GIBS',
        opacity: 0.65,
        maxzoom: 6
    },
    {
        id: 'eo-sentinel2-cloudless',
        name: 'Sentinel-2 Cloudless',
        description: 'Cloud-free mosaic from ESA Sentinel-2 (EOX)',
        group: 'satellite',
        icon: '🛰️',
        tiles: [
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
        ],
        tileSize: 256,
        attribution: 'EOX / ESA Sentinel-2',
        opacity: 0.7,
        maxzoom: 14
    },
    {
        id: 'eo-surface-water',
        name: 'Surface Water (JRC)',
        description: 'Global surface water occurrence from Landsat archive',
        group: 'satellite',
        icon: '💧',
        tiles: [
            'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: 'EC JRC / Google',
        opacity: 0.6,
        maxzoom: 13
    },
    {
        id: 'eo-bathymetry',
        name: 'Ocean Bathymetry',
        description: 'Seabed depth from EMODnet',
        group: 'satellite',
        icon: '🌊',
        tiles: [
            'https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: 'EMODnet Bathymetry',
        opacity: 0.55,
        maxzoom: 12
    },
    {
        id: 'eo-weather-radar',
        name: 'Weather Radar',
        description: 'Live precipitation radar from RainViewer',
        group: 'satellite',
        icon: '🌧️',
        tiles: [
            'https://tilecache.rainviewer.com/v2/radar/644896ac8ee5/256/{z}/{x}/{y}/2/1_1.png'
        ],
        tileSize: 256,
        attribution: 'RainViewer',
        opacity: 0.6,
        maxzoom: 10
    }
    // 'eo-wind' removed: it pointed at OpenWeatherMap with an API key committed in
    // this file and shipped in the public bundle. The key has been in git history
    // since March and must be ROTATED at openweathermap.org — deleting the line
    // does not revoke it. Restoring wind needs a key in the environment behind a
    // /api tile proxy, never in source. (Same removal as main, commit bb1854e.)
];

// Dynamic COG layers registered at runtime from STAC search results
const dynamicLayers = new Map();

/** Register a COG layer from a STAC scene asset */
export const registerCogLayer = ({ id, name, tileUrl, bbox, attribution, opacity = 0.7, maxzoom = 14 }) => {
    const layer = {
        id: `eo-cog-${id}`,
        name,
        description: `COG layer from STAC scene ${id}`,
        group: 'satellite',
        type: 'cog',
        icon: '🛰️',
        tiles: [tileUrl],
        tileSize: 256,
        bounds: bbox,
        attribution: attribution || 'STAC COG',
        opacity,
        maxzoom
    };
    dynamicLayers.set(layer.id, layer);
    return layer;
};

/** Remove a dynamic COG layer */
export const unregisterCogLayer = (id) => dynamicLayers.delete(`eo-cog-${id}`);

/** Get all layers including dynamic COG layers */
export const getAllEoLayers = () => [...EO_TILE_LAYERS, ...dynamicLayers.values()];

/** Get layer config by ID */
export const getEoLayerById = (id) =>
    EO_TILE_LAYERS.find((l) => l.id === id) || dynamicLayers.get(id);

/** Get all layer IDs */
export const getEoLayerIds = () => [...EO_TILE_LAYERS.map((l) => l.id), ...dynamicLayers.keys()];
