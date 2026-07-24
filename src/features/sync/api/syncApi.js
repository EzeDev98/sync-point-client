import { http } from '@core/http/httpClient';

/** Pushes locally recorded transactions to the server. */

export function syncTransaction(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    // Not an error — a sync pass with an empty queue is the normal case.
    return Promise.resolve({ success: true, message: 'No transactions to sync.' });
  }

  return http.post('/wallet/sync-transaction', transactions, {
    auth: true,
    fallback: `Sync failed for ${transactions.length} transaction(s).`,
  });
}