// ============================================
// LOGOUT MANAGER — SyncPoint
// Enforces financial integrity before logout.
//
// No page may call clearAuthSession() or logoutUser() directly.
// All logout attempts must pass through requestLogout().
// ============================================

import { getPendingCount } from "./indexedDbService";
import { syncPendingTransactions, isOnline } from "./syncService";
import { logoutUser } from "./api";
import { clearAuthSession } from "./sessionUtils";
import { clearAllTransactions } from "./indexedDbService";
import { calculateOfflineBalance } from "./walletLedger";

/**
 * The three conditions that must ALL be true before logout is allowed:
 *   1. offlineBalance === 0
 *   2. pendingTransactionCount === 0
 *   3. last sync either wasn't needed or completed successfully
 */
async function getLogoutBlockers() {
  const balance = await calculateOfflineBalance();
  const pending = await getPendingCount();

  return { balance, pending };
}

/**
 * Attempt to sync all pending transactions before logout.
 * Returns the sync result or throws if offline.
 */
async function forceSyncBeforeLogout() {
  if (!isOnline()) {
    throw new Error("OFFLINE");
  }
  return syncPendingTransactions();
}

/**
 * Perform the actual logout — API call, clear IndexedDB, clear session.
 */
async function executeLogout(navigate) {
  await logoutUser();
  await clearAllTransactions();
  clearAuthSession();
  navigate("/login", { replace: true });
}

/**
 * Main entry point. Call this from any page instead of logoutUser() directly.
 *
 * @param {object} options
 * @param {function} options.navigate          — React Router navigate fn
 * @param {function} options.onBlocked         — called when balance > 0;
 *                                               receives { balance } so the
 *                                               caller can redirect to /fund
 * @param {function} options.onSyncing         — called when sync starts
 * @param {function} options.onSyncDone        — called when sync finishes;
 *                                               receives the sync result
 * @param {function} options.onError           — called with an error message
 *                                               string when something fails
 * @param {function} options.onSuccess         — called just before navigate
 *                                               (optional, for UI cleanup)
 */
export async function requestLogout({
  navigate,
  onBlocked,
  onSyncing,
  onSyncDone,
  onError,
  onSuccess,
}) {
  try {
    const { balance, pending } = await getLogoutBlockers();

    // ── Rule 1: balance must be zero ──────────────────────────────────────
    if (balance > 0) {
      onBlocked?.({ balance });
      return;
    }

    // ── Rule 2 & 3: pending transactions must sync before logout ──────────
    if (pending > 0) {
      if (!isOnline()) {
        onError?.(
          "You have unsynced transactions and no internet connection. " +
          "Please reconnect and try again before logging out."
        );
        return;
      }

      onSyncing?.();

      let syncResult;
      try {
        syncResult = await forceSyncBeforeLogout();
      } catch (err) {
        if (err.message === "OFFLINE") {
          onError?.(
            "Connection lost during sync. Please reconnect and try again."
          );
        } else {
          onError?.("Sync failed. Please try again before logging out.");
        }
        return;
      }

      onSyncDone?.(syncResult);

      // Verify everything really is clean after sync
      if (syncResult.failed > 0) {
        onError?.(
          `${syncResult.failed} transaction(s) could not be synced. ` +
          "Please try again or contact support."
        );
        return;
      }

      // Double-check counts — guards against any edge case where
      // sync reported success but pending count is still non-zero
      const afterSync = await getLogoutBlockers();
      if (afterSync.pending > 0 || afterSync.balance > 0) {
        onError?.(
          "Some transactions are still unresolved. Logout is blocked until " +
          "all funds and transactions are reconciled."
        );
        return;
      }
    }

    // ── All clear — perform logout ────────────────────────────────────────
    onSuccess?.();
    await executeLogout(navigate);

  } catch (err) {
    console.error("[LogoutManager] Unexpected error:", err);
    onError?.(err.message || "An unexpected error occurred. Please try again.");
  }
}