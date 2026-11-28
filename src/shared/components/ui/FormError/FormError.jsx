// Form-level error message.
import styles from './FormError.module.css';

function FormError({ children, className = '' }) {
  if (!children) return null;

  return (
    <p className={[styles.error, className].filter(Boolean).join(' ')} role="alert">
      {children}
    </p>
  );
}

export default FormError;
