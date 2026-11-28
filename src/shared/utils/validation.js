// Validators shared by more than one feature.
export const OTP_LENGTH = 6;

export function validateOtp(value) {
  if (!value) return 'Verification code is required';
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) {
    return 'The verification code is invalid';
  }
  return '';
}

export function validateRequired(value, label) {
  return (value ?? '').trim() ? '' : `${label} is required`;
}

export function collectErrors(candidates) {
  return Object.fromEntries(Object.entries(candidates).filter(([, message]) => Boolean(message)));
}
