/**
 * PIN field validators.
 *
 * SetPin, ChangePin, CreateNewPin and PinVerification each carried their own
 * copy of these checks. Each validator returns an error string, or an empty
 * string when the value is valid.
 */

export const PIN_LENGTH = 4;
export const OTP_LENGTH = 6;

/** PINs that are trivially guessable and rejected outright. */
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321']);

export function validatePin(value, label = 'PIN') {
  if (!value || value.length < PIN_LENGTH) {
    return `${label} must be exactly ${PIN_LENGTH} digits`;
  }
  return '';
}

export function validateNewPin(value) {
  const lengthError = validatePin(value, 'New PIN');
  if (lengthError) return lengthError;
  if (WEAK_PINS.has(value)) {
    return 'Choose a less predictable PIN';
  }
  return '';
}

export function validatePinConfirmation(confirmation, pin) {
  if (!confirmation) return 'Please confirm your PIN';
  if (confirmation !== pin) return 'PINs do not match';
  return '';
}

export function validatePinIsDifferent(newPin, oldPin) {
  if (oldPin && newPin && newPin === oldPin) {
    return 'New PIN must be different from your current PIN';
  }
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