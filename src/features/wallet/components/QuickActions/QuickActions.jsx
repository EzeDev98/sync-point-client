import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import styles from './QuickActions.module.css';

/**
 * The four-up action grid.
 *
 * Each button was previously written out longhand with its own icon wrapper
 * and label markup; they are now generated from a single list.
 */
function QuickActions({ onSend, onReceive, onFund, onSync, isSyncing = false, isOffline = false }) {
  const actions = [
    { key: 'send', label: 'Send', Icon: ArrowUpRight, onClick: onSend },
    { key: 'receive', label: 'Receive', Icon: ArrowDownLeft, onClick: onReceive },
    { key: 'fund', label: 'Fund', Icon: Plus, onClick: onFund, needsNetwork: true },
    {
      key: 'sync',
      label: isSyncing ? 'Syncing' : 'Sync',
      Icon: RefreshCw,
      onClick: onSync,
      needsNetwork: true,
      disabled: isSyncing,
      spinning: isSyncing,
    },
  ];

  return (
    <div className={styles.grid}>
      {actions.map(({ key, label, Icon, onClick, needsNetwork, disabled, spinning }) => (
        <button
          type="button"
          key={key}
          className={styles.action}
          onClick={onClick}
          disabled={disabled}
        >
          <div
            className={[styles.icon, needsNetwork && isOffline ? styles.iconOffline : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className={spinning ? styles.spin : undefined}>
              <Icon size={18} strokeWidth={1.8} />
            </span>
          </div>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;