// Full-viewport wrapper that centres a single card.
import styles from './ScreenContainer.module.css';

function ScreenContainer({ children, className = '' }) {
  return (
    <div className={[styles.screen, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default ScreenContainer;
