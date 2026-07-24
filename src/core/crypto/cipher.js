import { base64ToBytes, bytesToBase64, decodeUtf8, encodeUtf8 } from './encoding.js';
import { getDataKey, isEncryptionReady } from './keyManager.js';

/**
 * AES-GCM encryption of record payloads.
 *
 * Separate from keyManager on purpose: this module knows how to encrypt, not
 * how keys come to exist. Every call reads the current key rather than
 * capturing it, so a PIN rotation takes effect immediately.
 */

const IV_LENGTH_BYTES = 12;

function requireDataKey() {
  const key = getDataKey();

  if (!key) {
    throw new Error(
      'Encryption key is not available. Call initializeEncryption or restoreEncryption first.'
    );
  }

  return key;
}

/**
 * A fresh IV per record is mandatory, not incidental: reusing one under the
 * same key breaks AES-GCM's confidentiality and authentication outright.
 */
export async function encryptData(payload) {
  const key = requireDataKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodeUtf8(JSON.stringify(payload))
  );

  return {
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

/**
 * Throws when the ciphertext has been tampered with or the key is wrong —
 * AES-GCM verifies an authentication tag, so a failure here is meaningful
 * rather than garbage output. Callers treat it as record corruption.
 */
export async function decryptData(encryptedData, iv) {
  const key = requireDataKey();

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encryptedData)
  );

  return JSON.parse(decodeUtf8(plaintext));
}

export { isEncryptionReady };