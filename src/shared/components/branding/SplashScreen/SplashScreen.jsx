import styles from './SplashScreen.module.css';

// Lives in public/icons, so it's referenced by root URL, not imported —
// Vite doesn't bundle files under public/. See STATIC_ASSETS in sw.js,
// which is what makes this path actually available offline.
const SPLASH_LOGO_SRC = '/icons/new-logo.png';

function SplashScreen({ exiting = false }) {
  return (
    <div
      className={[styles.screen, exiting ? styles.exiting : ''].filter(Boolean).join(' ')}
      role="presentation"
    >
      <div className={styles.center}>
        <img src={SPLASH_LOGO_SRC} alt="" className={styles.logo} aria-hidden="true" />
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