import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '@shared/components/layout';
import TransactionList from '@features/wallet/components/TransactionList/TransactionList.jsx';
import { readIdentity } from '@features/wallet/utils/identity';
import { SESSION_EXPIRED, useWalletData } from '@features/wallet/hooks/useWalletData';
import styles from './TransactionHistory.module.css';

/**
 * The full transaction history — every transaction, newest first, scrolled
 * as a normal page. The dashboard shows only the latest few and links here
 * via "See all", so the dashboard itself never has to scroll.
 */
function TransactionHistory() {
  const navigate = useNavigate();

  const walletId = readIdentity('walletId', null);
  const isSessionValid = Boolean(walletId);

  const { transactions, isLoading, loadError } = useWalletData({ enabled: isSessionValid });

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

  if (!isSessionValid) return null;

  const listError =
    loadError === SESSION_EXPIRED
      ? 'Please re-enter your PIN to unlock your wallet.'
      : loadError
        ? 'Could not load your transactions.'
        : '';

  return (
    <AppShell
      header={<PageHeader title="Transaction history" onBack={() => navigate('/dashboard')} />}
    >
      <div className={styles.wrapper}>
        <TransactionList transactions={transactions} isLoading={isLoading} error={listError} />
      </div>
    </AppShell>
  );
}

export default TransactionHistory;