import { useId, useState } from 'react';
import styles from './PinField.module.css';

/**
 * Four-digit PIN entry.
 *
 * The same input was hand-written ten times across the six PIN screens, each
 * carrying an identical inline
 * `style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: 20 }}`
 * plus its own Show/Hide button and its own `showX` boolean in the parent.
 *
 * Digit-only filtering and the length cap live here too, so a parent's
 * onChange only ever receives a valid partial PIN.
 */
function PinField({
  label,
  value,
  onChange,
  name,
  id,
  error = '',
  hint = '',
  length = 4,
  autoFocus = false,
  disabled = false,
  className = '',
}) {
  const generatedId = useId();
  const fieldId = id ?? name ?? generatedId;
  const messageId = `${fieldId}-message`;

  const [revealed, setRevealed] = useState(false);

  const message = error || hint;
  const hasError = Boolean(error);

  function handleChange(e) {
    const next = e.target.value;
    if (!/^\d*$/.test(next) || next.length > length) return;
    onChange(e);
  }

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
      )}

      <div className={styles.inputWrapper}>
        <input
          id={fieldId}
          name={name}
          className={[styles.input, hasError ? styles.inputError : ''].filter(Boolean).join(' ')}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          placeholder={'• '.repeat(length).trim()}
          inputMode="numeric"
          maxLength={length}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={message ? messageId : undefined}
        />

        <button
          type="button"
          className={styles.revealToggle}
          onClick={() => setRevealed((current) => !current)}
          disabled={disabled}
          aria-label={revealed ? 'Hide PIN' : 'Show PIN'}
          aria-pressed={revealed}
          tabIndex={-1}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>

      <p
        id={messageId}
        className={hasError ? styles.error : styles.hint}
        role={hasError ? 'alert' : undefined}
      >
        {message}
      </p>
    </div>
  );
}

export default PinField;