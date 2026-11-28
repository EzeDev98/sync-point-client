// Naira amount input.
import FormField from '../FormField/FormField.jsx';
import styles from './AmountField.module.css';

function AmountField({
  label,
  value,
  onChange,
  name,
  id,
  error = '',
  hint = '',
  max,
  min = 0,
  disabled = false,
  reserveMessageSpace = true,
  className = '',
  ...rest
}) {
  return (
    <FormField
      label={label}
      error={error}
      hint={hint}
      id={id}
      name={name}
      reserveMessageSpace={reserveMessageSpace}
      className={className}
    >
      {({ fieldId, messageId, hasError }) => (
        <div className={styles.wrapper}>
          <span className={styles.symbol} aria-hidden="true">
            ₦
          </span>
          <input
            id={fieldId}
            name={name}
            className={[styles.input, hasError ? styles.inputError : ''].filter(Boolean).join(' ')}
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={messageId}
            {...rest}
          />
        </div>
      )}
    </FormField>
  );
}

export default AmountField;
