// Reads and writes transaction records.
import { withTransactions } from './database.js';
import { decodeRecord, decodeRecords, encodeTransaction, requireEncryption } from './recordCodec.js';

export const TransactionStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  SYNCED: 'SYNCED',
  CORRUPTED: 'CORRUPTED',
  FAILED: 'FAILED',
};

export async function saveTransaction(transaction) {
  const record = await encodeTransaction(transaction);

  await withTransactions('readwrite', (store) => {
    store.add(record);
  });

  return record;
}

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

export function markTransactionRejected(transactionRef, reason) {
  return updateTransactionStatus(transactionRef, TransactionStatus.FAILED, {
    synced: true,
    lastSyncError: reason || 'Rejected by the server.',
    syncedAt: new Date().toISOString(),
  });
}

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

export async function getPendingCount() {
  const records = await withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });

  return records.filter((record) => record.synced === false && record.type === 'TRANSFER')
    .length;
}

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

export async function clearAllTransactions() {
  await withTransactions('readwrite', (store) => {
    store.clear();
  });

  return true;
}
