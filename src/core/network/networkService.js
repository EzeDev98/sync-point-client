// Single source of truth for connectivity state.
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

export function onNetworkChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isNetworkFailure(error) {
  return (
    !isOnline ||
    error instanceof TypeError ||
    /failed to fetch|network|load failed/i.test(error?.message || '')
  );
}
