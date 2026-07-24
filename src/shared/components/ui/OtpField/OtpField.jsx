import TextField from '../TextField/TextField.jsx';
import { OTP_LENGTH } from '@shared/utils/validation';
import styles from './OtpField.module.css';

/**
 * One-time code input.
 *
 * Both OTP screens configured a TextField identically — numeric input mode,
 * the one-time-code autocomplete hint, the length cap — and then each
 * carried its own module stylesheet with the same three widely-spaced-digit
 * rules. That is now one component.
 */
function OtpField({ label = 'Verification code', value, onChange, error, name = 'otp' }) {
  return (
    <TextField
      label={label}
      name={name}
      placeholder="• • • • • •"
      value={value}
      onChange={onChange}
      error={error}
      inputMode="numeric"
      maxLength={OTP_LENGTH}
      autoComplete="one-time-code"
      className={styles.otpField}
    />
  );
}

export default OtpField;