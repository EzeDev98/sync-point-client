// In-memory state shared by the password reset steps.
const EMPTY = { phoneNumber: null, otpRequested: false, resetToken: null };

let state = EMPTY;

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
  state = EMPTY;
}
