// ============================================
// WALLET LEDGER — SyncPoint
//
// The offline balance is NEVER stored directly.
// It is always derived from the transaction ledger in IndexedDB.
//
// Entry types that contribute to balance:
//   CREDIT  (+)  FUND, TRANSFER (receive side), TRANSFER_TO_ONLINE rollback
//   DEBIT   (-)  TRANSFER (send side), TRANSFER_TO_ONLINE
//
// Every screen that needs the current balance calls this module.
// No React component or page should perform its own balance arithmetic.
// ============================================

import { getAllTransactions, getPendingTransactions } from "./indexedDbService";

// ─────────────────────────────────────────────
// CORE BALANCE DERIVATION
// ─────────────────────────────────────────────

// ============================================
// WALLET LEDGER — SyncPoint
// Single source of truth for offline balance.
//
// Balance is always derived from the transaction
// ledger in IndexedDB — never stored directly.
//
// CREDIT transactions increase the balance.
// DEBIT transactions decrease the balance.
// CORRUPTED and FAILED records are excluded.
// ============================================

/**
 * Transaction types that affect the offline balance.
 * SYNCED transactions are included — they happened, they count.
 * CORRUPTED and FAILED are excluded — they are unresolvable or unsent.
 */
const COUNTABLE_STATUSES = new Set(["PENDING", "SUCCESS", "SYNCED"]);

/**
 * Calculate the current offline balance by summing the ledger.
 *
 * @returns {Promise<number>} — current offline balance in NGN
 */
export async function calculateOfflineBalance() {
  const transactions = await getAllTransactions();

  let balance = 0;

  for (const tx of transactions) {
    if (!COUNTABLE_STATUSES.has(tx.status)) continue;

    const amount = Number(tx.amount) || 0;

    if (tx.entryType === "CREDIT") {
      balance += amount;
    } else if (tx.entryType === "DEBIT") {
      balance -= amount;
    }
  }

  // Never return a negative balance — guards against data inconsistency
  return Math.max(0, balance);
}

/**
 * Derive the available balance — same as offline balance for now.
 *
 * This exists as a separate export so future logic (e.g. holds, reserved
 * amounts) can be layered in here without touching every call site.
 *
 * @returns {Promise<number>}
 */
export async function calculateAvailableBalance() {
  return calculateOfflineBalance();
}

// ─────────────────────────────────────────────
// SUMMARY / ANALYTICS
// ─────────────────────────────────────────────

/**
 * Return a breakdown of all transaction totals by type and direction.
 *
 * @returns {Promise<{
 *   totalCredits: number,
 *   totalDebits: number,
 *   balance: number,
 *   byType: Record<string, { credits: number, debits: number }>
 * }>}
 */
export async function getLedgerSummary() {
  const transactions = await getAllTransactions();

  let totalCredits = 0;
  let totalDebits = 0;
  const byType = {};

  for (const tx of transactions) {
    if (tx.status === "CORRUPTED") continue;

    const amount = Number(tx.amount) || 0;
    const type = tx.type || "UNKNOWN";

    if (!byType[type]) {
      byType[type] = { credits: 0, debits: 0 };
    }

    if (tx.entryType === "CREDIT") {
      totalCredits += amount;
      byType[type].credits += amount;
    } else if (tx.entryType === "DEBIT") {
      totalDebits += amount;
      byType[type].debits += amount;
    }
  }

  return {
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    balance: Math.max(0, Math.round((totalCredits - totalDebits) * 100) / 100),
    byType,
  };
}

/**
 * Return aggregated totals for pending-only transactions.
 * Useful for showing what is still unsynced.
 *
 * @returns {Promise<{ pendingCredits: number, pendingDebits: number, count: number }>}
 */
export async function getTransactionTotals() {
  const pending = await getPendingTransactions();

  let pendingCredits = 0;
  let pendingDebits = 0;

  for (const tx of pending) {
    if (tx.status === "CORRUPTED") continue;
    const amount = Number(tx.amount) || 0;
    if (tx.entryType === "CREDIT") pendingCredits += amount;
    else if (tx.entryType === "DEBIT") pendingDebits += amount;
  }

  return {
    pendingCredits: Math.round(pendingCredits * 100) / 100,
    pendingDebits: Math.round(pendingDebits * 100) / 100,
    count: pending.length,
  };
}

// ─────────────────────────────────────────────
// HELPERS FOR COMPONENTS
// ─────────────────────────────────────────────

/**
 * Recalculate balance and dispatch the "balance-updated" CustomEvent so
 * every listening component re-renders without needing a prop drill.
 *
 * Call this after any write to IndexedDB that affects the balance.
 *
 * @returns {Promise<number>} The newly calculated balance
 */
export async function recalculateAndBroadcast() {
  const balance = await calculateOfflineBalance();
  window.dispatchEvent(
    new CustomEvent("balance-updated", { detail: { balance } })
  );
  return balance;
}