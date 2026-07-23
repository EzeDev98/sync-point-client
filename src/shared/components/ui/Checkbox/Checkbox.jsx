import { useId } from 'react';
import styles from './Checkbox.module.css';

/**
 * Labelled checkbox. Replaces .checkbox-label, which was previously written
 * out by hand with a nested native input.
 */
function Checkbox({ label, checked, onChange, name, id, disabled = false, className = '' }) {
  const generatedId = useId();
  const fieldId = id ?? name ?? generatedId;

  return (
    <label className={[styles.wrapper, className].filter(Boolean).join(' ')} htmlFor={fieldId}>
      <input
        id={fieldId}
        name={name}
        className={styles.input}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={styles.label}>{label}</span>
    </label>
  );
}

export default Checkbox;