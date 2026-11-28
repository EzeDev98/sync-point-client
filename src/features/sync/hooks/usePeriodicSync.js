// Runs a background sync on a fixed interval.
import { useEffect } from 'react';
import { getPendingCount } from '@core/db/transactionRepository';
import { getIsOnline } from '@core/network/networkService';
import { syncPendingTransactionsGuarded } from '@features/sync/services/syncService';

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

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
