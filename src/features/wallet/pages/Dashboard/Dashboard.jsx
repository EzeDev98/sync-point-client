import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Button, Modal } from '@shared/components/ui';
import { AppShell } from '@shared/components/layout';
import { AppLogo } from '@shared/components/branding';
import { NoInternetModal } from '@shared/components/feedback';
import { useNetwork } from '@shared/hooks/useNetwork';
import { formatNaira } from '@shared/utils';
import { requestLogout } from '@features/auth/services/logoutManager';
import { syncPendingTransactions } from '@features/sync/services/syncService';
import BalanceCard from '@features/wallet/components/BalanceCard/BalanceCard.jsx';
import NotificationBell from '@features/wallet/components/NotificationBell/NotificationBell.jsx';
import QuickActions from '@features/wallet/components/QuickActions/QuickActions.jsx';
import SettingsDrawer from '@features/wallet/components/SettingsDrawer/SettingsDrawer.jsx';
import TransactionList from '@features/wallet/components/TransactionList/TransactionList.jsx';
import { useNotifications } from '@features/wallet/hooks/useNotifications';
import { getInitials, readIdentity } from '@features/wallet/utils/identity';
import { SESSION_EXPIRED, useWalletData } from '@features/wallet/hooks/useWalletData';
import styles from './Dashboard.module.css';

/** Minimum time the sync spinner stays up, so a fast sync still reads as one. */
const MIN_SPIN_MS = 600;
const MAX_SYNC_RETRIES = 4;

/**
 * How many transactions the dashboard shows. Kept small on purpose so the
 * page never scrolls — the rest live on the full history page, reached via
 * "See all", which only appears once there are more than this to see.
 */
const DASHBOARD_TX_LIMIT = 3;

const LogoutStep = {
  IDLE: 'idle',
  CHECKING: 'checking',
  SYNCING: 'syncing',
  ERROR: 'error',
};

const LOGOUT_LABELS = {
  [LogoutStep.CHECKING]: 'Checking wallet...',
  [LogoutStep.SYNCING]: 'Syncing transactions...',
  [LogoutStep.ERROR]: 'Retry logout',
};

