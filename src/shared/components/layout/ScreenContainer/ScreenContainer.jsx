import styles from './ScreenContainer.module.css';

/**
 * Full-viewport wrapper that centres a single card on screen.
 * Replaces .auth-page (16 uses across the auth and pin features).
 *
 * Uses 100svh rather than 100vh so mobile browser chrome appearing or
 * disappearing does not change the layout height.
 */
function ScreenContainer({ children, className = '' }) {
  return (
    <div className={[styles.screen, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default ScreenContainer;