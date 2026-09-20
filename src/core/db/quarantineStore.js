/**
 * A separate database holding preserved sessions.
 *
 * Kept apart from the main store on purpose: quarantined data must survive
 * a hard reset, which deletes every other database this origin owns.
 */

const DB_NAME = 'syncpoint_quarantine_db';
const DB_VERSION = 1;
const STORE_NAME = 'quarantine';

let connectionPromise = null;

function openQuarantineDatabase() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'walletId' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onclose = () => {
        connectionPromise = null;
      };
      resolve(db);
    };

    request.onerror = (event) => {
      connectionPromise = null;
      reject(event.target.error);
    };
  });

  return connectionPromise;
}

/**
 * Runs work against the quarantine store, resolving on transaction
 * completion rather than request success.
 *
 * quarantineService previously wrote this promise wrapper out three times —
 * the same duplication the main database helper removed.
 */
async function withQuarantineStore(mode, work) {
  const db = await openQuarantineDatabase();

  return new Promise((resolve, reject) => {
    let result;

    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => resolve(result);
    tx.onerror = (event) => reject(event.target.error);
    tx.onabort = (event) => reject(event.target.error ?? new Error('Transaction aborted.'));

    try {
      work(store, (value) => {
        result = value;
      });
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}

export async function saveQuarantineEntry(entry) {
  await withQuarantineStore('readwrite', (store) => {
    store.put(entry);
  });
}

export function getQuarantineEntry(walletId) {
  return withQuarantineStore('readonly', (store, setResult) => {
    const request = store.get(walletId);
    request.onsuccess = () => setResult(request.result || null);
  });
}

export async function deleteQuarantineEntry(walletId) {
  await withQuarantineStore('readwrite', (store) => {
    store.delete(walletId);
  });
}
export function getAllQuarantineEntries() {
  return withQuarantineStore('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result || []);
  });
}
