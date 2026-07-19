// ============================================
// CRYPTO SERVICE — SyncPoint
// DEK-based AES-GCM encryption for IndexedDB
//
// Key hierarchy (revised):
//   User PIN ──PBKDF2──► KEK (Key Encryption Key)
//   Random 256-bit DEK ──wrapped with KEK──► wrappedDEK (localStorage)
//   DEK ──AES-GCM──► every IndexedDB record
//
// The PIN is the stable secret — unlike access tokens, it never rotates.
// The raw DEK lives ONLY in this module's memory (_dek).
// ============================================

let _dek = null;

async function deriveKEK(pin) {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
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

/**
 * Initialize encryption on first login or after PIN is set.
 * Call with the user's PIN immediately after login succeeds.
 *
 * @param {string} pin — the user's 4-digit transaction PIN
 */
export async function initializeEncryption(pin) {
  if (!pin) {
    throw new Error("initializeEncryption: PIN is required.");
  }

  const rawDEK = crypto.getRandomValues(new Uint8Array(32));

  const dekKey = await crypto.subtle.importKey(
    "raw",
    rawDEK,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const kek = await deriveKEK(pin);

  const wrappedDEK = await crypto.subtle.wrapKey("raw", dekKey, kek, {
    name: "AES-KW",
  });

  // Persist to localStorage — survives app closure
  localStorage.setItem(
    "wrappedDEK",
    btoa(String.fromCharCode(...new Uint8Array(wrappedDEK)))
  );

  _dek = await crypto.subtle.importKey(
    "raw",
    rawDEK,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  console.log("[CryptoService] Encryption initialized.");
}

/**
 * Restore the DEK after app closure or page reload.
 * Call during PIN verification with the PIN the user just entered.
 *
 * @param {string} pin — the PIN the user entered on the PIN screen
 */
export async function restoreEncryption(pin) {
  const wrappedDEKBase64 =
    localStorage.getItem("wrappedDEK") ?? sessionStorage.getItem("wrappedDEK");

  if (!wrappedDEKBase64) {
    throw new Error(
      "restoreEncryption: No wrapped DEK found — user must log in again."
    );
  }

  const wrappedDEK = Uint8Array.from(atob(wrappedDEKBase64), (c) =>
    c.charCodeAt(0)
  );

  const kek = await deriveKEK(pin);

  _dek = await crypto.subtle.unwrapKey(
    "raw",
    wrappedDEK,
    kek,
    { name: "AES-KW" },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  console.log("[CryptoService] Encryption restored from PIN.");
}

/**
 * Rotate the PIN used to protect the local DEK, after a successful
 * server-side PIN change. Unwraps the existing wrappedDEK with the OLD
 * PIN's KEK, then re-wraps the same underlying DEK bytes with the NEW
 * PIN's KEK. The DEK itself never changes, so previously encrypted
 * records remain decryptable — only the PIN protecting it changes.
 *
 * The unwrap step doubles as an integrity check on the old PIN: if it's
 * wrong, deriveKEK still succeeds (it's a pure derivation), but the
 * AES-KW unwrap will throw because the wrapped key's integrity tag won't
 * match — so a bad old PIN surfaces here as a thrown error.
 *
 * @param {string} oldPin — the PIN currently protecting the local DEK
 * @param {string} newPin — the PIN to protect it with going forward
 */
export async function rotateEncryptionPin(oldPin, newPin) {
  const wrappedDEKBase64 =
    localStorage.getItem("wrappedDEK") ?? sessionStorage.getItem("wrappedDEK");

  if (!wrappedDEKBase64) {
    throw new Error(
      "rotateEncryptionPin: No wrapped DEK found — user must log in again."
    );
  }

  const wrappedDEK = Uint8Array.from(atob(wrappedDEKBase64), (c) =>
    c.charCodeAt(0)
  );

  const oldKek = await deriveKEK(oldPin);

  let extractableDek;
  try {
    // Extractable here ONLY so it can be re-wrapped under the new KEK below —
    // it is re-imported as non-extractable before being kept in memory.
    extractableDek = await crypto.subtle.unwrapKey(
      "raw",
      wrappedDEK,
      oldKek,
      { name: "AES-KW" },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  } catch {
    throw new Error(
      "rotateEncryptionPin: Could not unwrap local key with the old PIN."
    );
  }

  const newKek = await deriveKEK(newPin);

  const rewrapped = await crypto.subtle.wrapKey("raw", extractableDek, newKek, {
    name: "AES-KW",
  });

  localStorage.setItem(
    "wrappedDEK",
    btoa(String.fromCharCode(...new Uint8Array(rewrapped)))
  );

  const rawDek = await crypto.subtle.exportKey("raw", extractableDek);
  _dek = await crypto.subtle.importKey(
    "raw",
    rawDek,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  console.log("[CryptoService] Encryption key rewrapped after PIN change.");
}

export function isEncryptionReady() {
  return _dek !== null;
}

export function clearEncryptionKey() {
  _dek = null;
  localStorage.removeItem("wrappedDEK");
  sessionStorage.removeItem("wrappedDEK");
  console.log("[CryptoService] Encryption key cleared.");
}

export async function encryptData(payload) {
  if (!_dek) {
    throw new Error(
      "[CryptoService] DEK not available. Call initializeEncryption or restoreEncryption first."
    );
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
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



// // ============================================
// // CRYPTO SERVICE — SyncPoint
// // DEK-based AES-GCM encryption for IndexedDB
// //
// // Key hierarchy (revised):
// //   User PIN ──PBKDF2──► KEK (Key Encryption Key)
// //   Random 256-bit DEK ──wrapped with KEK──► wrappedDEK (localStorage)
// //   DEK ──AES-GCM──► every IndexedDB record
// //
// // The PIN is the stable secret — unlike access tokens, it never rotates.
// // The raw DEK lives ONLY in this module's memory (_dek).
// // ============================================

// let _dek = null;

// async function deriveKEK(pin) {
//   const encoder = new TextEncoder();

//   const keyMaterial = await crypto.subtle.importKey(
//     "raw",
//     encoder.encode(pin),
//     "PBKDF2",
//     false,
//     ["deriveKey"]
//   );

//   return crypto.subtle.deriveKey(
//     {
//       name: "PBKDF2",
//       salt: encoder.encode("syncpoint-kek-salt-v1"),
//       iterations: 200000,
//       hash: "SHA-256",
//     },
//     keyMaterial,
//     { name: "AES-KW", length: 256 },
//     false,
//     ["wrapKey", "unwrapKey"]
//   );
// }

// /**
//  * Initialize encryption on first login or after PIN is set.
//  * Call with the user's PIN immediately after login succeeds.
//  *
//  * @param {string} pin — the user's 4-digit transaction PIN
//  */
// export async function initializeEncryption(pin) {
//   if (!pin) {
//     throw new Error("initializeEncryption: PIN is required.");
//   }

//   const rawDEK = crypto.getRandomValues(new Uint8Array(32));

//   const dekKey = await crypto.subtle.importKey(
//     "raw",
//     rawDEK,
//     { name: "AES-GCM", length: 256 },
//     true,
//     ["encrypt", "decrypt"]
//   );

//   const kek = await deriveKEK(pin);

//   const wrappedDEK = await crypto.subtle.wrapKey("raw", dekKey, kek, {
//     name: "AES-KW",
//   });

//   // Persist to localStorage — survives app closure
//   localStorage.setItem(
//     "wrappedDEK",
//     btoa(String.fromCharCode(...new Uint8Array(wrappedDEK)))
//   );

//   _dek = await crypto.subtle.importKey(
//     "raw",
//     rawDEK,
//     { name: "AES-GCM", length: 256 },
//     false,
//     ["encrypt", "decrypt"]
//   );

//   console.log("[CryptoService] Encryption initialized.");
// }

// /**
//  * Restore the DEK after app closure or page reload.
//  * Call during PIN verification with the PIN the user just entered.
//  *
//  * @param {string} pin — the PIN the user entered on the PIN screen
//  */
// export async function restoreEncryption(pin) {
//   const wrappedDEKBase64 =
//     localStorage.getItem("wrappedDEK") ?? sessionStorage.getItem("wrappedDEK");

//   if (!wrappedDEKBase64) {
//     throw new Error(
//       "restoreEncryption: No wrapped DEK found — user must log in again."
//     );
//   }

//   const wrappedDEK = Uint8Array.from(atob(wrappedDEKBase64), (c) =>
//     c.charCodeAt(0)
//   );

//   const kek = await deriveKEK(pin);

//   _dek = await crypto.subtle.unwrapKey(
//     "raw",
//     wrappedDEK,
//     kek,
//     { name: "AES-KW" },
//     { name: "AES-GCM", length: 256 },
//     false,
//     ["encrypt", "decrypt"]
//   );

//   console.log("[CryptoService] Encryption restored from PIN.");
// }

// export function isEncryptionReady() {
//   return _dek !== null;
// }

// export function clearEncryptionKey() {
//   _dek = null;
//   localStorage.removeItem("wrappedDEK");
//   sessionStorage.removeItem("wrappedDEK");
//   console.log("[CryptoService] Encryption key cleared.");
// }

// export async function encryptData(payload) {
//   if (!_dek) {
//     throw new Error(
//       "[CryptoService] DEK not available. Call initializeEncryption or restoreEncryption first."
//     );
//   }

//   const iv = crypto.getRandomValues(new Uint8Array(12));
//   const encoded = new TextEncoder().encode(JSON.stringify(payload));

//   const ciphertext = await crypto.subtle.encrypt(
//     { name: "AES-GCM", iv },
//     _dek,
//     encoded
//   );

//   return {
//     iv: btoa(String.fromCharCode(...iv)),
//     data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
//   };
// }

// export async function decryptData(encryptedData, iv) {
//   if (!_dek) {
//     throw new Error(
//       "[CryptoService] DEK not available. Call initializeEncryption or restoreEncryption first."
//     );
//   }

//   const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
//   const cipherBytes = Uint8Array.from(atob(encryptedData), (c) =>
//     c.charCodeAt(0)
//   );

//   const decrypted = await crypto.subtle.decrypt(
//     { name: "AES-GCM", iv: ivBytes },
//     _dek,
//     cipherBytes
//   );

//   return JSON.parse(new TextDecoder().decode(decrypted));
// }