// Masks the middle digits of a phone number for display.
export function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';

  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length < 6) return phoneNumber;

  const start = digits.slice(0, 3);
  const end = digits.slice(-2);

  return `${start}${'*'.repeat(digits.length - 5)}${end}`;
}
