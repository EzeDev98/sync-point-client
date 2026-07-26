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

/**
 * Only the fields the server accepts — decrypted locals are not sent.
 *
 * `signature` is the sender's authorization of this exact transfer. It MUST
 * be forwarded or the server cannot verify the transfer and will reject it,
 * so a transfer stored before signatures existed (no signature) will be
 * rejected on sync rather than silently accepted.
 */
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

/**
 * Builds the set of transactionRefs the server rejected in this batch, keyed
 * to the reason it gave.
 *
 * The server answers 200 even when it refuses individual transfers — the
 * refused ones are listed in `data.failedTransactions`. Everything else in
 * the batch was either newly settled or already processed; both mean the
 * server holds it. So the rule is: rejected ⇒ terminal fail, everything else
 * ⇒ synced. (The idempotent "all already processed" response simply carries
 * no failedTransactions, so every ref falls through to synced.)
 */
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

      // A processed batch always comes back with a data envelope. Its absence
      // means we cannot trust the per-transaction outcome, so treat it like a
      // transport failure below and leave the whole batch to retry rather than
      // guess that it succeeded.
      if (!response || typeof response !== 'object' || !response.data) {
        throw new Error('Malformed sync response — no data envelope.');
      }

      const rejected = rejectionsByRef(response);

      for (const transaction of batch) {
        if (rejected.has(transaction.transactionRef)) {
          // The server received it and refused this transfer specifically
          // (e.g. invalid signature). Terminal — money returns to the offline
          // balance and it will not be retried.
          await markTransactionRejected(transaction.transactionRef, rejected.get(transaction.transactionRef));
          failed += 1;
        } else {
          // Newly settled or already processed — either way the server has it.
          await markTransactionSynced(transaction.transactionRef);
          synced += 1;
        }
        report(transaction.transactionRef);
      }
    } catch (err) {
      console.error('[syncService] Chunk failed:', err.message);

      // A transport failure (or an uninterpretable response) says nothing
      // about whether the server accepted the batch, so nothing is settled and
      // the run stops. Everything already synced stays synced and is never
      // resent; the remainder is picked up by the next attempt.
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

      // Not a per-transaction verdict and not a network drop — record the
      // error but leave these records retryable (do NOT settle or terminally
      // fail on an outcome we never received). The next attempt resends them.
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