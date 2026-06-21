// ============================================
// CRYPTO SERVICE — SyncPoint
// DEK-based AES-GCM encryption for IndexedDB
//
// Key hierarchy:
//   Session Token ──PBKDF2──► KEK (Key Encryption Key)
//   Random 256-bit DEK ──wrapped with KEK──► wrappedDEK (sessionStorage)
//   DEK ──AES-GCM──► every IndexedDB record
//
// The raw DEK lives ONLY in this module's memory (_dek).
// It is never written to IndexedDB or localStorage.
// sessionStorage holds only the KEK-wrapped form of the DEK.
// ============================================

// Module-scoped DEK — cleared on logout or page unload
let _dek = null;

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/**
 * Derive a KEK from the session token using PBKDF2.
 * The salt is fixed and app-specific — security comes from the session token.
 */
async function deriveKEK(sessionToken) {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionToken),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("syncpoint-kek-salt-v1"),
      iterations: 200000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

// ─────────────────────────────────────────────
// PUBLIC API — LIFECYCLE
// ─────────────────────────────────────────────

/**
 * Initialize encryption for a new login session.
 *
 * Call immediately after the server returns a session token on login.
 * Generates a fresh random DEK, wraps it with a KEK derived from the
 * session token, and stores the wrapped form in sessionStorage.
 *
 * @param {string} sessionToken — server-issued session token
 */
export async function initializeEncryption(sessionToken) {
  if (!sessionToken) {
    throw new Error("initializeEncryption: sessionToken is required.");
  }

  // 1. Generate fresh random 256-bit DEK
  const rawDEK = crypto.getRandomValues(new Uint8Array(32));

  // 2. Import raw bytes as extractable CryptoKey (must be extractable to wrap)
  const dekKey = await crypto.subtle.importKey(
    "raw",
    rawDEK,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 3. Derive KEK from session token
  const kek = await deriveKEK(sessionToken);

  // 4. Wrap DEK with KEK using AES-KW
  const wrappedDEK = await crypto.subtle.wrapKey("raw", dekKey, kek, {
    name: "AES-KW",
  });

  // 5. Persist wrapped DEK to sessionStorage (safe — it's encrypted)
  sessionStorage.setItem(
    "wrappedDEK",
    btoa(String.fromCharCode(...new Uint8Array(wrappedDEK)))
  );

  // 6. Hold the unwrapped DEK in memory only — non-extractable from here
  _dek = await crypto.subtle.importKey(
    "raw",
    rawDEK,
    { name: "AES-GCM", length: 256 },
    false, // not extractable after use
    ["encrypt", "decrypt"]
  );

  console.log("[CryptoService] Encryption initialized.");
}

/**
 * Restore the DEK after a page reload within the same session.
 *
 * Call on app boot if wrappedDEK exists in sessionStorage.
 * Requires the same session token used during initializeEncryption.
 *
 * @param {string} sessionToken
 */
export async function restoreEncryption(sessionToken) {
  const wrappedDEKBase64 = sessionStorage.getItem("wrappedDEK");

  if (!wrappedDEKBase64) {
    throw new Error(
      "restoreEncryption: No wrapped DEK in session — user must log in again."
    );
  }

  const wrappedDEK = Uint8Array.from(atob(wrappedDEKBase64), (c) =>
    c.charCodeAt(0)
  );

  const kek = await deriveKEK(sessionToken);

  _dek = await crypto.subtle.unwrapKey(
    "raw",
    wrappedDEK,
    kek,
    { name: "AES-KW" },
    { name: "AES-GCM", length: 256 },
    false, // not extractable after restore
    ["encrypt", "decrypt"]
  );

  console.log("[CryptoService] Encryption restored from session.");
}

/**
 * Returns true if the DEK is loaded in memory and ready for use.
 */
export function isEncryptionReady() {
  return _dek !== null;
}

/**
 * Clear the DEK from memory and remove the wrapped DEK from sessionStorage.
 * Call on logout.
 */
export function clearEncryptionKey() {
  _dek = null;
  sessionStorage.removeItem("wrappedDEK");
  console.log("[CryptoService] Encryption key cleared.");
}

// ─────────────────────────────────────────────
// PUBLIC API — ENCRYPT / DECRYPT
// ─────────────────────────────────────────────

/**
 * Encrypt a plain JavaScript object using AES-GCM with the session DEK.
 *
 * A fresh 96-bit IV is generated per record — IVs must never be reused
 * with the same key under AES-GCM.
 *
 * @param {object} payload — the object to encrypt
 * @returns {{ iv: string, data: string }} — base64-encoded IV and ciphertext
 */
export async function encryptData(payload) {
  if (!_dek) {
    throw new Error(
      "[CryptoService] DEK not available. Call initializeEncryption or restoreEncryption first."
    );
  }

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(JSON.stringify(payload));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    _dek,
    encoded
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypt an IndexedDB record using the session DEK.
 *
 * @param {string} encryptedData — base64-encoded ciphertext
 * @param {string} iv — base64-encoded IV used during encryption
 * @returns {object} — decrypted payload
 */
export async function decryptData(encryptedData, iv) {
  if (!_dek) {
    throw new Error(
      "[CryptoService] DEK not available. Call initializeEncryption or restoreEncryption first."
    );
  }

  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const cipherBytes = Uint8Array.from(atob(encryptedData), (c) =>
    c.charCodeAt(0)
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    _dek,
    cipherBytes
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}