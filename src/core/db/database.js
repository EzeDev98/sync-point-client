/**
 * IndexedDB connection, schema and the transaction helper every repository
 * builds on.
 *
 * Record shape:
 *   { id, iv, data, status, entryType, type, createdAt, synced,
 *     syncAttempts, lastSyncError, syncedAt }
 *
 * Only those fields are plaintext. Everything sensitive — amounts, wallet
 * IDs, phone numbers, names, references — lives exclusively inside the
 * encrypted `data` blob.
 */

const DB_NAME = 'syncpoint_db';
const DB_VERSION = 3;

export const STORE_TRANSACTIONS = 'transactions';

/**
 * Stores from v1/v2 that cannot be migrated: they held plaintext records
 * under a different keyPath, and there is no key available at upgrade time
 * to encrypt them with.
 */
const LEGACY_STORES = ['pending_transactions', 'transactions', 'metadata'];

/**
 * Cached connection.
 *
 * Previously every one of the fifteen exported functions called openDB()
 * itself, so a single dashboard render opened and abandoned a handful of
 * separate connections. Holding the promise means concurrent callers share
 * one connection and only the first pays the open cost.
 */
let connectionPromise = null;

function createSchema(db) {
  const store = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });

  // Only non-sensitive metadata is indexed.
  store.createIndex('status', 'status', { unique: false });
  store.createIndex('entryType', 'entryType', { unique: false });
  store.createIndex('type', 'type', { unique: false });
  store.createIndex('createdAt', 'createdAt', { unique: false });

  // `synced` is stored as a real boolean, and booleans are NOT a valid
  // IndexedDB key type. This index can be cursored, but index.getAll(true)
  // or getAll(false) throws a DataError synchronously. Filter on `synced`
  // in JS after a plain getAll() instead — see countPendingTransfers.
  store.createIndex('synced', 'synced', { unique: false });
}

export function openDatabase() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (event.oldVersion < 3) {
        for (const name of LEGACY_STORES) {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
            console.log(`[db] Dropped legacy store: ${name}`);
          }
        }
      }

      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        createSchema(db);
        console.log('[db] Encrypted transactions store created (v3).');
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      // A connection closed by the browser, or blocked by a newer version in
      // another tab, must not stay cached — the next call reopens it.
      db.onclose = () => {
        connectionPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        connectionPromise = null;
      };

      resolve(db);
    };

    request.onerror = (event) => {
      connectionPromise = null;
      console.error('[db] Open error:', event.target.error);
      reject(event.target.error);
    };
  });

  return connectionPromise;
}

/**
 * Runs `work` inside a store transaction and resolves once the transaction
 * itself completes.
 *
 * This replaces the promise-wrapping boilerplate that was written out
 * fifteen times. Resolving on `tx.oncomplete` rather than on the individual
 * request's `onsuccess` matters: a request can succeed while the surrounding
 * transaction later aborts, and the old code resolved early in that case and
 * reported a write as durable when it had been rolled back.
 *
 * @param mode 'readonly' | 'readwrite'
 * @param work receives the object store; its return value is the result
 */
export async function withTransactions(mode, work) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let result;
    let failed = false;

    const tx = db.transaction(STORE_TRANSACTIONS, mode);
    const store = tx.objectStore(STORE_TRANSACTIONS);

    tx.oncomplete = () => {
      if (!failed) resolve(result);
    };

    tx.onerror = (event) => {
      failed = true;
      reject(event.target.error);
    };

    tx.onabort = (event) => {
      failed = true;
      reject(event.target.error ?? new Error('[db] Transaction aborted.'));
    };

    try {
      result = work(store, (value) => {
        result = value;
      });
    } catch (err) {
      failed = true;
      tx.abort();
      reject(err);
    }
  });
}

/** Promisifies a single IDBRequest. */
export function toPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}