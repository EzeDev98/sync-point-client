// Raw access to encrypted records for quarantine and restore.
import { withTransactions } from './database.js';

export async function getAllRawRecords() {
  return withTransactions('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result);
  });
}

export async function restoreRawRecords(records) {
  if (!records || records.length === 0) return 0;

  return withTransactions('readwrite', (store, setResult) => {
    for (const record of records) {
      store.put(record);
    }

    setResult(records.length);
  });
}
