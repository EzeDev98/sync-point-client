import styles from './AppLogo.module.css';

/**
 * App mark. Previously built entirely from inline styles; the only value that
 * genuinely varies is the size, so it is passed as a CSS custom property and
 * everything else lives in the stylesheet.
 */
function AppLogo({ size = 28, className = '' }) {
  return (
    <div
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ '--app-logo-size': `${size}px` }}
    >
      <img className={styles.image} src="/icons/icon-192x192.png" alt="SyncPoint" />
    </div>
  );
}

export default AppLogo;