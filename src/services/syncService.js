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

  let synced = 0;
  let failed = 0;

  for (const transaction of pending) {
    // Fix issue #13: skip CORRUPTED records — they cannot be sent to the
    // server and would produce a meaningless API error. Leave them for
    // manual investigation.
    if (transaction.status === "CORRUPTED") {
      console.warn(
        `[SyncService] Skipping corrupted transaction: ${transaction.transactionRef}`
      );
      failed++;
      continue;
    }

    try {
      // Send the full decrypted transaction payload to the server.
      //
      // - type:           "TRANSFER" (business classification)
      // - entryType:      "DEBIT"|"CREDIT" (local ledger perspective,
      //                   server validates but derives its own entries)
      // - requestRef:     included so server can reconcile the two devices'
      //                   records for the same transfer (fix issue #14)
      await syncTransaction({
        transactionRef: transaction.transactionRef,
        requestRef: transaction.requestRef,           // added — needed for reconciliation
        type: transaction.type,                       // "TRANSFER"
        entryType: transaction.entryType,             // "DEBIT" | "CREDIT"
        status: transaction.status,                   // "PENDING" | "SUCCESS"
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
      });

      await markTransactionSynced(transaction.transactionRef);
      synced++;

      if (onProgress) {
        onProgress({
          current: synced + failed,
          total: pending.length,
          synced,
          failed,
          lastRef: transaction.transactionRef,
        });
      }
    } catch (err) {
      console.error(
        `[SyncService] Failed to sync ${transaction.transactionRef}:`,
        err.message
      );
      await markTransactionFailed(transaction.transactionRef, err.message);
      failed++;
    }
  }

  // Refresh local balance from server after sync
  const walletId = sessionStorage.getItem("walletId");
  if (walletId) {
    try {
      const updatedBalance = await fetchUpdatedBalance(walletId);
      sessionStorage.setItem("offlineBalance", updatedBalance.toString());
      window.dispatchEvent(
        new CustomEvent("balance-updated", { detail: { balance: updatedBalance } })
      );
    } catch (err) {
      console.error("[SyncService] Balance refresh failed:", err.message);
    }
  }

  return {
    total: pending.length,
    synced,
    failed,
    message:
      failed === 0
        ? `All ${synced} transaction(s) synced successfully.`
        : `${synced} synced, ${failed} failed. Please retry.`,
  };
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
      console.error("[SyncService] Auto sync failed:", err.message);
    }
  }

  registerBackgroundSync();
  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}