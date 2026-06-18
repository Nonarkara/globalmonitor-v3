import { useSyncExternalStore } from 'react';
import { getFlightCount, subscribeFlightCount } from '../services/flightCountBus';

export const useFlightCount = () =>
    useSyncExternalStore(subscribeFlightCount, getFlightCount, () => 0);
