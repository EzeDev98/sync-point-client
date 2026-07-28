/**
 * Presentation helpers for transaction rows.
 * Extracted from the top of Dashboard.jsx, where they sat as loose functions
 * above the component.
 */

export const EntryType = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
};

export function getTransactionIcon(entryType) {
  if (entryType === EntryType.DEBIT) return '↗';
  if (entryType === EntryType.CREDIT) return '↙';
  return '•';
}

export function getTransactionLabel(transaction) {
  if (transaction.entryType === EntryType.DEBIT) {
    return transaction.receiverName ? `Sent to ${transaction.receiverName}` : 'Sent payment';
  }
  if (transaction.entryType === EntryType.CREDIT) {
    return transaction.senderName
      ? `Received from ${transaction.senderName}`
      : 'Payment received';
  }
  return 'Transaction';
}

export function getTransactionStatusLabel(transaction) {
  if (transaction.status === 'CORRUPTED') return 'Unreadable';
  if (!transaction.synced) return 'Pending sync';
  if (transaction.type === 'FUND') return 'Wallet topped up';
  if (transaction.type === 'TRANSFER_TO_ONLINE') return 'Moved to online';
  return 'Synced';
}