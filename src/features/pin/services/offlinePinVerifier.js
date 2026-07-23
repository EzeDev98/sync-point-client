/**
 * Offline PIN verification.
 *
 * This was defined inline inside PinVerification.jsx — roughly forty lines of
 * PBKDF2 in the middle of a component. It is security-critical and has no
 * dependency on React, so it belongs in a module of its own.
 *
 * The check is a comparison against a locally stored verifier derived from
 * the PIN, which is what lets the wallet unlock with no network available.
 */

const PBKDF2_ITERATIONS = 600_000;
const DERIVED_BITS = 256;
const SALT_STORAGE_KEY = 'pin_salt';
const VERIFIER_STORAGE_KEY = 'pin_verifier';

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/** Derives the verifier for a PIN against a known salt. */
async function deriveVerifier(pin, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    DERIVED_BITS
  );

  return bytesToBase64(derivedBits);
}

/**
 * Returns true when the PIN matches the verifier stored on this device.
 *
 * Fails closed: if either the salt or the verifier is missing there is
 * nothing to check against, so verification is refused rather than assumed.
 */
export async function verifyOfflinePin(pin) {
  const storedSalt = localStorage.getItem(SALT_STORAGE_KEY);
  const storedVerifier = localStorage.getItem(VERIFIER_STORAGE_KEY);

  if (!storedSalt || !storedVerifier) return false;

  const verifier = await deriveVerifier(pin, base64ToBytes(storedSalt));

  return verifier === storedVerifier;
}