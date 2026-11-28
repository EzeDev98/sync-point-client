// Derives the offline balance from the local transaction ledger.
import { getAllTransactions } from '@core/db/transactionRepository';

const COUNTABLE_STATUSES = new Set(['PENDING', 'SUCCESS', 'SYNCED']);

export async function calculateOfflineBalance() {
  const transactions = await getAllTransactions();

  let balance = 0;

  for (const transaction of transactions) {
    if (!COUNTABLE_STATUSES.has(transaction.status)) continue;

    const amount = Number(transaction.amount) || 0;

    if (transaction.entryType === 'CREDIT') {
      balance += amount;
    } else if (transaction.entryType === 'DEBIT') {
      balance -= amount;
    }
  }

  return Math.max(0, balance);
}

export function calculateAvailableBalance() {
  return calculateOfflineBalance();
}

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
