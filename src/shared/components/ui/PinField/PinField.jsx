// Four-digit PIN input.
import { useState } from 'react';
import FormField from '../FormField/FormField.jsx';
import styles from './PinField.module.css';

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
  reserveMessageSpace = true,
  className = '',
}) {
  const [revealed, setRevealed] = useState(false);

  function handleChange(e) {
    const next = e.target.value;
    if (!/^\d*$/.test(next) || next.length > length) return;
    onChange(e);
  }

  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      id={id}
      name={name}
      reserveMessageSpace={reserveMessageSpace}
      className={[styles.centeredMessage, className].filter(Boolean).join(' ')}
    >
      {({ fieldId, messageId, hasError }) => (
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
            aria-describedby={messageId}
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
      )}
    </FormField>
  );
}

export default PinField;
