// Slide-in settings drawer.
import { useEffect, useState } from 'react';
import { Camera, ChevronRight, KeyRound, Landmark, LogOut, ShieldCheck, HelpCircle, X } from 'lucide-react';
import { FormError } from '@shared/components/ui';
import styles from './SettingsDrawer.module.css';

function SettingsDrawer({ open, onClose, onChangePin, onComingSoon, onLogout, logoutLabel, isLoggingOut, error }) {
  const [isMounted, setIsMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIsMounted(true);
    else setIsVisible(false);
  }

  useEffect(() => {
    if (!open) return undefined;

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

          <button type="button" className={styles.item} onClick={() => onComingSoon('Profile picture')}>
            <span className={styles.itemLeft}>
              <Camera size={16} strokeWidth={1.8} />
              Upload profile picture
            </span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>

          <button type="button" className={styles.item} onClick={() => onComingSoon('Payment methods')}>
            <span className={styles.itemLeft}>
              <Landmark size={16} strokeWidth={1.8} />
              Payment methods
            </span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>

          <button type="button" className={styles.item} onClick={() => onComingSoon('Security & privacy')}>
            <span className={styles.itemLeft}>
              <ShieldCheck size={16} strokeWidth={1.8} />
              Security & privacy
            </span>
            <ChevronRight size={16} strokeWidth={1.8} />
          </button>

          <button type="button" className={styles.item} onClick={() => onComingSoon('Help & support')}>
            <span className={styles.itemLeft}>
              <HelpCircle size={16} strokeWidth={1.8} />
              Help & support
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
