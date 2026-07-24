import { withTransactions } from './database.js';

/**
 * Raw record access for quarantine and restore.
 *
 * Everything here works on records exactly as stored — still encrypted, no
 * key required. That is the point: quarantine has to preserve a user's
 * pending transactions at moments when the key is precisely what is
 * unavailable, such as an expired refresh token or a sign-in as a different
 * user on a shared device.
 */

export async function getAllRawRecords() {
  return withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });
}

/**
 * Writes records back as-is.
 *
 * Uses put(), unlike saveTransaction's add(): these records already existed
 * and are being returned to the store, so overwriting is the intended
 * behaviour rather than a duplicate to reject.
 */
export async function restoreRawRecords(records) {
  if (!records || records.length === 0) return 0;

  return withTransactions('readwrite', (store, setResult) => {
    for (const record of records) {
      store.put(record);
    }

    setResult(records.length);
  });
}