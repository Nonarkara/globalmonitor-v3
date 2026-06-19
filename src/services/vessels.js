import { fetchBackendJson } from './backendClient.js';

export const fetchVessels = async (theater = 'middleeast') => fetchBackendJson('/api/vessels', { theater });
