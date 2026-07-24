import { useId } from 'react';
import styles from './FormField.module.css';

/**
 * The shell every form control shares: label, the control itself, and a
 * hint-or-error line beneath it.
 *
 * TextField, SelectField, AmountField and PinField each carried their own
 * copy of this — the same useId/fieldId/messageId derivation, the same
 * label markup, the same message paragraph, and roughly forty identical
 * lines of CSS apiece. Four copies of a form-field shell is four places to
 * fix an accessibility bug.
 *
 * Children are given the ids to bind to via a render prop, so the control
 * stays in charge of its own markup while the wiring is done once here.
 */
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