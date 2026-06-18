import { useSyncExternalStore } from 'react';
import { getVesselCount, subscribeVesselCount } from '../services/vesselCountBus';

export const useVesselCount = () =>
    useSyncExternalStore(subscribeVesselCount, getVesselCount, () => 0);
