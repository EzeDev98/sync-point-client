/**
 * Device signing-key storage.
 *
 * The wallet's offline-transfer signing keypair lives here, in its own tiny
 * IndexedDB database — deliberately separate from the encrypted transactions
 * store so a schema bump on one never risks the other, and so a hard reset
 * (which deletes every non-protected database) clears it along with
 * everything else.
 *
 * The private key is a non-extractable CryptoKey: it can sign but can never
 * be read back out of the browser, even by this code. It is still
 * structured-cloneable, so IndexedDB persists the CryptoKey object itself —
 * we never touch raw private-key bytes. The public key is stored alongside it
 * so its SPKI can be re-exported to (re-)register with the server without
 * regenerating the pair, and a `registered` flag records whether the server
 * has already accepted this device's public key.
 */

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

/**
 * Runs `work` in a store transaction and resolves on the transaction's
 * completion (not the request's success), so a write is only reported durable
 * once the surrounding transaction has actually committed.
 */
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

/** The stored record, or null. Shape: { id, privateKey, publicKey, registered }. */
export async function loadSigningKeyRecord() {
  const record = await runTx('readonly', (store) => store.get(RECORD_ID));
  return record ?? null;
}

/** Whether a usable private key is on this device. */
export async function hasSigningKey() {
  const record = await loadSigningKeyRecord();
  return record != null && record.privateKey != null;
}

/** Persists a freshly generated keypair (registered defaults to false). */
export async function saveSigningKeyRecord({ privateKey, publicKey, registered = false }) {
  await runTx('readwrite', (store) =>
    store.put({ id: RECORD_ID, privateKey, publicKey, registered })
  );
}

/** Marks the stored key as accepted by the server. No-op if none is stored. */
export async function markSigningKeyRegistered() {
  const record = await loadSigningKeyRecord();
  if (!record) return;
  record.registered = true;
  await runTx('readwrite', (store) => store.put(record));
}

/** Removes the device signing key. Best-effort — never throws. */
export async function clearSigningKey() {
  try {
    await runTx('readwrite', (store) => store.delete(RECORD_ID));
  } catch (err) {
    console.warn('[signingKeyStore] Failed to clear signing key:', err);
  }
}