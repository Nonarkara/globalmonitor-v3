import { fetchBackendJson } from './backendClient.js';

export const fetchFlights = async (theater = 'middleeast') => {
    return fetchBackendJson('/api/flights', { theater });
};
