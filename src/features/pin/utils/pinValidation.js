/**
 * PIN rules.
 *
 * The OTP and error-collection helpers moved to shared/utils/validation,
 * where the auth feature uses the same implementations. They are re-exported
 * here so PIN call sites keep one import.
 */

export { OTP_LENGTH, collectErrors, validateOtp } from '@shared/utils/validation';

export const PIN_LENGTH = 4;

/**
 * PINs rejected outright.
 *
 * Every PIN screen already told users to "avoid simple PINs like 1234 or
 * 0000" and then accepted them anyway; this makes the existing advice
 * enforced. Confirmed as intended behaviour.
 *
 * Blocking twelve of ten thousand values is a negligible reduction in
 * keyspace — the real protection against guessing is attempt rate limiting,
 * not this list. It is here because it costs nothing and matches what the
 * UI already promises.
 *
 * Note an existing user whose PIN is on this list can still sign in; they
 * would only be stopped from setting it again at a PIN change.
 */
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1234', '4321',
]);

export function validatePin(value, label = 'PIN') {
  if (!value || value.length < PIN_LENGTH) {
    return `${label} must be exactly ${PIN_LENGTH} digits`;
  }
  return '';
}

export function validateNewPin(value) {
  const lengthError = validatePin(value, 'New PIN');
  if (lengthError) return lengthError;
  // Naming the value makes the rejection actionable rather than mysterious.
  if (WEAK_PINS.has(value)) return `${value} is too easy to guess — choose a less predictable PIN`;
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