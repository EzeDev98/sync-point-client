import { base64ToBytes, bytesToBase64, encodeUtf8 } from './encoding.js';

/**
 * Key hierarchy for offline record encryption.
 *
 *   PIN ──PBKDF2──► KEK ──AES-KW──► wrapped DEK  (localStorage)
 *   DEK ──AES-GCM──► every stored record         (memory only)
 *
 * The PIN is the stable secret: unlike an access token it never rotates on
 * its own, so records stay readable across sessions. Wrapping the DEK rather
 * than deriving it from the PIN directly is what makes a PIN change cheap —
 * only the wrapper is redone, and existing records remain decryptable.
 *
 * The unwrapped DEK exists only in this module's memory and is never
 * exported. cipher.js reaches it through getDataKey().
 */

const KEK_ITERATIONS = 200_000;
const DEK_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 32;
const WRAPPED_DEK_STORAGE_KEY = 'wrappedDEK';
const KEK_SALT_STORAGE_KEY = 'kek_salt';

/**
 * ⚠️ LEGACY SALT — DELETE AFTER THE MIGRATION WINDOW CLOSES.
 *
 * Every install once derived its key-encryption key from this one constant.
 * Being identical across all users and devices, a single precomputed table
 * covered every account: with a four-digit PIN there are only 10,000
 * possibilities, and 200,000 iterations only slows that to hours.
 *
 * Installs now generate a random per-device salt. This constant survives
 * solely so an existing wrapped key can still be opened once, at which
 * point it is immediately re-wrapped under a fresh random salt (see
 * migrateLegacySalt below).
 *
 * Once enough time has passed that active devices have all unlocked at
 * least once, delete this constant and the legacy branch in readKekSalt().
 * Leaving it in place keeps the weak path alive indefinitely.
 */
const LEGACY_KEK_SALT = 'syncpoint-kek-salt-v1';

/** The unwrapped data key. Never leaves this module. */
let dataKey = null;

function readWrappedDek() {
  return (
    localStorage.getItem(WRAPPED_DEK_STORAGE_KEY) ??
    sessionStorage.getItem(WRAPPED_DEK_STORAGE_KEY)
  );
}

function writeWrappedDek(wrapped) {
  localStorage.setItem(WRAPPED_DEK_STORAGE_KEY, bytesToBase64(wrapped));
}

function createSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  localStorage.setItem(KEK_SALT_STORAGE_KEY, bytesToBase64(salt));
  return salt;
}

/**
 * Returns this device's salt, or the legacy constant when none is stored.
 *
 * A missing salt means the install predates the per-device scheme, so its
 * wrapped key can only be opened with the old constant.
 */
function readKekSalt() {
  const stored = localStorage.getItem(KEK_SALT_STORAGE_KEY);

  if (stored) return { salt: base64ToBytes(stored), isLegacy: false };

  return { salt: encodeUtf8(LEGACY_KEK_SALT), isLegacy: true };
}

/** Derives the key-encryption key from a PIN and salt. Pure — no state touched. */
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

/**
 * Re-wraps an already-unwrapped key under a fresh per-device salt.
 *
 * Runs once, right after a successful unlock on a pre-migration install.
 * The data key is unchanged, so every stored record stays readable — only
 * the wrapper is replaced. Deliberately best-effort: a device that fails
 * here keeps working on the legacy salt and retries at the next unlock,
 * because a failed migration must never cost the user access to their
 * records.
 */
async function migrateLegacySalt(pin, extractableDek) {
  try {
    const newKek = await deriveKek(pin, createSalt());
    writeWrappedDek(await crypto.subtle.wrapKey('raw', extractableDek, newKek, { name: 'AES-KW' }));
    console.log('[keyManager] Migrated to a per-device salt.');
  } catch (err) {
    localStorage.removeItem(KEK_SALT_STORAGE_KEY);
    console.warn('[keyManager] Salt migration failed, will retry next unlock:', err);
  }
}

function importDataKey(raw, { extractable = false } = {}) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Creates a fresh data key and wraps it under the PIN.
 *
 * Called when a PIN is first set and after a PIN reset. It generates a NEW
 * data key, so any records encrypted under a previous one become
 * unreadable — which is why the PIN-reset flow gates on there being no
 * unsynced transactions first.
 */
