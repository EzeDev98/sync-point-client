// Labelled checkbox.
import { useId } from 'react';
import styles from './Checkbox.module.css';

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
