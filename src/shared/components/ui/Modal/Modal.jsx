import { useEffect, useId } from 'react';
import styles from './Modal.module.css';

/**
 * Centred dialog. Replaces the .modal-overlay / .modal-card / .modal-icon /
 * .modal-title / .modal-body markup that was hand-written at 22+ call sites.
 *
 * Adds the accessibility behaviour the old markup never had: a dialog role,
 * an Escape handler, and a background scroll lock while open.
 */
function Modal({
  open = true,
  icon,
  title,
  children,
  actions,
  onClose,
  dismissOnOverlayClick = true,
  dismissOnEscape = true,
  className = '',
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !dismissOnEscape || !onClose) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, dismissOnEscape, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function handleOverlayClick(event) {
    if (!dismissOnOverlayClick || !onClose) return;
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={[styles.card, className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {icon && (
          <div className={styles.icon} aria-hidden="true">
            {icon}
          </div>
        )}

        {title && (
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
        )}

        {children && <div className={styles.body}>{children}</div>}

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}

export default Modal;