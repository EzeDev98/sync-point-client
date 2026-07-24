/**
 * Single source of truth for connectivity.
 *
 * Nothing else should read navigator.onLine — the value is only meaningful
 * once, at the moment it is sampled, and components that read it directly
 * miss every subsequent change. Subscribe here instead.
 */

const listeners = new Set();
let isOnline = navigator.onLine;

function setOnline(next) {
  if (isOnline === next) return;
  isOnline = next;
  listeners.forEach((listener) => listener(isOnline));
}

window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

export function getIsOnline() {
  return isOnline;
}

/** Subscribes to changes. Returns an unsubscribe function. */
export function onNetworkChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * True when an error looks like a transport failure rather than a rejection
 * by the server.
 *
 * The distinction decides whether a queued transaction is retried or marked
 * failed, so it lives here next to the connectivity state rather than being
 * re-derived by each caller.
 */
export function isNetworkFailure(error) {
  return (
    !isOnline ||
    error instanceof TypeError ||
    /failed to fetch|network|load failed/i.test(error?.message || '')
  );
}