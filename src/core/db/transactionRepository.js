import { toPromise, withTransactions } from './database.js';
import { decodeRecord, decodeRecords, encodeTransaction, requireEncryption } from './recordCodec.js';

/** Reads and writes of transaction records. */

export const TransactionStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  SYNCED: 'SYNCED',
  CORRUPTED: 'CORRUPTED',
};

/**
 * Encrypts and stores a transaction.
 *
 * Uses add(), not put(): a duplicate transactionRef is a double-spend
 * attempt or a repeated scan, and must be rejected rather than overwrite
 * the existing record.
 */
export async function saveTransaction(transaction) {
  const record = await encodeTransaction(transaction);

  await withTransactions('readwrite', (store) => {
    store.add(record);
  });

  return record;
}

/** Updates plaintext metadata without touching the encrypted blob. */
export async function updateTransactionStatus(transactionRef, status, meta = {}) {
  return withTransactions('readwrite', (store, setResult) => {
    const request = store.get(transactionRef);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        throw new Error(`Transaction not found: ${transactionRef}`);
      }

      record.status = status;
      if (meta.synced !== undefined) record.synced = meta.synced;
      if (meta.syncAttempts !== undefined) record.syncAttempts = meta.syncAttempts;
      if (meta.lastSyncError !== undefined) record.lastSyncError = meta.lastSyncError;
      if (meta.syncedAt !== undefined) record.syncedAt = meta.syncedAt;

      store.put(record);
      setResult(record);
    };
  });
}

export function markTransactionSynced(transactionRef) {
  return updateTransactionStatus(transactionRef, TransactionStatus.SYNCED, {
    synced: true,
    syncedAt: new Date().toISOString(),
  });
}

/** Records a failed sync attempt, incrementing the retry counter. */
export async function markTransactionFailed(transactionRef, errorMessage) {
  return withTransactions('readwrite', (store, setResult) => {
    const request = store.get(transactionRef);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) {
        throw new Error(`Transaction not found: ${transactionRef}`);
      }

      record.syncAttempts = (record.syncAttempts || 0) + 1;
      record.lastSyncError = errorMessage || 'Sync failed';

      store.put(record);
      setResult(record);
    };
  });
}

/** All transactions, newest first. Requires an unlocked key. */
export async function getAllTransactions() {
  requireEncryption();

  const records = await withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });

  const decoded = await decodeRecords(records);
  decoded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return decoded;
}

export async function getTransactionByRef(transactionRef) {
  requireEncryption();

  const record = await withTransactions('readonly', (store, setResult) => {
    const request = store.get(transactionRef);
    request.onsuccess = () => setResult(request.result);
  });

  return decodeRecord(record);
}

/**
 * Counts unsynced transfers without decrypting anything.
 *
 * No key is required, which is the whole point: the PIN-reset gate has to
 * run on a cold start before the key exists, and an earlier version of this
 * delegated to a decrypting query and therefore always failed closed there.
 *
 * Reads every record and filters in JS because `synced` is a boolean, and
 * index.getAll(false) on a boolean key throws a DataError. type and synced
 * are plaintext columns, so no decryption is involved either way.
 */
export async function getPendingCount() {
  const records = await withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });

  return records.filter((record) => record.synced === false && record.type === 'TRANSFER')
    .length;
}

/** Unsynced transfers, decrypted, excluding anything unreadable. */
export async function getPendingTransactions() {
  requireEncryption();

  const records = await withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });

  const decoded = await decodeRecords(records);

  return decoded.filter(
    (transaction) =>
      transaction.status !== TransactionStatus.CORRUPTED &&
      transaction.type === 'TRANSFER' &&
      transaction.synced === false
  );
}

/** Synced records as stored — metadata only, no key required. */
export async function getSyncedTransactions() {
  const records = await withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });

  return records.filter((record) => record.synced === true);
}

export async function deleteTransaction(transactionRef) {
  await withTransactions('readwrite', (store) => {
    store.delete(transactionRef);
  });

  return true;
}

/**
 * Deletes every synced record.
 *
 * Read and delete now share one transaction. Previously the read ran in its
 * own transaction and the deletes in another, leaving a window in which a
 * record could be marked synced in between and then deleted without ever
 * having been read — or, worse, a record could be re-added under an id the
 * delete loop was still holding.
 */
export async function clearSyncedTransactions() {
  return withTransactions('readwrite', (store, setResult) => {
    const request = store.getAll();

    request.onsuccess = () => {
      const synced = request.result.filter((record) => record.synced === true);

      for (const record of synced) {
        store.delete(record.id);
      }

      setResult(synced.length);
    };
  });
}

/** Wipes the store. Development and hard-reset use only. */
export async function clearAllTransactions() {
  await withTransactions('readwrite', (store) => {
    store.clear();
  });

  return true;
}