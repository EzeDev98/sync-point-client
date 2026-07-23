import styles from './FormError.module.css';

/**
 * Form-level error message — the one that applies to the whole submission
 * rather than a single field.
 *
 * Every page previously rendered this as a bare `<p className="field-error">`,
 * which meant screen readers never announced it. It is now a live region.
 */
function FormError({ children, className = '' }) {
  if (!children) return null;

  return (
    <p className={[styles.error, className].filter(Boolean).join(' ')} role="alert">
      {children}
    </p>
  );
}

export default FormError;