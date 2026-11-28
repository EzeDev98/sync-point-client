// Carries the phone number from registration or login to account verification.
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
