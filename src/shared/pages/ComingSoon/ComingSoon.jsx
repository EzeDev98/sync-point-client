// Placeholder screen for features not yet available.
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { AppLogo } from '@shared/components/branding';
import styles from './ComingSoon.module.css';

function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();
  const featureName = location.state?.featureName || 'This feature';

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <AppLogo size={64} />
        </div>

        <div className={styles.icon} aria-hidden="true">
          <Sparkles size={40} strokeWidth={1.6} />
        </div>

        <h2 className={styles.title}>{featureName} is coming soon</h2>

        <p className={styles.message}>
          We&apos;re still building this. Check back in a future update.
        </p>

        <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
          <ChevronLeft size={16} strokeWidth={1.8} />
          Go back
        </button>
      </div>
    </div>
  );
}

export default ComingSoon;
