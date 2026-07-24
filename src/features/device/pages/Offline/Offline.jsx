import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLogo } from '@shared/components/branding';
import { useNetwork } from '@shared/hooks/useNetwork';
import { ROUTES } from '@app/router/routes';
import styles from './Offline.module.css';

/**
 * Shown when an action needs connectivity that is not available.
 * Returns the user to wherever they were the moment the network comes back.
 */
function Offline() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useNetwork();

  const returnTo = location.state?.returnTo || ROUTES.LOGIN;

  useEffect(() => {
    if (isOnline) {
      navigate(returnTo, { replace: true });
    }
  }, [isOnline, navigate, returnTo]);

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <AppLogo size={64} />
        </div>

        <div className={styles.icon} aria-hidden="true">
          📡
        </div>

        <h2 className={styles.title}>You&apos;re offline</h2>

        <p className={styles.message}>
          SyncPoint needs an internet connection to continue. Reconnect and we will take
          you right back.
        </p>

        <div className={styles.status} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          Waiting for connection...
        </div>
      </div>
    </div>
  );
}

export default Offline;