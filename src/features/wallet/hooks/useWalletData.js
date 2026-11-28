// Loads the offline balance and transactions for the dashboard.
import { useCallback, useEffect, useState } from 'react';
import { getAllTransactions } from '@core/db/transactionRepository';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { getSyncBadgeCount, startAutoSync } from '@features/sync/services/syncService';
import { isEncryptionReady } from '@core/crypto/keyManager';

export const SESSION_EXPIRED = 'SESSION_EXPIRED';

export function useWalletData({ enabled = true } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [offlineBalance, setOfflineBalance] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const refresh = useCallback(async () => {
    if (!isEncryptionReady()) {
      throw new Error(SESSION_EXPIRED);
    }

    const [count, list, balance] = await Promise.all([
      getSyncBadgeCount(),
      getAllTransactions(),
      calculateOfflineBalance(),
    ]);

    setPendingCount(count);
    setTransactions(list);
    setOfflineBalance(balance);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        await refresh();
      } catch (err) {
        if (cancelled) return;
        console.error('[useWalletData] Failed to load:', err);
        setLoadError(err.message === SESSION_EXPIRED ? SESSION_EXPIRED : 'load');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    return startAutoSync(async (result) => {
      setSyncResult(result);
      try {
        await refresh();
      } catch (err) {
        console.error('[useWalletData] Post-sync refresh failed:', err);
      }
    });
  }, [enabled, refresh]);

  useEffect(() => {
    async function handleBalanceUpdate() {
      try {
        setOfflineBalance(await calculateOfflineBalance());
      } catch (err) {
        console.error('[useWalletData] Balance recalculation failed:', err);
      }
    }

    window.addEventListener('balance-updated', handleBalanceUpdate);
    return () => window.removeEventListener('balance-updated', handleBalanceUpdate);
  }, []);

  return {
    transactions,
    offlineBalance,
    pendingCount,
    isLoading,
    loadError,
    syncResult,
    setSyncResult,
    refresh,
  };
}