export async function initializeEncryption(pin) {
  if (!pin) {
    throw new Error('initializeEncryption: PIN is required.');
  }

  const rawDek = crypto.getRandomValues(new Uint8Array(DEK_LENGTH_BYTES));

  // Extractable only so it can be wrapped; the copy kept in memory below is
  // imported separately as non-extractable.
  const wrappable = await importDataKey(rawDek, { extractable: true });
  const kek = await deriveKek(pin, createSalt());

  writeWrappedDek(await crypto.subtle.wrapKey('raw', wrappable, kek, { name: 'AES-KW' }));

  dataKey = await importDataKey(rawDek);

  console.log('[keyManager] Encryption initialized.');
}

/**
 * Unwraps the stored data key using the PIN.
 *
 * Used on resume, when the wrapped key survived in storage but the
 * unwrapped one did not survive the page being closed.
 */
export async function restoreEncryption(pin) {
  const wrapped = readWrappedDek();

  if (!wrapped) {
    throw new Error('restoreEncryption: No wrapped key found — sign in again.');
  }

  const { salt, isLegacy } = readKekSalt();
  const kek = await deriveKek(pin, salt);

  // Extractable only on the legacy path, where it has to be re-wrapped.
  const unwrapped = await crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(wrapped),
    kek,
    { name: 'AES-KW' },
    { name: 'AES-GCM', length: 256 },
    isLegacy,
    ['encrypt', 'decrypt']
  );

  if (isLegacy) {
    await migrateLegacySalt(pin, unwrapped);
    // Re-import non-extractable before keeping it in memory.
    dataKey = await importDataKey(await crypto.subtle.exportKey('raw', unwrapped));
  } else {
    dataKey = unwrapped;
  }

  console.log('[keyManager] Encryption restored from PIN.');
}

/**
 * Re-wraps the existing data key under a new PIN, after the server has
 * accepted a PIN change.
 *
 * The data key itself is unchanged, so previously encrypted records stay
 * readable — only its wrapper changes. The unwrap doubles as a check on the
 * old PIN: deriveKek always succeeds since it is a pure derivation, but
 * AES-KW verifies an integrity tag, so a wrong old PIN fails here.
 */
export async function rotateEncryptionPin(oldPin, newPin) {
  const wrapped = readWrappedDek();

  if (!wrapped) {
    throw new Error('rotateEncryptionPin: No wrapped key found — sign in again.');
  }

  const { salt: currentSalt } = readKekSalt();
  const oldKek = await deriveKek(oldPin, currentSalt);
  let extractableDek;

  try {
    extractableDek = await crypto.subtle.unwrapKey(
      'raw',
      base64ToBytes(wrapped),
      oldKek,
      { name: 'AES-KW' },
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch {
    throw new Error('rotateEncryptionPin: Could not unwrap the local key with the old PIN.');
  }

  // A PIN change is a free opportunity to leave the legacy salt behind.
  const newKek = await deriveKek(newPin, createSalt());
  writeWrappedDek(await crypto.subtle.wrapKey('raw', extractableDek, newKek, { name: 'AES-KW' }));

  // Re-import non-extractable before keeping it in memory.
  dataKey = await importDataKey(await crypto.subtle.exportKey('raw', extractableDek));

  console.log('[keyManager] Key rewrapped after PIN change.');
}

export function isEncryptionReady() {
  return dataKey !== null;
}

/** Internal accessor for cipher.js. Not part of the public surface. */
export function getDataKey() {
  return dataKey;
}

/**
 * Drops the in-memory key and the wrapped copy.
 *
 * This makes every stored record permanently unreadable, so it belongs only
 * in sign-out and hard-reset paths — never in a lock or a resume.
 */
export function clearEncryptionKey() {
  dataKey = null;
  localStorage.removeItem(WRAPPED_DEK_STORAGE_KEY);
  localStorage.removeItem(KEK_SALT_STORAGE_KEY);
  sessionStorage.removeItem(WRAPPED_DEK_STORAGE_KEY);
  console.log('[keyManager] Encryption key cleared.');
}