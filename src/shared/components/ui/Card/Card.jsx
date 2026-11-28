// Bordered surface for form and summary content.
import styles from './Card.module.css';

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
