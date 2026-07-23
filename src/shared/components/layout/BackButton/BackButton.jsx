import { ChevronLeft } from 'lucide-react';
import styles from './BackButton.module.css';

/**
 * Circular back control. Replaces .back-btn (5 uses).
 * Defaults to history.back via the onClick the caller supplies.
 */
function BackButton({ onClick, label = 'Go back', className = '' }) {
  return (
    <button
      type="button"
      className={[styles.backButton, className].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
    >
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
  );
}

export default BackButton;