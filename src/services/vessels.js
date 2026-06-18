import { fetchBackendJson } from './backendClient.js';

export const fetchVessels = async () => fetchBackendJson('/api/vessels');
