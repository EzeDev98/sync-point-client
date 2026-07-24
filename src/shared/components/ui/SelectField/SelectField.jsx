import FormField from '../FormField/FormField.jsx';
import styles from './SelectField.module.css';

/**
 * Select counterpart to TextField, sharing FormField's anatomy.
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
        <select
          id={fieldId}
          name={name}
          className={[styles.select, hasError ? styles.selectError : ''].filter(Boolean).join(' ')}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={messageId}
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
      )}
    </FormField>
  );
}

export default SelectField;