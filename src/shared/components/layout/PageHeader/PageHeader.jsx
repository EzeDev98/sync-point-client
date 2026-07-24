import BackButton from '../BackButton/BackButton.jsx';
import styles from './PageHeader.module.css';

/**
 * Back control, title, and an optional trailing slot.
 *
 * Renders a plain row, not a <header>. It is always placed in AppShell's
 * header slot, which already supplies the <header> landmark along with
 * sticky positioning, padding, background and the bottom border. Declaring
 * any of those here as well produced two stacked borders — a short inner
 * one inset by the outer padding, and the full-width outer one.
 */
function PageHeader({ title, onBack, backLabel, trailing, className = '' }) {
  return (
    <div className={[styles.header, className].filter(Boolean).join(' ')}>
      {onBack && <BackButton onClick={onBack} label={backLabel} />}
      {title && <h1 className={styles.title}>{title}</h1>}
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}

export default PageHeader;