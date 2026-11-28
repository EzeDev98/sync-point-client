// Stores and clears session data across session storage, local storage and memory.
const TOKEN_KEYS = ['sessionToken', 'accessTokenExpiresIn', 'tokenIssuedAt'];

const PERSISTENT_KEYS = [
  'refreshToken',
  'refreshTokenExpiresIn',
  'walletId',
  'userId',
  'phoneNumber',
  'username',
  'email',
  'userRefId',
  'firstName',
  'middleName',
  'lastName',
  'mirrorBalance',
  'offlineBalance',
  'wrappedDEK',
  'notifications',
  'pin_salt',
  'pin_verifier',
  'pin_verified_at',
];

export function persistValue(key, value) {
  localStorage.setItem(key, value);
}

export function readPersisted(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? null;
}

export function clearTokenSession() {
  TOKEN_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

export function clearAuthSession() {
  TOKEN_KEYS.forEach((key) => sessionStorage.removeItem(key));

  PERSISTENT_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

export function requirePhoneNumber() {
  const phoneNumber = readPersisted('phoneNumber');

  if (!phoneNumber) {
    throw new Error('Phone number not found. Please sign in again.');
  }

  return phoneNumber;
}

export function hasResumableSession() {
  return Boolean(localStorage.getItem('refreshToken'));
}

export function hasActiveSession() {
  return Boolean(sessionStorage.getItem('sessionToken')) && hasResumableSession();
}
