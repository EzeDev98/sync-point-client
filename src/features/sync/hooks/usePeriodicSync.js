import { useEffect } from 'react';
import { getPendingCount } from '@core/db/transactionRepository';
import { getIsOnline } from '@core/network/networkService';
import { syncPendingTransactionsGuarded } from '@features/sync/services/syncService';

/** How often to attempt a background sync. */
const SYNC_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Periodically drains the pending transaction queue.
 *
 * When the device is offline and transactions are waiting, the caller is
 * notified instead so it can nudge the user — an unsynced queue eventually
 * blocks new transactions, so silence is the wrong behaviour.
 */
export function usePeriodicSync({ onOfflineReminder }) {
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (!localStorage.getItem('walletId')) return;

      const pendingCount = await getPendingCount();
      if (pendingCount === 0) return;

      if (getIsOnline()) {
        try {
          await syncPendingTransactionsGuarded();
        } catch (err) {
          console.warn('[usePeriodicSync] Sync failed:', err.message);
        }
      } else if (!cancelled) {
        onOfflineReminder(pendingCount);
      }
    }

    const intervalId = setInterval(tick, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [onOfflineReminder]);
}