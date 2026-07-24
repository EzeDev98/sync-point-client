import { getIsOnline, isNetworkFailure } from '@core/network/networkService';
import {
  getPendingCount,
  getPendingTransactions,
  markTransactionFailed,
  markTransactionSynced,
} from '@core/db/transactionRepository';
import { syncTransaction } from '@features/sync/api/syncApi';
import { calculateOfflineBalance } from '@features/wallet/services/walletLedger';
import { registerBackgroundSync } from './backgroundSync.js';

/**
 * Pushes locally recorded transactions to the server.
 *
 * Sent in small chunks so a failure costs at most a few transactions rather
 * than the whole queue, and so a large backlog cannot produce one enormous
 * request that times out and never succeeds.
 */

const CHUNK_SIZE = 3;

let isSyncing = false;
let activeOnlineHandler = null;

/** Only the fields the server accepts — decrypted locals are not sent. */
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
      await syncTransaction(batch.map(toSyncPayload));

      for (const transaction of batch) {
        await markTransactionSynced(transaction.transactionRef);
        synced += 1;
        report(transaction.transactionRef);
      }
    } catch (err) {
      console.error('[syncService] Chunk failed:', err.message);

      // A transport failure says nothing about whether the server accepted
      // the batch, so nothing is marked and the run stops. Everything
      // already synced stays synced and is never resent; the remainder is
      // picked up by the next attempt. Marking these failed instead would
      // strand them permanently, since failed records are not retried.
      if (isNetworkFailure(err)) {
        return {
          total: pending.length,
          synced,
          failed: 0,
          networkError: true,
          message:
            synced > 0
              ? `${synced} synced before the connection dropped — the rest will retry automatically.`
              : 'Connection issue — will retry automatically.',
        };
      }

      // A genuine server rejection. Only this chunk is affected.
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

/**
 * Runs a sync unless one is already in flight.
 *
 * Concurrent runs would read the same pending queue and send every
 * transaction twice, so every entry point that can fire unattended — the
 * online listener, the periodic timer — goes through here.
 */
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

/**
 * Syncs whenever connectivity returns.
 *
 * Only one handler is ever registered: an earlier version added a listener
 * per unlock, so a user who locked and unlocked repeatedly accumulated
 * handlers that all fired on the same event.
 */
export function startAutoSync(onSyncComplete) {
  stopAutoSync();

  async function handleOnline() {
    if ((await getPendingCount()) === 0) return;

    try {
      const result = await syncPendingTransactionsGuarded();
      console.log('[syncService] Auto sync result:', result);
      onSyncComplete?.(result);
    } catch (err) {
      // A failure while going offline again is expected, not worth reporting.
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