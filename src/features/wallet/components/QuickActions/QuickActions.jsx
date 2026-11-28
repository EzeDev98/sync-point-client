// Dashboard grid of quick actions.
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw } from 'lucide-react';
import styles from './QuickActions.module.css';

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
              <Icon size={20} strokeWidth={1.9} />
            </span>
          </div>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActions;
