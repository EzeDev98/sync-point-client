// ============================================
// SYNC SERVICE — SyncPoint
// Handles manual and auto sync of offline
// transactions to the server
// ============================================

import {
  getPendingTransactions,
  markTransactionSynced,
  markTransactionFailed,
  getPendingCount,
} from "./indexedDbService";
import { syncTransaction, fetchUpdatedBalance } from "./api";
import { calculateOfflineBalance } from "./walletLedger";
import { getIsOnline } from "./networkService";

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

  const validTransactions = pending.filter(transaction => transaction.status !== "CORRUPTED");
  const corruptedCount = pending.length - validTransactions.length;

  if (validTransactions.length === 0) {
    return {
      total: pending.length,
      synced: 0,
      failed: corruptedCount,
      message: `${corruptedCount} corrupted transaction(s) skipped`,
    };
  }

  try {

    const payload = validTransactions.map(transaction => ({
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

      await syncTransactions(payload);

      let synced = 0;
      for (const transaction of validTransactions) {
        await markTransactionSynced(transaction.transactionRef);
        synced++;
        if (onProgress) {
          onProgress({
            current: synced,
            total: validTransactions.length,
            synced,
            failed: 0,
            lastRef: transaction.transactionRef,
          });
        }
      }

      const walletId = localStorage.getItem("walletId") || sessionStorage.getItem("walletId");
      if (walletId && getIsOnline()) {
        try {
          await fetchUpdatedBalance(walletId);
          const ledgerBalance = await calculateOfflineBalance();
          window.dispatchEvent(
            new CustomEvent("balance-updated", { detail: { balance: ledgerBalance } })
          );
        } catch (err) {
          if (getIsOnline()) {
            console.error("[SyncService] Balance refresh failed:", err.message);
          }
        }
      }

      return {
        total: pending.length,
        synced,
        failed: corruptedCount,
        message: `All ${synced} transaction(s) synced successfully.${corruptedCount > 0 ? ` ${corruptedCount} corrupted skipped.` : ""}`,
      };

  } catch (err) {
    console.error("[SyncService] Batch sync failed:", err.message);

    let failed = 0;
    for (const transaction of validTransactions) {
      await markTransactionFailed(transaction.transactionRef, err.message);
      failed++;
      if (onProgress) {
        onProgress({
          current: failed,
          total: validTransactions.length,
          synced: 0,
          failed,
          lastRef: transaction.transactionRef,
        });
      }
    }

    return {
      total: pending.length,
      synced: 0,
      failed: failed + corruptedCount,
      message: `Sync failed: ${err.message}`,
    };
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
  async function handleOnline() {
    console.log("[SyncService] Device online — starting auto sync...");
    const count = await getPendingCount();
    if (count === 0) return;

    try {
      const result = await syncPendingTransactions();
      console.log("[SyncService] Auto sync result:", result);
      if (onSyncComplete) onSyncComplete(result);
    } catch (err) {
      if (getIsOnline()) {
        console.error("[SyncService] Auto sync failed:", err.message);
      }
    }
  }

  registerBackgroundSync();
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}