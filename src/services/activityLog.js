/**
 * Session Activity Log — in-memory audit trail for the current session.
 * Tracks data fetches, errors, user actions, and panel refreshes.
 * Government best practice: know what data was viewed and when.
 */

const MAX_ENTRIES = 200;
const log = [];
let snapshot = [];
const listeners = new Set();

export const LOG_TYPES = {
    DATA_FETCH: 'data',
    ERROR: 'error',
    USER_ACTION: 'action',
    SYSTEM: 'system'
};

const notify = () => {
    snapshot = [...log];
    listeners.forEach(fn => fn());
};

export const logActivity = (type, message, details = null) => {
    const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type,
        message,
        details
    };
    log.unshift(entry); // newest first
    if (log.length > MAX_ENTRIES) log.pop();
    notify();
};

export const getActivityLog = () => snapshot;

export const subscribeActivityLog = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export const clearActivityLog = () => {
    log.length = 0;
    notify();
};

/** Session start entry */
logActivity(LOG_TYPES.SYSTEM, 'Dashboard session started', {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
    timestamp: new Date().toISOString()
});
