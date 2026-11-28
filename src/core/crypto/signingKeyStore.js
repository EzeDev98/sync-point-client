// IndexedDB storage for the device's offline transfer signing key pair.
const DB_NAME = 'syncpoint_signing_keys';
const DB_VERSION = 1;
const STORE = 'keys';
const RECORD_ID = 'device';

let connectionPromise = null;

function openDb() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
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
      reject(event.target.error);
    };
  });

  return connectionPromise;
}

function runTx(mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        let result;
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);

        tx.oncomplete = () => resolve(result);
        tx.onerror = (event) => reject(event.target.error);
        tx.onabort = (event) =>
          reject(event.target.error ?? new Error('[signingKeyStore] Transaction aborted.'));

        try {
          const req = work(store);
          if (req) {
            req.onsuccess = () => {
              result = req.result;
            };
          }
        } catch (err) {
          tx.abort();
          reject(err);
        }
      })
  );
}

export async function loadSigningKeyRecord() {
  const record = await runTx('readonly', (store) => store.get(RECORD_ID));
  return record ?? null;
}

export async function hasSigningKey() {
  const record = await loadSigningKeyRecord();
  return record != null && record.privateKey != null;
}

export async function saveSigningKeyRecord({ privateKey, publicKey, registered = false }) {
  await runTx('readwrite', (store) =>
    store.put({ id: RECORD_ID, privateKey, publicKey, registered })
  );
}

export async function markSigningKeyRegistered() {
  const record = await loadSigningKeyRecord();
  if (!record) return;
  record.registered = true;
  await runTx('readwrite', (store) => store.put(record));
}

export async function clearSigningKey() {
  try {
    await runTx('readwrite', (store) => store.delete(RECORD_ID));
  } catch (err) {
    console.warn('[signingKeyStore] Failed to clear signing key:', err);
  }
}
