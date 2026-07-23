import { useId } from 'react';
import styles from './SelectField.module.css';

/**
 * Select counterpart to TextField, sharing its label / hint / error anatomy.
 *
 * Options are passed as data rather than as children so every call site
 * renders them identically:
 *   options={[{ value: 'ng', label: 'Nigeria' }]}
 */
function SelectField({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  id,
  name,
  error = '',
  hint = '',
  optional = false,
  disabled = false,
  reserveMessageSpace = true,
  className = '',
  ...rest
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

      <select
        id={fieldId}
        name={name}
        className={[styles.select, hasError ? styles.selectError : ''].filter(Boolean).join(' ')}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={message ? messageId : undefined}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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

export default SelectField;