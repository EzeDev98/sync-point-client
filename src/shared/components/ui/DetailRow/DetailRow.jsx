import styles from './DetailRow.module.css';

/**
 * A label/value line inside a summary or confirmation card.
 *
 * This one component replaces three near-identical implementations that
 * existed under different names:
 *   .confirm-row / .confirm-row-label / .confirm-row-value       (28 uses)
 *   .review-row  / .review-label      / .review-value            ( 8 uses)
 *   .confirm-sent-row / -row-label    / -row-value               ( 6 uses)
 *
 * They differed only in font size, so that became the `size` prop.
 * `mono` renders the value in the monospace treatment the old
 * .confirm-row-ref rule used for transaction references.
 */
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