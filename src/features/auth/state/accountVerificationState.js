/**
 * Carries the phone number between the register/login screens and the
 * post-registration verification screen.
 *
 * Held in a module variable rather than storage, mirroring
 * passwordResetState.js: this is short-lived hand-off state, not something
 * that should survive a refresh. Losing it on reload is intentional — the
 * VerifyAccount route guard sends the user back to register rather than
 * stranding them on a verification screen with nothing to verify.
 */

const EMPTY = { phoneNumber: null, pending: false };

let state = EMPTY;

export function setPendingVerification(phoneNumber) {
  state = { phoneNumber, pending: true };
}

export function getPendingVerificationPhone() {
  return state.phoneNumber;
}

export function hasPendingVerification() {
  return Boolean(state.phoneNumber && state.pending);
}

export function clearAccountVerificationState() {
  state = EMPTY;
}
