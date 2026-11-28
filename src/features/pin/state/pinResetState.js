// In-memory state shared by the PIN reset steps.
const EMPTY = { otpRequested: false, resetToken: null };

let state = EMPTY;

export function markOtpRequested() {
  state = { ...state, otpRequested: true };
}

export function hasRequestedOtp() {
  return Boolean(state.otpRequested);
}

export function setPinResetToken(resetToken) {
  state = { ...state, resetToken };
}

export function getPinResetToken() {
  return state.resetToken;
}

export function hasPinResetToken() {
  return Boolean(state.resetToken);
}

export function clearPinResetState() {
  state = EMPTY;
}
