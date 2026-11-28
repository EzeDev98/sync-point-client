// Records offline wallet funding and withdrawals in the local ledger.
import { saveTransaction } from './transactionRepository.js';

const ENTRY_TYPES = ['CREDIT', 'DEBIT'];

const SERVER_CONFIRMED_TYPES = ['FUND', 'TRANSFER_TO_ONLINE'];

export function saveLedgerTransaction(transaction) {
  if (!transaction.transactionRef) {
    throw new Error('saveLedgerTransaction: transactionRef is required.');
  }

  if (!ENTRY_TYPES.includes(transaction.entryType)) {
    throw new Error('saveLedgerTransaction: entryType must be CREDIT or DEBIT.');
  }

  return saveTransaction({
    ...transaction,
    synced: SERVER_CONFIRMED_TYPES.includes(transaction.type) ? true : transaction.synced,
  });
}
