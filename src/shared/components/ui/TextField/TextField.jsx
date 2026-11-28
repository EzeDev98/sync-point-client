// Text input with an optional reveal toggle for secret values.
import { useState } from 'react';
import FormField from '../FormField/FormField.jsx';
import styles from './TextField.module.css';

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
  const [revealed, setRevealed] = useState(false);
  const resolvedType = secret ? (revealed ? 'text' : 'password') : type;

  return (
    <FormField
      label={label}
      optional={optional}
      error={error}
      hint={hint}
      id={id}
      name={name}
      reserveMessageSpace={reserveMessageSpace}
      className={className}
    >
      {({ fieldId, messageId, hasError }) => (
        <div className={styles.inputWrapper}>
          <input
            id={fieldId}
            name={name}
            ref={inputRef}
            className={[
              styles.input,
              hasError ? styles.inputError : '',
              secret ? styles.inputWithToggle : '',
            ]
              .filter(Boolean)
              .join(' ')}
            type={resolvedType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={messageId}
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
      )}
    </FormField>
  );
}

export default TextField;
