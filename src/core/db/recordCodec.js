import { decryptData, encryptData, isEncryptionReady } from '@core/crypto/cipher';

/**
 * The boundary between stored records and transaction objects.
 *
 * Keeping encryption here means the repositories deal only in domain
 * objects, and the rule about which fields stay plaintext is stated in one
 * place instead of being re-implemented at each write site.
 */

/** Fields kept plaintext so they can be indexed and queried without a key. */
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

/**
 * Decrypts a record back into a transaction.
 *
 * A record that fails to decrypt is returned as CORRUPTED rather than
 * throwing, so one damaged row cannot take down the whole transaction list.
 * Callers that must not act on unreadable data filter on this status.
 */
export async function decodeRecord(record) {
  if (!record) return null;

  try {
    const payload = await decryptData(record.data, record.iv);

    return {
      ...payload,
      // Metadata may have been updated without re-encrypting the blob, so
      // the plaintext columns win over whatever the payload captured.
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