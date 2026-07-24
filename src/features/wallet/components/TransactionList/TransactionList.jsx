import { EmptyState } from '@shared/components/ui';
import { formatEntryAmount, formatShortDateTime } from '@shared/utils';
import {
  EntryType,
  getTransactionIcon,
  getTransactionLabel,
  getTransactionStatusLabel,
} from '@features/wallet/utils/transactionDisplay';
import styles from './TransactionList.module.css';

/**
 * Scrollable transaction list, including its loading, error and empty states.
 *
 * Those three states were previously three sibling divs in Dashboard, each
 * with the same inline style object and differing only in colour.
 */
function TransactionList({ transactions = [], isLoading = false, error = '' }) {
  if (isLoading) {
    return <EmptyState>Loading transactions...</EmptyState>;
  }

  if (error) {
    return <EmptyState tone="error">{error}</EmptyState>;
  }

  if (transactions.length === 0) {
    return <EmptyState>No transactions yet</EmptyState>;
  }

  return (
    <ul className={styles.list}>
      {transactions.map((transaction) => {
        const isCredit = transaction.entryType === EntryType.CREDIT;

        return (
          <li className={styles.item} key={transaction.transactionRef}>
            <div
              className={[styles.icon, isCredit ? styles.iconReceive : styles.iconSend].join(' ')}
              aria-hidden="true"
            >
              {getTransactionIcon(transaction.entryType)}
            </div>

            <div className={styles.info}>
              <div className={styles.name}>{getTransactionLabel(transaction)}</div>
              <div className={styles.time}>{formatShortDateTime(transaction.createdAt)}</div>
            </div>

            <div className={styles.right}>
              <div
                className={[styles.amount, isCredit ? styles.credit : styles.debit].join(' ')}
              >
                {formatEntryAmount(transaction.amount, transaction.entryType)}
              </div>
              <div
                className={[styles.status, transaction.synced ? '' : styles.statusPending]
                  .filter(Boolean)
                  .join(' ')}
              >
                {getTransactionStatusLabel(transaction)}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default TransactionList;