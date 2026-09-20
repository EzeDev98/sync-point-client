import { getIsOnline } from '@core/network/networkService';
import { fetchRemoteBuildId, markBuildApplied } from '@features/device/services/versionService';

/**
 * Destructive wipe of everything this origin owns, followed by a reload.
 *
 * Only reachable from the update-accept flow at sign-in, where logout has
 * already guaranteed there are no pending transactions.
 */

/** Survives the wipe — it holds data preserved from an expired session. */
const PROTECTED_DATABASES = ['syncpoint_quarantine_db'];

/** Resolves regardless of outcome: a blocked delete must not stall the reset. */
function deleteDatabase(name) {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = resolve;
    request.onerror = resolve;
    request.onblocked = resolve;
  });
}

async function unregisterServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function deleteCaches() {
  if (!('caches' in window)) return;

  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function deleteDatabases() {
  if (!('indexedDB' in window)) return;

  // Firefox has no indexedDB.databases(); fall back to the known name.
  if (typeof indexedDB.databases !== 'function') {
    await deleteDatabase('syncpoint_db');
    return;
  }

  const databases = await indexedDB.databases();

  await Promise.all(
    databases
      .filter((db) => db.name && !PROTECTED_DATABASES.includes(db.name))
      .map((db) => deleteDatabase(db.name))
  );
}

function clearWebStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.clear();
    } catch (err) {
      console.warn('[hardReset] Storage clear failed:', err);
    }
  }
}

export async function performHardReset(targetBuildId) {
  if (!getIsOnline()) {
    throw new Error('OFFLINE');
  }

  // Resolved before anything is wiped, so a failed lookup cannot leave a half-reset device.
  const buildToRecord = targetBuildId ?? (await fetchRemoteBuildId());

  console.log('[hardReset] Starting full reset...');

  // Order matters: unregister the service worker first, so no in-flight
  // fetch handler can repopulate a cache that is about to be deleted.
  await unregisterServiceWorkers();
  await deleteCaches();
  await deleteDatabases();
  clearWebStorage();
  // The wipe above removed the marker, so write it back or the next check prompts again.
  markBuildApplied(buildToRecord);

  console.log('[hardReset] Complete — reloading.');

  // The query string defeats any remaining HTTP cache on the reload itself.
  window.location.href = `${window.location.origin}/login?fresh=${Date.now()}`;
}