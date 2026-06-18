import { fetchBackendJson } from './backendClient.js';

export const fetchRainviewerTiles = async () => fetchBackendJson('/api/rainviewer');
