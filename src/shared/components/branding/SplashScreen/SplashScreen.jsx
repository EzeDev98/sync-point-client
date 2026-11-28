// Splash screen shown while the app starts.
import styles from './SplashScreen.module.css';
import { APP_LOGO_DATA_URI } from '../AppLogo/logoAsset';

function SplashScreen({ exiting = false }) {
  return (
    <div
      className={[styles.screen, exiting ? styles.exiting : ''].filter(Boolean).join(' ')}
      role="presentation"
    >
      <div className={styles.center}>
        <img src={APP_LOGO_DATA_URI} alt="" className={styles.logo} aria-hidden="true" />
        <h1 className={styles.appName}>SyncPoint</h1>
        <p className={styles.tagline}>Offline Payments. Instantly.</p>

        <div className={styles.dots} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>

      <p className={styles.footer}>Reliable &bull; Secure &bull; Offline First</p>
    </div>
  );
}

export default SplashScreen;
