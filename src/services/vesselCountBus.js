/** Lightweight vessel-count pub/sub — avoids lifting count into App state. */
let count = 0;
const listeners = new Set();

export const setVesselCount = (next) => {
    if (next === count) return;
    count = next;
    listeners.forEach((fn) => fn(count));
};

export const getVesselCount = () => count;

export const subscribeVesselCount = (fn) => {
    listeners.add(fn);
    fn(count);
    return () => listeners.delete(fn);
};
