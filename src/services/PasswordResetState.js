// In-memory only (never localStorage/sessionStorage) carrier for state that
// needs to travel between the Forgot Password wizard's steps
// (phone number -> OTP verification -> reset token -> new password).
//
// Kept in a plain JS module variable rather than persistent storage because
// the reset token is a sensitive, short-lived, single-use credential that
// shouldn't linger in the browser beyond the current tab session. Losing
// this state on a full page refresh is an acceptable, intentional trade-off:
// route guards below send the user back to the start of the flow if it's
// missing, rather than letting them land on an intermediate step with no
// way to complete it.

let state = {
  phoneNumber: null,
  otpRequested: false,
  resetToken: null,
};

export function setPhoneNumber(phoneNumber) {
  state = { phoneNumber, otpRequested: true, resetToken: null };
}

export function getPhoneNumber() {
  return state.phoneNumber;
}

export function hasRequestedOtp() {
  return Boolean(state.phoneNumber && state.otpRequested);
}

export function setResetToken(resetToken) {
  state = { ...state, resetToken };
}

export function getResetToken() {
  return state.resetToken;
}

export function hasResetToken() {
  return Boolean(state.resetToken);
}

export function clearPasswordResetState() {
  state = { phoneNumber: null, otpRequested: false, resetToken: null };
}

export function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return "";
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 6) return phoneNumber;
  const start = digits.slice(0, 3);
  const end = digits.slice(-2);
  return `${start}${"*".repeat(digits.length - 5)}${end}`;
}