/**
 * Field validators shared across the auth screens.
 *
 * The same phone, password and OTP rules were previously re-implemented
 * inside a local validate() in Login, Register, ForgotPassword,
 * VerifyResetOtp and CreateNewPassword — five copies that had already drifted
 * apart (Register required 6 characters for a password, CreateNewPassword
 * required 8).
 *
 * Each validator returns an error string, or an empty string when valid.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const OTP_LENGTH = 6;

export function validatePhoneNumber(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'Phone number is required';
  if (!/^\d{10,11}$/.test(trimmed.replace(/\D/g, ''))) {
    return 'Enter a valid phone number (10-11 digits)';
  }
  return '';
}

export function validateRequired(value, label) {
  return (value ?? '').trim() ? '' : `${label} is required`;
}

export function validateEmail(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'Email is required';
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) return 'Enter a valid email address';
  return '';
}

export function validatePassword(value) {
  if (!value) return 'Password is required';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return '';
}

export function validatePasswordConfirmation(confirmation, password) {
  if (!confirmation) return 'Please confirm your password';
  if (confirmation !== password) return 'Passwords do not match';
  return '';
}

export function validateOtp(value) {
  if (!value) return 'Verification code is required';
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) {
    return 'The verification code is invalid';
  }
  return '';
}

/** Drops empty entries so callers can test with Object.keys(...).length. */
export function collectErrors(candidates) {
  return Object.fromEntries(Object.entries(candidates).filter(([, message]) => Boolean(message)));
}