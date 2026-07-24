/**
 * Carries state between the steps of the PIN-reset flow.
 *
 * No phone number here, unlike passwordResetState: the user is still signed
 * in during a PIN reset — only the PIN is forgotten, not the account — so
 * the phone number is read fresh from the session each time rather than
 * being carried along and risking a stale copy.
 */

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