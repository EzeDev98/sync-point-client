import { getIsOnline } from '@core/network/networkService';
import { clearAllTransactions, getPendingCount } from '@core/db/transactionRepository';
import { logoutUser } from '@features/auth/api/authApi';
import { clearAuthSession } from '@features/auth/services/sessionManager';
import { clearSigningKey } from '@features/wallet/services/signingKeyService';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { syncPendingTransactions } from '@features/sync/services/syncService';

/**
 * The only permitted way to sign out.
 *
 * Signing out clears the wrapped encryption key, which makes every local
 * record permanently unreadable. So it is gated on the device holding
 * nothing of value: no offline balance, and no unsynced transactions. No
 * page may call clearAuthSession() or logoutUser() directly.
 */

async function readBlockers() {
  const [balance, pending] = await Promise.all([calculateOfflineBalance(), getPendingCount()]);
  return { balance, pending };
}

async function executeLogout(navigate) {
  await logoutUser();
  await clearAllTransactions();
  // Drop this device's signing identity too, so whoever signs in next enrolls
  // a fresh key rather than inheriting the previous user's. Safe here because
  // logout is already gated on there being nothing unsynced — no in-flight
  // transfer can be stranded by removing the key.
  await clearSigningKey();
  clearAuthSession();
  navigate('/login', { replace: true });
}

/**
 * @param navigate     React Router navigate
 * @param onBlocked    called with { balance } when funds remain
 * @param onSyncing    called when a pre-logout sync starts
 * @param onSyncDone   called with the sync result
 * @param onError      called with a message
 * @param onSuccess    called immediately before navigation
 */
export async function requestLogout({
  navigate,
  onBlocked,
  onSyncing,
  onSyncDone,
  onError,
  onSuccess,
}) {
  try {
    const { balance, pending } = await readBlockers();

    // Funds still on the device would be destroyed with the key.
    if (balance > 0) {
      onBlocked?.({ balance });
      return;
    }

    if (pending > 0) {
      if (!getIsOnline()) {
        onError?.(
          'You have unsynced transactions and no internet connection. Reconnect and try again before signing out.'
        );
        return;
      }

      onSyncing?.();

      let syncResult;
      try {
        syncResult = await syncPendingTransactions();
      } catch {
        onError?.('Sync failed. Please try again before signing out.');
        return;
      }

      onSyncDone?.(syncResult);

      if (syncResult.failed > 0) {
        onError?.(
          `${syncResult.failed} transaction(s) could not be synced. Please try again or contact support.`
        );
        return;
      }

      // Re-read rather than trusting the sync result. A concurrent write
      // could have landed while the sync was in flight, and signing out with
      // one unsynced record loses it for good.
      const after = await readBlockers();
      if (after.pending > 0 || after.balance > 0) {
        onError?.(
          'Some transactions are still unresolved. Signing out is blocked until everything is reconciled.'
        );
        return;
      }
    }

    onSuccess?.();
    await executeLogout(navigate);
  } catch (err) {
    console.error('[logoutManager] Unexpected error:', err);
    onError?.(err.message || 'An unexpected error occurred. Please try again.');
  }
}