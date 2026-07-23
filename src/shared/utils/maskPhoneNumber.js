/**
 * Masks the middle digits of a phone number for display, e.g.
 * 08012345678 -> 080******78
 *
 * This exact function was defined three separate times — verbatim in
 * ForgotPin.jsx and VerifyPinResetOtp.jsx, and again inside the password
 * reset state module. Numbers shorter than six digits are returned
 * unchanged, since there is nothing meaningful left to mask.
 */
export function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';

  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length < 6) return phoneNumber;

  const start = digits.slice(0, 3);
  const end = digits.slice(-2);

  return `${start}${'*'.repeat(digits.length - 5)}${end}`;
}