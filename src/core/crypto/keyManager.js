// PIN-derived key hierarchy that wraps and unwraps the record encryption key.
import { base64ToBytes, bytesToBase64, encodeUtf8 } from './encoding.js';

const KEK_ITERATIONS = 200_000;
const DEK_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 32;
const WRAPPED_DEK_STORAGE_KEY = 'wrappedDEK';
const KEK_SALT_STORAGE_KEY = 'kek_salt';

const LEGACY_KEK_SALT = 'syncpoint-kek-salt-v1';

let dataKey = null;

function readWrappedDek() {
  return (
    localStorage.getItem(WRAPPED_DEK_STORAGE_KEY) ??
    sessionStorage.getItem(WRAPPED_DEK_STORAGE_KEY)
  );
}

const WRAPPED_V2_PREFIX = 'v2:';

function writeWrappedDek(wrapped, salt) {
  localStorage.setItem(
    WRAPPED_DEK_STORAGE_KEY,
    `${WRAPPED_V2_PREFIX}${bytesToBase64(salt)}:${bytesToBase64(wrapped)}`
  );
  localStorage.removeItem(KEK_SALT_STORAGE_KEY);
}

function createSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

function readKeyMaterial() {
  const stored = readWrappedDek();
  if (!stored) return null;

  if (stored.startsWith(WRAPPED_V2_PREFIX)) {
    const [saltB64, wrappedB64] = stored.slice(WRAPPED_V2_PREFIX.length).split(':');
    return {
      wrapped: base64ToBytes(wrappedB64),
      salt: base64ToBytes(saltB64),
      needsMigration: false,
    };
  }

  const separateSalt = localStorage.getItem(KEK_SALT_STORAGE_KEY);
  return {
    wrapped: base64ToBytes(stored),
    salt: separateSalt ? base64ToBytes(separateSalt) : encodeUtf8(LEGACY_KEK_SALT),
    needsMigration: true,
  };
}

async function deriveKek(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KEK_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

async function migrateLegacySalt(pin, extractableDek) {
  try {
    const salt = createSalt();
    const newKek = await deriveKek(pin, salt);
    writeWrappedDek(await crypto.subtle.wrapKey('raw', extractableDek, newKek, { name: 'AES-KW' }), salt);
    console.log('[keyManager] Migrated to a bundled per-device salt.');
  } catch (err) {
    console.warn('[keyManager] Salt migration failed, will retry next unlock:', err);
  }
}

function importDataKey(raw, { extractable = false } = {}) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}

export async function initializeEncryption(pin) {
  if (!pin) {
    throw new Error('initializeEncryption: PIN is required.');
  }

  const rawDek = crypto.getRandomValues(new Uint8Array(DEK_LENGTH_BYTES));

  const wrappable = await importDataKey(rawDek, { extractable: true });
  const salt = createSalt();
  const kek = await deriveKek(pin, salt);

  writeWrappedDek(await crypto.subtle.wrapKey('raw', wrappable, kek, { name: 'AES-KW' }), salt);

  dataKey = await importDataKey(rawDek);

  console.log('[keyManager] Encryption initialized.');
}

export async function restoreEncryption(pin) {
  const material = readKeyMaterial();

  if (!material) {
    throw new Error('restoreEncryption: No wrapped key found — sign in again.');
  }

  const kek = await deriveKek(pin, material.salt);

  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    material.wrapped,
    kek,
    { name: 'AES-KW' },
    { name: 'AES-GCM', length: 256 },
    material.needsMigration,
    ['encrypt', 'decrypt']
  );

  if (material.needsMigration) {
    await migrateLegacySalt(pin, unwrapped);
    dataKey = await importDataKey(await crypto.subtle.exportKey('raw', unwrapped));
  } else {
    dataKey = unwrapped;
  }

  console.log('[keyManager] Encryption restored from PIN.');
}

export async function rotateEncryptionPin(oldPin, newPin) {
  const material = readKeyMaterial();

  if (!material) {
    throw new Error('rotateEncryptionPin: No wrapped key found — sign in again.');
  }

  const oldKek = await deriveKek(oldPin, material.salt);
  let extractableDek;

  try {
    extractableDek = await crypto.subtle.unwrapKey(
      'raw',
      material.wrapped,
      oldKek,
      { name: 'AES-KW' },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch {
    throw new Error('rotateEncryptionPin: Could not unwrap the local key with the old PIN.');
  }

  const newSalt = createSalt();
  const newKek = await deriveKek(newPin, newSalt);
  writeWrappedDek(await crypto.subtle.wrapKey('raw', extractableDek, newKek, { name: 'AES-KW' }), newSalt);

  dataKey = await importDataKey(await crypto.subtle.exportKey('raw', extractableDek));

  console.log('[keyManager] Key rewrapped after PIN change.');
}

export function isEncryptionReady() {
  return dataKey !== null;
}

export function getDataKey() {
  return dataKey;
}

export function clearEncryptionKey() {
  dataKey = null;
  localStorage.removeItem(WRAPPED_DEK_STORAGE_KEY);
  localStorage.removeItem(KEK_SALT_STORAGE_KEY);
  sessionStorage.removeItem(WRAPPED_DEK_STORAGE_KEY);
  console.log('[keyManager] Encryption key cleared.');
}
