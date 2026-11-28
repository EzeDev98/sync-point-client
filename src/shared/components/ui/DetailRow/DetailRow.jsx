// Label and value row in a summary card.
import styles from './DetailRow.module.css';

function DetailRow({ label, value, children, size = 'sm', mono = false, className = '' }) {
  const rowClassNames = [
    styles.row,
    size === 'md' ? styles.sizeMd : styles.sizeSm,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const valueClassNames = [styles.value, mono ? styles.mono : ''].filter(Boolean).join(' ');

  return (
    <div className={rowClassNames}>
      <span className={styles.label}>{label}</span>
      <span className={valueClassNames}>{children ?? value}</span>
    </div>
  );
}

export default DetailRow;
