// Signs out only when the device holds no unsynced transactions or offline funds.
import { getIsOnline } from '@core/network/networkService';
import { clearAllTransactions, getPendingCount } from '@core/db/transactionRepository';
import { logoutUser } from '@features/auth/api/authApi';
import { clearAuthSession } from '@features/auth/services/sessionManager';
import { clearSigningKey } from '@features/wallet/services/signingKeyService';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { syncPendingTransactions } from '@features/sync/services/syncService';

async function readBlockers() {
  const [balance, pending] = await Promise.all([calculateOfflineBalance(), getPendingCount()]);
  return { balance, pending };
}

async function executeLogout(navigate) {
  await logoutUser();
  await clearAllTransactions();
  await clearSigningKey();
  clearAuthSession();
  navigate('/login', { replace: true });
}

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
