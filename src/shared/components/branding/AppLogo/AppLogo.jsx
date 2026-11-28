// SyncPoint logo mark.
import styles from './AppLogo.module.css';
import { APP_LOGO_DATA_URI } from './logoAsset';

function AppLogo({ size = 28, className = '' }) {
  return (
    <div
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ '--app-logo-size': `${size}px` }}
    >
      <img className={styles.image} src={APP_LOGO_DATA_URI} alt="SyncPoint" />
    </div>
  );
}

export default AppLogo;
