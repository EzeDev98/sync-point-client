import { useId, useState } from 'react';
import styles from './TextField.module.css';

/**
 * Label + input + hint/error, with an optional reveal toggle for secret
 * fields.
 *
 * Collapses .form-field (39 uses), .input-wrapper (33), .field-error (49),
 * .field-hint (15) and .password-toggle (16) into one component, and removes
 * the per-page duplication of the same markup across auth, pin and wallet.
 *
 * `secret` renders the Show/Hide toggle and starts masked. Use it for
 * passwords and PINs rather than hard-coding type="password", so the toggle
 * and the right-hand padding always stay in sync.
 */
function TextField({
  label,
  value,
  onChange,
  id,
  name,
  type = 'text',
  secret = false,
  error = '',
  hint = '',
  optional = false,
  disabled = false,
  reserveMessageSpace = true,
  inputRef,
  className = '',
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id ?? name ?? generatedId;
  const messageId = `${fieldId}-message`;

  const [revealed, setRevealed] = useState(false);
  const resolvedType = secret ? (revealed ? 'text' : 'password') : type;

  const message = error || hint;
  const hasError = Boolean(error);

  const inputClassNames = [styles.input, hasError ? styles.inputError : '', secret ? styles.inputWithToggle : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
          {optional && <span className={styles.optional}>Optional</span>}
        </label>
      )}

      <div className={styles.inputWrapper}>
        <input
          id={fieldId}
          name={name}
          ref={inputRef}
          className={inputClassNames}
          type={resolvedType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />

        {secret && (
          <button
            type="button"
            className={styles.revealToggle}
            onClick={() => setRevealed((current) => !current)}
            disabled={disabled}
            aria-label={revealed ? 'Hide' : 'Show'}
            aria-pressed={revealed}
            tabIndex={-1}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

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

export default TextField;