// PIN validation rules.
export { OTP_LENGTH, collectErrors, validateOtp } from '@shared/utils/validation';

export const PIN_LENGTH = 4;

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
