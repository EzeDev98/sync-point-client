import { getAllTransactions } from '@core/db/transactionRepository';

/**
 * The offline balance is never stored — it is always derived by summing the
 * transaction ledger.
 *
 * That is the whole point: a stored balance and a stored ledger can
 * disagree, and on a device that spends offline the ledger is the record
 * that matters. No component should do its own balance arithmetic.
 */

/**
 * Statuses that count toward the balance.
 *
 * SYNCED is included — a synced transaction still happened. CORRUPTED and
 * FAILED are excluded: one is unreadable, the other was rejected by the
 * server (the money returns to the sender), and counting either would
 * misstate spendable funds.
 */
const COUNTABLE_STATUSES = new Set(['PENDING', 'SUCCESS', 'SYNCED']);

/**
 * A received P2P transfer CREDIT that has synced has been settled to the
 * receiver's ONLINE mirror balance on the server (Model B), so it is no
 * longer offline money — leaving it in the offline sum as well would count
 * the same naira twice, once offline and once online.
 *
 * This applies only to peer transfers (`type === 'TRANSFER'`). Funding
 * credits (type FUND / TRANSFER_TO_ONLINE) represent value loaded onto the
 * device and always count until it is spent or transferred back; sent DEBITs
 * always count too, synced or not, because that money genuinely left the
 * device.
 */
function isSettledToOnlineMirror(transaction) {
  return (
    transaction.entryType === 'CREDIT' &&
    transaction.type === 'TRANSFER' &&
    transaction.status === 'SYNCED'
  );
}

export async function calculateOfflineBalance() {
  const transactions = await getAllTransactions();

  let balance = 0;

  for (const transaction of transactions) {
    if (!COUNTABLE_STATUSES.has(transaction.status)) continue;
    if (isSettledToOnlineMirror(transaction)) continue;

    const amount = Number(transaction.amount) || 0;

    if (transaction.entryType === 'CREDIT') {
      balance += amount;
    } else if (transaction.entryType === 'DEBIT') {
      balance -= amount;
    }
  }

  // A negative balance means the ledger is inconsistent. Clamping here keeps
  // a display bug from becoming a spendable-funds bug.
  return Math.max(0, balance);
}

/**
 * Balance available to spend.
 *
 * Identical to the offline balance today. It exists separately so that
 * holds or reserved amounts can be introduced in one place later rather
 * than at every call site.
 */
export function calculateAvailableBalance() {
  return calculateOfflineBalance();
}

/** Totals by direction and type, for summaries. */
export async function summariseLedger() {
  const transactions = await getAllTransactions();

  const summary = { totalCredits: 0, totalDebits: 0, balance: 0, byType: {} };

  for (const transaction of transactions) {
    if (!COUNTABLE_STATUSES.has(transaction.status)) continue;

    const amount = Number(transaction.amount) || 0;
    const type = transaction.type || 'UNKNOWN';

    summary.byType[type] ??= { credits: 0, debits: 0 };

    if (transaction.entryType === 'CREDIT') {
      summary.totalCredits += amount;
      summary.byType[type].credits += amount;
    } else if (transaction.entryType === 'DEBIT') {
      summary.totalDebits += amount;
      summary.byType[type].debits += amount;
    }
  }

  summary.balance = Math.max(0, summary.totalCredits - summary.totalDebits);

  return summary;
}