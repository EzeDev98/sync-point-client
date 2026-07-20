// In-memory only carrier for the PIN-reset wizard's step-to-step state
// (OTP requested -> verified -> reset token -> new PIN). No phone number
// field here, unlike passwordResetState.js — the user is still logged in
// during this flow (only their PIN is forgotten, not their account), so
// the phone number is always read fresh via readPersisted("phoneNumber")
// instead of being carried separately.

let state = {
  otpRequested: false,
  resetToken: null,
};

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
  state = { otpRequested: false, resetToken: null };
}