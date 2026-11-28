// Lays out two or more buttons.
import styles from './ButtonGroup.module.css';

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
