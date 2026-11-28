// IndexedDB connection, schema and the shared transaction helper.
const DB_NAME = 'syncpoint_db';
const DB_VERSION = 3;

export const STORE_TRANSACTIONS = 'transactions';

const LEGACY_STORES = ['pending_transactions', 'transactions', 'metadata'];

let connectionPromise = null;

function createSchema(db) {
  const store = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });

  store.createIndex('status', 'status', { unique: false });
  store.createIndex('entryType', 'entryType', { unique: false });
  store.createIndex('type', 'type', { unique: false });
  store.createIndex('createdAt', 'createdAt', { unique: false });

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

export function toPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}
