import styles from './Card.module.css';

/**
 * The bordered surface used to hold form and summary content.
 * Replaces .auth-card (20 uses) and .auth-card--wide.
 *
 * `centered` replaces the inline `style={{ textAlign: 'center' }}` applied to
 * cards at several call sites.
 */
function Card({ children, wide = false, centered = false, className = '', ...rest }) {
  const classNames = [
    styles.card,
    wide ? styles.wide : '',
    centered ? styles.centered : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} {...rest}>
      {children}
    </div>
  );
}

export default Card;