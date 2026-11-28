// Wipes all local data for this origin and reloads the app.
import { getIsOnline } from '@core/network/networkService';
import { fetchRemoteBuildId, markBuildApplied } from '@features/device/services/versionService';
import { getUpdateBlockers } from '@features/device/services/updateGuard';

const PROTECTED_DATABASES = ['syncpoint_quarantine_db'];

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

  if ((await getUpdateBlockers()).blocked) {
    throw new Error('UNSYNCED_DATA');
  }

  const buildToRecord = targetBuildId ?? (await fetchRemoteBuildId());

  console.log('[hardReset] Starting full reset...');

  await unregisterServiceWorkers();
  await deleteCaches();
  await deleteDatabases();
  clearWebStorage();
  markBuildApplied(buildToRecord);

  console.log('[hardReset] Complete — reloading.');

  window.location.href = `${window.location.origin}/login?fresh=${Date.now()}`;
}
