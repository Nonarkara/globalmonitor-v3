/**
 * ACLED conflict events — fetches geocoded attack/battle data from backend.
 */

import { fetchBackendJson } from './backendClient.js';

export const fetchAcledEvents = async (theater = 'middleeast') => {
    return fetchBackendJson('/api/acled', { theater });
};
