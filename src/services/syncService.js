// ============================================
// SYNC SERVICE — SyncPoint
// Handles manual and auto sync of offline
// transactions to the server
// ============================================

import { getPendingTransactions, markTransactionSynced, markTransactionFailed, getPendingCount, } from "./indexedDbService";
import { syncTransaction } from "./api";
import { calculateOfflineBalance } from "./walletLedger";
import { getIsOnline } from "./networkService";

let syncInProgress = false;
let activeOnlineHandler = null;
const SYNC_CHUNK_SIZE = 3;

/**
 * Sync all PENDING transactions to the server.
 *
 * getPendingTransactions() returns already-decrypted objects — the
 * indexedDbService layer handles decryption before returning.
 *
 * @param {function} [onProgress] — called after each transaction attempt
 * @returns {{ total, synced, failed, message }}
 */
export async function syncPendingTransactions(onProgress) {
  const pending = await getPendingTransactions();
 
  if (pending.length === 0) {
    return { total: 0, synced: 0, failed: 0, message: "Nothing to sync." };
  }
 
  const validTransactions = pending.filter((transaction) => transaction.status !== "CORRUPTED");
  const corruptedCount = pending.length - validTransactions.length;
 
  if (validTransactions.length === 0) {
    return {
      total: pending.length,
      synced: 0,
      failed: corruptedCount,
      message: `${corruptedCount} corrupted transaction(s) skipped`,
    };
  }
 
  const chunks = [];
  for (let i = 0; i < validTransactions.length; i += SYNC_CHUNK_SIZE) {
    chunks.push(validTransactions.slice(i, i + SYNC_CHUNK_SIZE));
  }
 
  let synced = 0;
  let failed = 0;
 
  for (const chunk of chunks) {
    const payload = chunk.map((transaction) => ({
      transactionRef: transaction.transactionRef,
      requestRef: transaction.requestRef,
      type: transaction.type,
      entryType: transaction.entryType,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency || "NGN",
      description: transaction.description,
      senderWalletId: transaction.senderWalletId,
      senderPhone: transaction.senderPhone,
      senderName: transaction.senderName,
      receiverWalletId: transaction.receiverWalletId,
      receiverPhone: transaction.receiverPhone,
      receiverName: transaction.receiverName,
      createdAt: transaction.createdAt,
    }));
 
    try {
      await syncTransaction(payload);
 
      for (const transaction of chunk) {
        await markTransactionSynced(transaction.transactionRef);
        synced++;
        if (onProgress) {
          onProgress({
            current: synced + failed,
            total: validTransactions.length,
            synced,
            failed,
            lastRef: transaction.transactionRef,
          });
        }
      }
    } catch (err) {
      console.error("[SyncService] Chunk sync failed:", err.message);
 
      if (isNetworkFailure(err)) {
        // Stop here. This chunk and every chunk after it stay untouched
        // (still unsynced) — we do not guess at partial success and we do
        // not keep hammering the backend mid-outage. Whatever already
        // synced above this point is safely marked and will never be
        // resent. The next sync attempt (manual or auto) picks up exactly
        // what's left, in fresh small chunks.
        return {
          total: pending.length,
          synced,
          failed: 0,
          networkError: true,
          message:
            synced > 0
              ? `${synced} synced before the connection dropped — will retry the rest automatically.`
              : "Connection issue — will retry automatically.",
        };
      }
 
      // A genuine server-side rejection — affects only this chunk.
      for (const transaction of chunk) {
        await markTransactionFailed(transaction.transactionRef, err.message);
        failed++;
        if (onProgress) {
          onProgress({
            current: synced + failed,
            total: validTransactions.length,
            synced,
            failed,
            lastRef: transaction.transactionRef,
          });
        }
      }
    }
  }
 
  const walletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
  if (walletId && getIsOnline()) {
    try {
      const ledgerBalance = await calculateOfflineBalance();
      window.dispatchEvent(
        new CustomEvent("balance-updated", { detail: { balance: ledgerBalance } })
      );
    } catch (err) {
      console.error("[SyncService] Balance refresh failed:", err.message);
    }
  }
 
  return {
    total: pending.length,
    synced,
    failed: failed + corruptedCount,
    message:
      failed === 0
        ? `All ${synced} transaction(s) synced successfully.${corruptedCount > 0 ? ` ${corruptedCount} corrupted skipped.` : ""}`
        : `${synced} synced, ${failed} failed. Please retry.`,
  };
}

export async function syncPendingTransactionsGuarded(onProgress) {
  if (syncInProgress) {
    console.log("[SyncService] Sync already in progress — skipping.");
    return { total: 0, synced: 0, failed: 0, message: "Sync already in progress." };
  }
  syncInProgress = true;
  try {
    return await syncPendingTransactions(onProgress);
  } finally {
    syncInProgress = false;
  }
}

export function isOnline() {
  return navigator.onLine;
}

export async function getSyncBadgeCount() {
  return getPendingCount();
}

export async function registerBackgroundSync() {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) {
    console.log("[SyncService] Background sync not supported.");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("sync-transactions");
    console.log("[SyncService] Background sync registered.");
    return true;
  } catch (error) {
    console.error("[SyncService] Background sync registration failed:", error);
    return false;
  }
}

export async function getSyncTags() {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) {
    return [];
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.sync.getTags();
  } catch (error) {
    console.error("[SyncService] Failed to get sync tags:", error);
    return [];
  }
}

export function startAutoSync(onSyncComplete) {

  if (activeOnlineHandler) {
    window.removeEventListener("online", activeOnlineHandler);
    activeOnlineHandler = null;
  }

  async function handleOnline() {
    console.log("[SyncService] Device online — starting auto sync...");
    const count = await getPendingCount();
    if (count === 0) return;

    try {
      const result = await syncPendingTransactionsGuarded();
      console.log("[SyncService] Auto sync result:", result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (err) {
      if (getIsOnline()) {
        console.error("[SyncService] Auto sync failed:", err.message);
      }
    }
  }

  registerBackgroundSync();
  activeOnlineHandler = handleOnline;
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
    if (activeOnlineHandler === handleOnline) {
      activeOnlineHandler = null;
    }
  };
}

function isNetworkFailure(err) {
  return (
    !navigator.onLine || err instanceof TypeError || /failed to fetch|network|load failed/i.test(err?.message || "")
  );
}