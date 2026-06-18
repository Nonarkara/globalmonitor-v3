/** Lightweight flight-count pub/sub — avoids lifting count into App state. */
let count = 0;
const listeners = new Set();

export const setFlightCount = (next) => {
    if (next === count) return;
    count = next;
    listeners.forEach((fn) => fn(count));
};

export const getFlightCount = () => count;

export const subscribeFlightCount = (fn) => {
    listeners.add(fn);
    fn(count);
    return () => listeners.delete(fn);
};
