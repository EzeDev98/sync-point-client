/**
 * Carries state between the steps of the password-reset flow.
 *
 * Held in a module variable rather than storage on purpose: the reset token
 * is a short-lived single-use credential and should not outlive the tab.
 * Losing it on a refresh is intentional — the route guards send the user
 * back to the start rather than stranding them mid-flow with no way to
 * finish.
 */

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