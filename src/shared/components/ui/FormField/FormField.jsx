// Shared label, control and hint or error layout for form fields.
import { useId } from 'react';
import styles from './FormField.module.css';

function FormField({
  label,
  optional = false,
  error = '',
  hint = '',
  id,
  name,
  reserveMessageSpace = true,
  className = '',
  children,
}) {
  const generatedId = useId();
  const fieldId = id ?? name ?? generatedId;
  const messageId = `${fieldId}-message`;

  const message = error || hint;
  const hasError = Boolean(error);

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
          {optional && <span className={styles.optional}>Optional</span>}
        </label>
      )}

      {children({
        fieldId,
        messageId: message ? messageId : undefined,
        hasError,
      })}

      {(message || reserveMessageSpace) && (
        <p
          id={messageId}
          className={hasError ? styles.error : styles.hint}
          role={hasError ? 'alert' : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default FormField;
