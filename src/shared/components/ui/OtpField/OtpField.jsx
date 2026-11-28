// One-time code input.
import TextField from '../TextField/TextField.jsx';
import { OTP_LENGTH } from '@shared/utils/validation';
import styles from './OtpField.module.css';

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
