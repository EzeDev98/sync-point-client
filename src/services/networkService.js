// ============================================
// NETWORK SERVICE — SyncPoint
// Single source of truth for online/offline state.
// Never use navigator.onLine directly in components.
// ============================================

const listeners = new Set();
let _isOnline = navigator.onLine;

function notify() {
  listeners.forEach((fn) => fn(_isOnline));
}

window.addEventListener("online", () => {
  _isOnline = true;
  notify();
});

window.addEventListener("offline", () => {
  _isOnline = false;
  notify();
});

export function getIsOnline() {
  return _isOnline;
}

export function onNetworkChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}