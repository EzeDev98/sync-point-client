import { useEffect, useState } from 'react';
import { ChevronRight, KeyRound, LogOut, X } from 'lucide-react';
import { FormError } from '@shared/components/ui';
import styles from './SettingsDrawer.module.css';

/**
 * Left-hand settings drawer.
 *
 * Dashboard previously tracked the drawer with two booleans plus a ref to a
 * setTimeout: `settingsOpen` for whether it was mounted and `settingsVisible`
 * for whether it had slid in, with a manual timer unmounting it after the
 * transition. All of that lives here now, and the exit is driven by the
 * transitionend event rather than a duration kept in sync with the
 * stylesheet by hand.
 */
function SettingsDrawer({ open, onClose, onChangePin, onLogout, logoutLabel, isLoggingOut, error }) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsVisible(false);
      return undefined;
    }

    setIsMounted(true);

    // Two frames, not one.
    //
    // A CSS transition needs the browser to have painted the starting state
    // before the ending state is applied. requestAnimationFrame callbacks
    // run *before* the next paint, so with a single frame React commits the
    // off-screen transform and the on-screen transform between the same two
    // paints — the browser only ever draws the final position and the
    // drawer appears instantly.
    //
    // Waiting a second frame guarantees a paint in between, giving the
    // transition two distinct states to animate across.
    let innerFrame = null;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setIsVisible(true));
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      if (innerFrame !== null) cancelAnimationFrame(innerFrame);
    };
  }, [open]);

  if (!isMounted) return null;

  function handleTransitionEnd(e) {
    if (e.propertyName === 'transform' && !isVisible) {
      setIsMounted(false);
    }
  }

  return (
    <div
      className={[styles.overlay, isVisible ? styles.overlayVisible : ''].filter(Boolean).join(' ')}
      onClick={onClose}
    >
      <aside
        className={[styles.drawer, isVisible ? styles.drawerVisible : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={handleTransitionEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </header>

        <div className={styles.body}>
          <button type="button" className={styles.item} onClick={onChangePin}>
            <span className={styles.itemLeft}>
              <KeyRound size={16} strokeWidth={1.8} />
              Change PIN
            </span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>

          {error && <FormError className={styles.error}>{error}</FormError>}

          <button
            type="button"
            className={[styles.item, styles.itemDanger].join(' ')}
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            <span className={styles.itemLeft}>
              <LogOut size={16} strokeWidth={1.8} />
              {logoutLabel}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
}

export default SettingsDrawer;