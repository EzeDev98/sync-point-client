import styles from './ButtonGroup.module.css';

/**
 * Lays out two or more Buttons. Replaces .btn-group (12 uses) and
 * .button-group, and removes the inline `style={{ display: 'flex', gap: 10 }}`
 * repeated wherever buttons sat side by side.
 *
 * In `row` direction the children share the width equally, reproducing the old
 * `.button-group .btn-primary { flex: 1 }` rule.
 */
function ButtonGroup({ children, direction = 'column', className = '' }) {
  const classNames = [
    styles.group,
    direction === 'row' ? styles.row : styles.column,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classNames}>{children}</div>;
}

export default ButtonGroup;