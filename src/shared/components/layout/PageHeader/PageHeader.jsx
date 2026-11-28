// Header row with back button, title and an optional trailing slot.
import BackButton from '../BackButton/BackButton.jsx';
import styles from './PageHeader.module.css';

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
