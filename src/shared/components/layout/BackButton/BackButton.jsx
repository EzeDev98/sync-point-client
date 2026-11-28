// Circular back button.
import { ChevronLeft } from 'lucide-react';
import styles from './BackButton.module.css';

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
