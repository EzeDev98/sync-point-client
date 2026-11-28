// Converts between encrypted stored records and transaction objects.
import { decryptData, encryptData, isEncryptionReady } from '@core/crypto/cipher';

export function toRecord(transaction, { iv, data }) {
  return {
    id: transaction.transactionRef,
    iv,
    data,
    status: transaction.status || 'PENDING',
    entryType: transaction.entryType,
    type: transaction.type,
    createdAt: transaction.createdAt || new Date().toISOString(),
    synced: transaction.synced === true,
    syncAttempts: 0,
    lastSyncError: null,
  };
}

export function requireEncryption() {
  if (!isEncryptionReady()) {
    throw new Error('Encryption is not ready. Please sign in again.');
  }
}

export async function encodeTransaction(transaction) {
  requireEncryption();

  if (!transaction.transactionRef) {
    throw new Error('transactionRef is required.');
  }

  const encrypted = await encryptData(transaction);
  return toRecord(transaction, encrypted);
}

export async function decodeRecord(record) {
  if (!record) return null;

  try {
    const payload = await decryptData(record.data, record.iv);

    return {
      ...payload,
      status: record.status,
      synced: record.synced,
      syncAttempts: record.syncAttempts || 0,
      lastSyncError: record.lastSyncError || null,
    };
  } catch (err) {
    console.error('[db] Decryption failed for record:', record.id, err);

    return {
      transactionRef: record.id,
      status: 'CORRUPTED',
      synced: record.synced,
      syncAttempts: record.syncAttempts || 0,
      error: 'Data corruption — could not decrypt',
    };
  }
}

export function decodeRecords(records) {
  return Promise.all(records.map(decodeRecord));
}
