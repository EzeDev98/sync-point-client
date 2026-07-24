import { base64ToBytes, bytesToBase64, encodeUtf8 } from './encoding.js';

/**
 * Offline PIN verification — both sides of it.
 *
 * The read side was written out three times: inline in PinVerification.jsx
 * and again in SendMoney.jsx, plus a third partial copy in the send flow's
 * retry path. The write side lived in a separate savePinVerifier.js that
 * repeated the same derivation a fourth time. One derivation now serves
 * both, which is what guarantees they cannot drift apart — if the iteration
 * count or hash ever disagreed between save and verify, every unlock would
 * silently fail.
 *
 * Note this uses a per-device random salt, unlike keyManager's fixed one.
 */

const PBKDF2_ITERATIONS = 600_000;
const DERIVED_BITS = 256;
const SALT_LENGTH_BYTES = 32;

const SALT_STORAGE_KEY = 'pin_salt';
const VERIFIER_STORAGE_KEY = 'pin_verifier';
const VERIFIED_AT_STORAGE_KEY = 'pin_verified_at';

/** Derives the verifier for a PIN against a given salt. */
async function deriveVerifier(pin, salt) {
  const baseKey = await crypto.subtle.importKey('raw', encodeUtf8(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    DERIVED_BITS
  );

  return bytesToBase64(derivedBits);
}

/**
 * Stores a verifier for the PIN so it can be checked with no network.
 *
 * A fresh salt each time is deliberate: re-running this after a PIN change
 * must not produce a verifier an observer could compare against the old one.
 */
export async function saveOfflinePinVerifier(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const verifier = await deriveVerifier(pin, salt);

  localStorage.setItem(SALT_STORAGE_KEY, bytesToBase64(salt));
  localStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  localStorage.setItem(VERIFIED_AT_STORAGE_KEY, Date.now().toString());
}

/**
 * Returns true when the PIN matches the verifier stored on this device.
 *
 * Fails closed: with no salt or no verifier there is nothing to check
 * against, so verification is refused rather than assumed.
 */
export async function verifyOfflinePin(pin) {
  const storedSalt = localStorage.getItem(SALT_STORAGE_KEY);
  const storedVerifier = localStorage.getItem(VERIFIER_STORAGE_KEY);

  if (!storedSalt || !storedVerifier) return false;

  const verifier = await deriveVerifier(pin, base64ToBytes(storedSalt));

  return verifier === storedVerifier;
}

export function hasOfflinePinVerifier() {
  return Boolean(
    localStorage.getItem(SALT_STORAGE_KEY) && localStorage.getItem(VERIFIER_STORAGE_KEY)
  );
}