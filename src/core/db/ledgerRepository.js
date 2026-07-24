import { saveTransaction } from './transactionRepository.js';

/**
 * Balance-affecting entries that are not peer-to-peer transfers — funding
 * the offline wallet, and moving value back to the online account.
 *
 * These share the transactions store; the separation is by meaning, not by
 * storage. Keeping it in its own module makes the "already settled" rule
 * below explicit rather than a conditional buried in a generic save.
 */

const ENTRY_TYPES = ['CREDIT', 'DEBIT'];

/**
 * Types the server has already confirmed over their own endpoints by the
 * time this is called.
 *
 * FundWallet only writes the ledger entry after fundOfflineWallet() or
 * transferToOnline() has returned successfully, so there is nothing left for
 * the peer-to-peer sync queue to push. Marking them synced on write keeps
 * them out of the pending queue and stops the dashboard from showing
 * "Pending sync" for a transaction the server already has.
 */
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