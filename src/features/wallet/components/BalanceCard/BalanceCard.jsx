import { Eye, EyeOff } from 'lucide-react';
import { formatNaira } from '@shared/utils';
import styles from './BalanceCard.module.css';

/**
 * Available balance plus the sync-state badge.
 *
 * The badge previously repeated the same three-way ternary twice — once for
 * its own class, once for the dot's — then a third time for the label. That
 * is now resolved once into a single `status` value.
 */

function resolveSyncStatus({ isSyncing, failedCount }) {
  if (failedCount > 0) return 'error';
  if (isSyncing) return 'pending';
  return 'ok';
}

function getSyncLabel({ status, pendingCount }) {
  if (status === 'error') return 'Sync failed';
  if (status === 'pending') return 'Syncing transactions...';
  if (pendingCount > 0) {
    return `${pendingCount} transaction${pendingCount === 1 ? '' : 's'} waiting`;
  }
  return 'All transactions synced';
}

function BalanceCard({
  balance,
  isVisible,
  onToggleVisibility,
  isSyncing = false,
  pendingCount = 0,
  syncResult = null,
}) {
  const status = resolveSyncStatus({ isSyncing, failedCount: syncResult?.failed ?? 0 });

  const badgeClassNames = [styles.syncBadge, styles[status]].join(' ');
  const dotClassNames = [styles.syncDot, styles[status]].join(' ');

  return (
    <section className={styles.card}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <span className={styles.label}>Available balance</span>

          <div className={styles.amountRow}>
            <div className={[styles.amount, isVisible ? '' : styles.amountHidden].join(' ')}>
              {isVisible ? formatNaira(balance) : '*****'}
            </div>

            <button
              type="button"
              className={styles.eyeButton}
              onClick={onToggleVisibility}
              aria-label={isVisible ? 'Hide balance' : 'Show balance'}
              aria-pressed={isVisible}
            >
              {isVisible ? (
                <Eye size={16} strokeWidth={1.8} />
              ) : (
                <EyeOff size={16} strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>

        <div className={styles.divider} aria-hidden="true" />

        <div className={styles.right}>
          <span className={styles.sub}>Wallet · Last updated just now</span>

          <div className={badgeClassNames} role="status">
            <span className={dotClassNames} aria-hidden="true" />
            <span className={styles.syncText}>{getSyncLabel({ status, pendingCount })}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BalanceCard;