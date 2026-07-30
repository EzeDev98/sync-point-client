import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/ui';
import { isPWAInstalled } from '@features/device/services/deviceCompatibility';
import { ROUTES } from '@app/router/routes';
import { ArrowRight } from 'lucide-react';
import styles from './Onboarding.module.css';

/**
 * First screen at /. Users who have already installed the app are sent
 * straight to the welcome screen.
 */

const FEATURES = [
  {
    icon: '📶',
    heading: 'Works fully offline',
    body: 'Complete transactions without a network connection using encrypted QR codes.',
  },
  {
    icon: '🔐',
    heading: 'End-to-end encrypted',
    body: 'Every transaction is encrypted with a key only you control — your PIN.',
  },
  {
    icon: '⚡',
    heading: 'Instant QR payments',
    body: 'Scan to pay or receive in seconds. No account numbers, no delays.',
  },
  {
    icon: '🔄',
    heading: 'Syncs when reconnected',
    body: 'Transactions recorded offline sync to the server automatically once you are back online.',
  },
];

function Onboarding() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isPWAInstalled()) {
      navigate(ROUTES.WELCOME, { replace: true });
    }
  }, [navigate]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <h1 className={styles.appName}>SyncPoint</h1>
          <p className={styles.tagline}>
            Send and receive money even without internet.
          </p>
        </div>

        <ul className={styles.features}>
          {FEATURES.map(({ icon, heading, body }) => (
            <li className={styles.feature} key={heading}>
              <span className={styles.featureIcon} aria-hidden="true">
                {icon}
              </span>
              <div>
                <p className={styles.featureHeading}>{heading}</p>
                <p className={styles.featureBody}>{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.cta}>
          <p className={styles.ctaHint}>
            SyncPoint works as an installed app for the full offline experience.
          </p>
          <Button onClick={() => navigate(ROUTES.INSTALL)}>
            Get started
            <ArrowRight size={16} className={styles.ctaArrow} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;