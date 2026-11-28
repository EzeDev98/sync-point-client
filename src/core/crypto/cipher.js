// AES-GCM encryption and decryption of stored record payloads.
import { base64ToBytes, bytesToBase64, decodeUtf8, encodeUtf8 } from './encoding.js';
import { getDataKey, isEncryptionReady } from './keyManager.js';

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
