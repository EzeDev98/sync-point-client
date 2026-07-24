import { validateRequired } from '@shared/utils/validation';

/**
 * Password and phone rules specific to the auth screens.
 *
 * The OTP and error-collection helpers moved to shared/utils/validation —
 * the PIN feature needed the identical implementations. They are re-exported
 * here so auth call sites keep one import.
 */

export { OTP_LENGTH, collectErrors, validateOtp, validateRequired } from '@shared/utils/validation';

export const PASSWORD_MIN_LENGTH = 8;

export function validatePhoneNumber(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'Phone number is required';
  if (!/^\d{10,11}$/.test(trimmed.replace(/\D/g, ''))) {
    return 'Enter a valid phone number (10-11 digits)';
  }
  return '';
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

/** Kept so the import surface of this module stays stable for call sites. */
export { validateRequired as validateRequiredField };