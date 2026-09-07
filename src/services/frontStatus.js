import { fetchBackendJson } from './backendClient.js';

export const fetchFrontStatus = (theater = 'middleeast') => fetchBackendJson('/api/fronts', { theater });
