// Sends locally recorded transactions to the server.
import { http } from '@core/http/httpClient';

export function syncTransaction(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return Promise.resolve({ success: true, message: 'No transactions to sync.' });
  }

  return http.post('/wallet/sync-transaction', transactions, {
    auth: true,
    fallback: `Sync failed for ${transactions.length} transaction(s).`,
  });
}
