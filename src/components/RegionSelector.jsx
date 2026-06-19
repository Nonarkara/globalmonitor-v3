import React from 'react';
import { ASEAN_COUNTRIES, THAILAND_REGIONS } from '../data/regions';

const regions = [
    {
        id: 'global',
        name: 'Global',
        viewState: { longitude: 0, latitude: 20, zoom: 1.7, pitch: 20, bearing: -10 }
    },
    {
        id: 'middleeast',
        name: 'Middle East',
        viewState: { longitude: 51.5, latitude: 28.5, zoom: 4.4, pitch: 30, bearing: -18 }
    },
    {
        id: 'iran',
        name: 'Iran',
        viewState: { longitude: 53, latitude: 32.5, zoom: 5.5, pitch: 30, bearing: -12 }
    },
    {
        id: 'gulf',
        name: 'Persian Gulf',
        viewState: { longitude: 52, latitude: 26, zoom: 5.8, pitch: 35, bearing: -20 }
    },
    {
        id: 'levant',
        name: 'Levant',
        viewState: { longitude: 36, latitude: 33, zoom: 5.8, pitch: 28, bearing: -14 }
    },
    {
        id: 'redsea',
        name: 'Red Sea',
        viewState: { longitude: 40, latitude: 18, zoom: 5.2, pitch: 26, bearing: -10 }
    }
];

const RegionSelector = ({ activeRegion, onSelectRegion, viewMode }) => {
    const activeRegions = viewMode === 'indopacific'
        ? [
            { id: 'asean', name: 'ASEAN', viewState: { longitude: 105, latitude: 10, zoom: 4, pitch: 0, bearing: 0 } },
            ...ASEAN_COUNTRIES.map((country) => ({
                id: country.code,
                name: country.name,
                viewState: { longitude: country.lng, latitude: country.lat, zoom: 5.1, pitch: 0, bearing: 0 }
            }))
        ]
        : viewMode === 'thailand'
            ? [
                { id: 'thailand', name: 'Thailand', viewState: { longitude: 100.9925, latitude: 15.87, zoom: 5.5, pitch: 0, bearing: 0 } },
                ...THAILAND_REGIONS.map((region) => ({
                    id: region.code,
                    name: region.name,
                    viewState: { longitude: region.lng, latitude: region.lat, zoom: 7.1, pitch: 10, bearing: 0 }
                }))
            ]
            : regions;

    return (
        <div className="region-selector">
            {activeRegions.map((region) => (
                <button
                    key={region.id}
                    className={`region-btn ${activeRegion === region.id ? 'active' : ''}`}
                    onClick={() => onSelectRegion(region.id, region.viewState)}
                >
                    {region.name}
                </button>
            ))}
        </div>
    );
};

export default RegionSelector;
