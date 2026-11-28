// Stores and checks the offline PIN verifier.
import { base64ToBytes, bytesToBase64, encodeUtf8 } from './encoding.js';

const PBKDF2_ITERATIONS = 600_000;
const DERIVED_BITS = 256;
const SALT_LENGTH_BYTES = 32;

const SALT_STORAGE_KEY = 'pin_salt';
const VERIFIER_STORAGE_KEY = 'pin_verifier';
const VERIFIED_AT_STORAGE_KEY = 'pin_verified_at';

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

export async function saveOfflinePinVerifier(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const verifier = await deriveVerifier(pin, salt);

  localStorage.setItem(SALT_STORAGE_KEY, bytesToBase64(salt));
  localStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  localStorage.setItem(VERIFIED_AT_STORAGE_KEY, Date.now().toString());
}

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
