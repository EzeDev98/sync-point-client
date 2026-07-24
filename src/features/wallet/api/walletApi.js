import { http } from '@core/http/httpClient';
import { requirePhoneNumber } from '@features/auth/services/sessionManager';

/** Moving value between the online account and the offline wallet. */

/**
 * requestRef makes these idempotent: the caller keeps the same reference
 * across retries so a request that times out after the server processed it
 * cannot be applied twice.
 */
export function fundOfflineWallet({ amount, description, transactionPin, requestRef }) {
  return http.post(
    '/wallet/funding/offline',
    { phoneNumber: requirePhoneNumber(), amount, description, transactionPin, requestRef },
    { auth: true, fallback: 'Failed to fund offline wallet.' }
  );
}

export function transferToOnline({ amount, description, transactionPin, requestRef }) {
  return http.post(
    '/wallet/transfer/online',
    { phoneNumber: requirePhoneNumber(), amount, description, transactionPin, requestRef },
    { auth: true, fallback: 'Failed to transfer to online account.' }
  );
}