// ============================================
// SESSION UTILS — SyncPoint
// Three-tier session management:
//   clearUnlockedSession() — closes the active wallet session (app close equivalent)
//   clearTokenSession()    — removes access tokens only
//   clearAuthSession()     — removes everything (explicit logout only)
// ============================================

// Access tokens — live in sessionStorage, gone on tab close
const TOKEN_KEYS = [
  "sessionToken",
  "accessTokenExpiresIn",
  "tokenIssuedAt",
];

// Persistent identity — must survive app closure, stored in localStorage
const PERSISTENT_KEYS = [
  "refreshToken",
  "refreshTokenExpiresIn",
  "walletId",
  "userId",
  "phoneNumber",
  "username",
  "email",
  "userRefId",
  "firstName",
  "middleName",
  "lastName",
  "mirrorBalance",
  "offlineBalance",
  "wrappedDEK",
  "notifications",
];

// Temporary unlock state — sessionStorage only
const UNLOCK_KEYS = [
  "pin_salt",
  "pin_verifier",
  "pin_verified_at",
];

/**
 * Called when the wallet is locked (e.g. idle timeout in future).
 * Does NOT clear persistent data or refresh token.
 */
export function clearUnlockedSession() {
  TOKEN_KEYS.forEach((k) => sessionStorage.removeItem(k));
  UNLOCK_KEYS.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Clears only the access token from sessionStorage.
 * Used by token.js when forcing a re-auth without full logout.
 */
export function clearTokenSession() {
  TOKEN_KEYS.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Full logout — wipes everything from both storages.
 * ONLY called by logoutManager after all financial checks pass.
 */
export function clearAuthSession() {
  TOKEN_KEYS.forEach((k) => sessionStorage.removeItem(k));
  UNLOCK_KEYS.forEach((k) => sessionStorage.removeItem(k));
  PERSISTENT_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

// ─── Persistent storage helpers ───────────────────────────────────────────────

/**
 * Write a value that must survive app closure.
 */
export function persistValue(key, value) {
  localStorage.setItem(key, value);
}

/**
 * Read a value that was persisted across app closure.
 * Falls back to sessionStorage for values written before this migration.
 */
export function readPersisted(key) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? null;
}

/**
 * Check whether a resumable session exists.
 * True if a refresh token is stored in localStorage.
 */
export function hasResumableSession() {
  return !!localStorage.getItem("refreshToken");
}

/**
 * Check if there's an active session with access token
 */
export function hasActiveSession() {
  return !!sessionStorage.getItem("sessionToken") && hasResumableSession();
}