// ============================================
// QUARANTINE SERVICE — SyncPoint
// When a refresh token dies (60-day idle limit), any local
// transaction/balance/PIN data on this device is preserved here —
// untouched, still encrypted — keyed by walletId, before the live
// session is wiped for the next login. Nothing is ever decrypted here.
// Restoring becomes possible only when the same account (same PIN)
// logs back in on this same device.
// ============================================

import { getAllRawRecords, restoreRawRecords, clearAllTransactions } from "./indexedDbService";
import { clearEncryptionKey } from "./cryptoService";

const QUARANTINE_DB_NAME = "syncpoint_quarantine_db";
const QUARANTINE_STORE_NAME = "quarantine";
const QUARANTINE_DB_VERSION = 1;

const PIN_DEK_KEYS = ["wrappedDEK", "pin_salt", "pin_verifier", "pin_verified_at"];

const ALL_PERSISTENT_KEYS = [
  "walletId", "userId", "phoneNumber", "username", "email",
  "userRefId", "firstName", "middleName", "lastName",
  "mirrorBalance", "notifications", ...PIN_DEK_KEYS,
];

function openQuarantineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUARANTINE_DB_NAME, QUARANTINE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(QUARANTINE_STORE_NAME)) {
        db.createObjectStore(QUARANTINE_STORE_NAME, { keyPath: "walletId" });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Called the moment a refresh token is found dead. Copies everything this
 * device holds for the current walletId — raw encrypted transaction
 * records, wrapped DEK, PIN verifier/salt, persisted profile fields,
 * mirror balance — into the quarantine DB, then wipes the live copies so
 * a fresh login can proceed on a clean slate. No-op if no walletId is
 * present.
 */
export async function quarantineAndWipeSession() {
  const walletId = localStorage.getItem("walletId");

  if (!walletId) {
    console.log("[Quarantine] No walletId present — nothing to quarantine.");
    return;
  }

  const rawRecords = await getAllRawRecords();

  const persistedData = {};
  for (const key of ALL_PERSISTENT_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) persistedData[key] = value;
  }

  const db = await openQuarantineDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUARANTINE_STORE_NAME, "readwrite");
    const store = tx.objectStore(QUARANTINE_STORE_NAME);
    const req = store.put({
      walletId,
      rawRecords,
      persistedData,
      quarantinedAt: new Date().toISOString(),
    });
    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });

  console.log(`[Quarantine] Preserved ${rawRecords.length} record(s) for walletId ${walletId}.`);

  await clearAllTransactions();
  clearEncryptionKey(); // clears in-memory DEK + wrappedDEK from storage

  for (const key of ALL_PERSISTENT_KEYS) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("refreshTokenExpiresIn");
  localStorage.removeItem("tokenIssuedAt");
  sessionStorage.clear();

  console.log("[Quarantine] Live session wiped. Ready for fresh login.");
}

/**
 * Called right after a fresh successful login. Checks whether this
 * walletId has quarantined data waiting on this device. If so, restores
 * the raw transaction records and PIN/DEK material, then clears the
 * quarantine entry (the data now lives in the live store).
 *
 * Returns true if a restore happened (caller should trigger a sync before
 * letting the user reach the dashboard), false otherwise.
 */
export async function restoreQuarantineIfPresent(walletId) {
  const db = await openQuarantineDB();
  const entry = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUARANTINE_STORE_NAME, "readonly");
    const store = tx.objectStore(QUARANTINE_STORE_NAME);
    const req = store.get(walletId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (event) => reject(event.target.error);
  });

  if (!entry) return false;

  await restoreRawRecords(entry.rawRecords);

  for (const key of PIN_DEK_KEYS) {
    if (entry.persistedData[key] !== undefined) {
      localStorage.setItem(key, entry.persistedData[key]);
    }
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUARANTINE_STORE_NAME, "readwrite");
    const store = tx.objectStore(QUARANTINE_STORE_NAME);
    const req = store.delete(walletId);
    req.onsuccess = () => resolve();
    req.onerror = (event) => reject(event.target.error);
  });

  console.log(`[Quarantine] Restored ${entry.rawRecords.length} record(s) for walletId ${walletId}.`);
  return true;
}