function Dashboard() {
  const navigate = useNavigate();
  const { isOffline } = useNetwork();

  const firstName = readIdentity('firstName', 'User');
  const walletId = readIdentity('walletId', null);
  const isSessionValid = Boolean(walletId);

  const initials = getInitials();

  const {
    transactions,
    offlineBalance,
    pendingCount,
    isLoading,
    loadError,
    syncResult,
    setSyncResult,
    refresh,
  } = useWalletData({ enabled: isSessionValid });

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showNoInternet, setShowNoInternet] = useState(false);

  const [logoutStep, setLogoutStep] = useState(LogoutStep.IDLE);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [blockedBalance, setBlockedBalance] = useState(null);

  useEffect(() => {
    if (!isSessionValid) {
      navigate('/login', { replace: true });
    }
  }, [isSessionValid, navigate]);

  // A locked wallet cannot decrypt anything — send the user back to unlock.
  useEffect(() => {
    if (loadError === SESSION_EXPIRED) {
      const timeoutId = setTimeout(() => navigate('/verifypin', { replace: true }), 800);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [loadError, navigate]);

  // The sync result is a transient confirmation — clear it a few seconds after
  // it appears so it does not sit on the dashboard indefinitely.
  useEffect(() => {
    if (syncResult && !isSyncing) {
      const timeoutId = setTimeout(() => setSyncResult(null), 5000);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [syncResult, isSyncing, setSyncResult]);

  function requireNetwork(action) {
    if (isOffline) {
      setShowNoInternet(true);
      return;
    }
    action();
  }

  async function handleSync() {
    if (isOffline) {
      setShowNoInternet(true);
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    const startedAt = Date.now();
    let result;

    // Retry only on network errors, backing off a little further each time.
    for (let attempt = 0; attempt <= MAX_SYNC_RETRIES; attempt += 1) {
      try {
        result = await syncPendingTransactions();
      } catch (err) {
        console.error('[Dashboard] Sync failed:', err);
        result = { message: 'Sync failed. Please try again.', failed: 1, synced: 0 };
        break;
      }

      if (!result.networkError) break;
      if (attempt === MAX_SYNC_RETRIES) break;

      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_SPIN_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed));
    }

    setSyncResult(result);

    try {
      await refresh();
    } catch (err) {
      console.error('[Dashboard] Post-sync refresh failed:', err);
    }

    setIsSyncing(false);
  }

  async function handleLogout() {
    if (isOffline) {
      setShowNoInternet(true);
      return;
    }

    setIsLoggingOut(true);
    setLogoutError('');
    setLogoutStep(LogoutStep.CHECKING);

    await requestLogout({
      navigate,

      onBlocked: ({ balance }) => {
        setIsSettingsOpen(false);
        setIsLoggingOut(false);
        setLogoutStep(LogoutStep.IDLE);
        setBlockedBalance(balance);
      },

      onSyncing: () => setLogoutStep(LogoutStep.SYNCING),
      onSyncDone: (result) => setSyncResult(result),

      onError: (message) => {
        setLogoutError(message);
        setLogoutStep(LogoutStep.ERROR);
        setIsLoggingOut(false);
      },

      onSuccess: () => setLogoutStep(LogoutStep.IDLE),
    });

    setIsLoggingOut(false);
  }

  if (!isSessionValid) return null;

  const listError =
    loadError === SESSION_EXPIRED
      ? 'Please re-enter your PIN to unlock your wallet.'
      : loadError
        ? 'Could not load your transactions.'
        : '';

  const recentTransactions = transactions.slice(0, DASHBOARD_TX_LIMIT);
  const hasMore = transactions.length > DASHBOARD_TX_LIMIT;

  return (
    <>
      <AppShell
        header={
          <>
            <div className={styles.brand}>
              <AppLogo size={28} />
              <span className={styles.brandText}>SyncPoint</span>
            </div>

            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />

            <div
              className={[
                styles.syncResult,
                syncResult && !isSyncing ? styles.syncResultOpen : '',
              ].join(' ')}
            >
              {syncResult && (
                <p
                  className={[
                    styles.syncResultMessage,
                    syncResult.failed > 0 ? styles.syncResultError : styles.syncResultSuccess,
                  ].join(' ')}
                >
                  {syncResult.message}
                </p>
              )}
            </div>
          </>
        }

        footer={
          <button
            type="button"
            className={styles.settingsTrigger}
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={16} />
            Settings
          </button>
        }
      >
        <div className={styles.greeting}>
          <div className={styles.avatar} aria-hidden="true">
            {initials}
          </div>
          <h2 className={styles.greetingText}>Hi, {firstName.toUpperCase()}</h2>
        </div>

        <BalanceCard
          balance={offlineBalance}
          isVisible={isBalanceVisible}
          onToggleVisibility={() => setIsBalanceVisible((current) => !current)}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          syncResult={syncResult}
        />

        <QuickActions
          isOffline={isOffline}
          isSyncing={isSyncing}
          onSend={() => navigate('/send')}
          onReceive={() => navigate('/receive')}
          onFund={() => requireNetwork(() => navigate('/fund'))}
          onSync={handleSync}
        />

        <div className={styles.activityCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Recent activity</span>
            {hasMore && (
              <button
                type="button"
                className={styles.seeAll}
                onClick={() => navigate('/transactions')}
              >
                See all
              </button>
            )}
          </div>

          <TransactionList
            transactions={recentTransactions}
            isLoading={isLoading}
            error={listError}
          />
        </div>
      </AppShell>

      <SettingsDrawer
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onChangePin={() => {
          setIsSettingsOpen(false);
          navigate('/change-pin');
        }}
        onComingSoon={(featureName) => {
          setIsSettingsOpen(false);
          navigate('/coming-soon', { state: { featureName } });
        }}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        logoutLabel={
          LOGOUT_LABELS[logoutStep] ?? (isLoggingOut ? 'Logging out...' : 'Log out')
        }
        error={logoutError}
      />

      <Modal
        open={blockedBalance !== null}
        icon="⚠️"
        title="Cannot log out yet"
        onClose={() => setBlockedBalance(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setBlockedBalance(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBlockedBalance(null);
                navigate('/fund', { state: { autoTab: 'online', fromLogout: true } });
              }}
            >
              Transfer balance
            </Button>
          </>
        }
      >
        You still have <strong>{formatNaira(blockedBalance ?? 0)}</strong> in your offline
        wallet. Transfer the remaining balance to your online account before logging out.
      </Modal>

      <NoInternetModal show={showNoInternet} onClose={() => setShowNoInternet(false)} />
    </>
  );
}

export default Dashboard;