import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLogo } from '@shared/components/branding';
import { Button, ButtonGroup } from '@shared/components/ui';
import { hasResumableSession } from '@features/auth/services/sessionManager';
import styles from './Welcome.module.css';

/**
 * Entry screen for users without a session.
 *
 * Installation is guaranteed upstream by InstallGuard, so this screen only
 * handles the sign-in / register choice. The entire `const styles = {...}`
 * inline object the previous version carried is now Welcome.module.css.
 */

const FEATURES = [
  { icon: '📶', text: 'Works completely offline' },
  { icon: '🔐', text: 'End-to-end encrypted transactions' },
  { icon: '⚡', text: 'Instant QR-based payments' },
  { icon: '🔄', text: 'Auto-syncs when you reconnect' },
];

function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    if (hasResumableSession()) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className={styles.screen}>
      <div className={styles.branding}>
        <h1 className={styles.title}>SyncPoint</h1>
        <p className={styles.description}>
          Offline-first peer-to-peer payments. Send and receive money without internet.
        </p>
      </div>

      <ul className={styles.features}>
        {FEATURES.map(({ icon, text }) => (
          <li className={styles.feature} key={text}>
            <span className={styles.featureIcon} aria-hidden="true">
              {icon}
            </span>
            {text}
          </li>
        ))}
      </ul>

      <ButtonGroup className={styles.actions}>
        <Button onClick={() => navigate('/login')}>Sign in</Button>
        <Button variant="secondary" onClick={() => navigate('/register')}>
          Create account
        </Button>
      </ButtonGroup>

      <p className={styles.terms}>By continuing you agree to our Terms of Service</p>
    </div>
  );
}

export default Welcome;