import BackButton from '../BackButton/BackButton.jsx';
import styles from './PageHeader.module.css';

/**
 * Sticky page header: back control, title, optional trailing slot.
 * Replaces .page-header / .page-title / .back-btn (5 uses each), which were
 * assembled by hand on every wallet page.
 */
function PageHeader({ title, onBack, backLabel, trailing, className = '' }) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')}>
      {onBack && <BackButton onClick={onBack} label={backLabel} />}
      {title && <h1 className={styles.title}>{title}</h1>}
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </header>
  );
}

export default PageHeader;