// ============================================
// HARD RESET — SyncPoint
// Destructive, total wipe of everything this origin owns.
// Only ever invoked from the update-accept flow at /login,
// where it's safe because logout already guarantees zero
// pending transactions before a user can reach this state
// in the first place — but we wipe unconditionally regardless,
// per the spec: "no business risk in deleting browser data."
// ============================================

async function unregisterAllServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
}

async function deleteAllCaches() {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

async function deleteAllIndexedDBs() {
  if (!("indexedDB" in window)) return;

  // databases() is supported in all modern browsers (Chrome, Firefox,
  // Safari 14+). Fall back to deleting the known SyncPoint DB by name
  // if databases() isn't available, so old Safari still gets a reset.
  if (typeof indexedDB.databases === "function") {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .filter((db) => db.name)
        .map(
          (db) =>
            new Promise((resolve) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve(); // best-effort, don't block reset
              req.onblocked = () => resolve();
            })
        )
    );
  } else {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("syncpoint_db");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

function clearWebStorage() {
  try {
    localStorage.clear();
  } catch (err) {
    console.warn("[HardReset] localStorage.clear() failed:", err);
  }
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("[HardReset] sessionStorage.clear() failed:", err);
  }
}

/**
 * Executes the full destructive reset, then reloads.
 * Resolves only on the reset steps — the reload itself navigates away,
 * so nothing after performHardReset() will run.
 */
export async function performHardReset() {
  console.log("[HardReset] Starting full reset...");

  // Order matters: unregister SW first so no in-flight fetch handler
  // can repopulate a cache we're about to delete.
  await unregisterAllServiceWorkers();
  await deleteAllCaches();
  await deleteAllIndexedDBs();
  clearWebStorage();

  console.log("[HardReset] Reset complete. Reloading...");

  // Bypass any remaining HTTP cache on the reload itself.
  window.location.href = `${window.location.origin}/login?fresh=${Date.now()}`;
}