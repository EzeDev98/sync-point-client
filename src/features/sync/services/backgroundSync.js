// Registers browser Background Sync with the service worker.
const SYNC_TAG = 'sync-transactions';

function isSupported() {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}

export async function registerBackgroundSync() {
  if (!isSupported()) {
    console.log('[backgroundSync] Not supported on this browser.');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(SYNC_TAG);
    console.log('[backgroundSync] Registered.');
    return true;
  } catch (err) {
    console.error('[backgroundSync] Registration failed:', err);
    return false;
  }
}

export async function getSyncTags() {
  if (!isSupported()) return [];

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.sync.getTags();
  } catch (err) {
    console.error('[backgroundSync] Failed to read sync tags:', err);
    return [];
  }
}
