/**
 * Session storage: what is kept, where, and how it is torn down.
 *
 * Three tiers, because they have genuinely different lifetimes:
 *   access tokens   — sessionStorage, gone when the tab closes
 *   identity        — localStorage, survives the app being closed
 *   encryption keys — localStorage, cleared only on explicit sign-out
 */

/** Short-lived credentials. Never persisted. */
const TOKEN_KEYS = ['sessionToken', 'accessTokenExpiresIn', 'tokenIssuedAt'];

/** Everything that must survive the app closing. */
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

/** Writes a value that must survive the app closing. */
export function persistValue(key, value) {
  localStorage.setItem(key, value);
}

/**
 * Reads a persisted value.
 *
 * sessionStorage is checked second as a fallback for values written before
 * identity moved to localStorage.
 */
export function readPersisted(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? null;
}

/**
 * Drops access tokens only.
 *
 * Used when forcing re-authentication without ending the session — the
 * refresh token and all identity survive, so the user is not signed out.
 */
export function clearTokenSession() {
  TOKEN_KEYS.forEach((key) => sessionStorage.removeItem(key));
}

/**
 * Full sign-out — wipes both storages.
 *
 * This makes every encrypted record permanently unreadable, because
 * wrappedDEK goes with it. Only logoutManager should call this, and only
 * once it has confirmed there is nothing left unsynced.
 */
export function clearAuthSession() {
  TOKEN_KEYS.forEach((key) => sessionStorage.removeItem(key));

  PERSISTENT_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

/**
 * Returns the signed-in phone number, or throws.
 *
 * Several endpoints require it in their body, and each of them previously
 * declared its own identical requirePhoneNumber() helper.
 */
export function requirePhoneNumber() {
  const phoneNumber = readPersisted('phoneNumber');

  if (!phoneNumber) {
    throw new Error('Phone number not found. Please sign in again.');
  }

  return phoneNumber;
}

/** A session that can be resumed with a PIN, without signing in again. */
export function hasResumableSession() {
  return Boolean(localStorage.getItem('refreshToken'));
}

/** A session with a usable access token right now. */
export function hasActiveSession() {
  return Boolean(sessionStorage.getItem('sessionToken')) && hasResumableSession();
}