// Syncs queued offline transactions to the server in small chunks.
import { getIsOnline, isNetworkFailure } from '@core/network/networkService';
import {
  getPendingCount,
  getPendingTransactions,
  markTransactionFailed,
  markTransactionRejected,
  markTransactionSynced,
} from '@core/db/transactionRepository';
import { syncTransaction } from '@features/sync/api/syncApi';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { registerBackgroundSync } from './backgroundSync.js';

const CHUNK_SIZE = 3;

let isSyncing = false;
let activeOnlineHandler = null;

function toSyncPayload(transaction) {
  return {
    transactionRef: transaction.transactionRef,
    requestRef: transaction.requestRef,
    type: transaction.type,
    entryType: transaction.entryType,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency || 'NGN',
    description: transaction.description,
    senderWalletId: transaction.senderWalletId,
    senderPhone: transaction.senderPhone,
    senderName: transaction.senderName,
    receiverWalletId: transaction.receiverWalletId,
    receiverPhone: transaction.receiverPhone,
    receiverName: transaction.receiverName,
    createdAt: transaction.createdAt,
    signature: transaction.signature,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function announceBalance() {
  if (!getIsOnline()) return;

  try {
    const balance = await calculateOfflineBalance();
    window.dispatchEvent(new CustomEvent('balance-updated', { detail: { balance } }));
  } catch (err) {
    console.error('[syncService] Balance refresh failed:', err.message);
  }
}

function rejectionsByRef(response) {
  const rejected = new Map();
  const failed = response?.data?.failedTransactions ?? [];
  for (const entry of failed) {
    rejected.set(entry.transactionReference, entry.failureReason || 'Rejected by the server.');
  }
  return rejected;
}

export async function syncPendingTransactions(onProgress) {
  const pending = await getPendingTransactions();

  if (pending.length === 0) {
    return { total: 0, synced: 0, failed: 0, message: 'Nothing to sync.' };
  }

  const sendable = pending.filter((transaction) => transaction.status !== 'CORRUPTED');
  const corruptedCount = pending.length - sendable.length;

  if (sendable.length === 0) {
    return {
      total: pending.length,
      synced: 0,
      failed: corruptedCount,
      message: `${corruptedCount} corrupted transaction(s) skipped.`,
    };
  }

  let synced = 0;
  let failed = 0;

  function report(lastRef) {
    onProgress?.({ current: synced + failed, total: sendable.length, synced, failed, lastRef });
  }

  for (const batch of chunk(sendable, CHUNK_SIZE)) {
    try {
      const response = await syncTransaction(batch.map(toSyncPayload));

      if (!response || typeof response !== 'object' || !response.data) {
        throw new Error('Malformed sync response — no data envelope.');
      }

      const rejected = rejectionsByRef(response);

      for (const transaction of batch) {
        if (rejected.has(transaction.transactionRef)) {
          await markTransactionRejected(transaction.transactionRef, rejected.get(transaction.transactionRef));
          failed += 1;
        } else {
          await markTransactionSynced(transaction.transactionRef);
          synced += 1;
        }
        report(transaction.transactionRef);
      }
    } catch (err) {
      console.error('[syncService] Chunk failed:', err.message);

      if (isNetworkFailure(err)) {
        return {
          total: pending.length,
          synced,
          failed,
          networkError: true,
          message:
            synced > 0
              ? `${synced} synced before the connection dropped — the rest will retry automatically.`
              : 'Connection issue — will retry automatically.',
        };
      }

      for (const transaction of batch) {
        await markTransactionFailed(transaction.transactionRef, err.message);
        failed += 1;
        report(transaction.transactionRef);
      }
    }
  }

  await announceBalance();

  return {
    total: pending.length,
    synced,
    failed: failed + corruptedCount,
    message:
      failed === 0
        ? `All ${synced} transaction(s) synced successfully.${
            corruptedCount > 0 ? ` ${corruptedCount} corrupted skipped.` : ''
          }`
        : `${synced} synced, ${failed} failed. Please retry.`,
  };
}

export async function syncPendingTransactionsGuarded(onProgress) {
  if (isSyncing) {
    console.log('[syncService] Sync already in progress — skipping.');
    return { total: 0, synced: 0, failed: 0, message: 'Sync already in progress.' };
  }

  isSyncing = true;

  try {
    return await syncPendingTransactions(onProgress);
  } finally {
    isSyncing = false;
  }
}

export function getSyncBadgeCount() {
  return getPendingCount();
}

export function startAutoSync(onSyncComplete) {
  stopAutoSync();

  async function handleOnline() {
    if ((await getPendingCount()) === 0) return;

    try {
      const result = await syncPendingTransactionsGuarded();
      console.log('[syncService] Auto sync result:', result);
      onSyncComplete?.(result);
    } catch (err) {
      if (getIsOnline()) {
        console.error('[syncService] Auto sync failed:', err.message);
      }
    }
  }

  registerBackgroundSync();

  activeOnlineHandler = handleOnline;
  window.addEventListener('online', handleOnline);

  return stopAutoSync;
}

export function stopAutoSync() {
  if (!activeOnlineHandler) return;

  window.removeEventListener('online', activeOnlineHandler);
  activeOnlineHandler = null;
}
