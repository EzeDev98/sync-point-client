/**
 * Validators shared by more than one feature.
 *
 * validateOtp and collectErrors were byte-identical in authValidation.js and
 * pinValidation.js, along with the OTP_LENGTH constant they both depend on.
 * Two copies of a length rule is exactly the kind of thing that drifts —
 * change the OTP to five digits in one place and password reset accepts it
 * while PIN reset does not.
 */

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

/** Drops empty entries so callers can test with Object.keys(...).length. */
export function collectErrors(candidates) {
  return Object.fromEntries(Object.entries(candidates).filter(([, message]) => Boolean(message)));
}