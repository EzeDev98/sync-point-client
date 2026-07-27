import styles from './AppLogo.module.css';
import { APP_LOGO_DATA_URI } from './logoAsset';

/**
 * App mark. Previously built entirely from inline styles; the only value that
 * genuinely varies is the size, so it is passed as a CSS custom property and
 * everything else lives in the stylesheet.
 *
 * The image source is an inlined data URI (see logoAsset.js) rather than a
 * path under /icons. That path was a runtime network request served from the
 * service-worker cache, so it vanished offline whenever that cache entry was
 * absent. Shipping the mark inside the JS bundle removes the dependency
 * entirely — it renders offline unconditionally.
 */
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