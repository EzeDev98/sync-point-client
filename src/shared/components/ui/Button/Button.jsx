// Button component with variants.
import styles from './Button.module.css';

const VARIANT_CLASS = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
};

function Button({
  children,
  variant = 'primary',
  type = 'button',
  fullWidth = true,
  loading = false,
  loadingLabel,
  disabled = false,
  className = '',
  ...rest
}) {
  const classNames = [
    styles.button,
    VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary,
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export default Button;
