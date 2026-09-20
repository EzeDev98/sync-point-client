import { clearAllTransactions } from '@core/db/transactionRepository';
import { getAllRawRecords, restoreRawRecords } from '@core/db/backupRepository';
import {
  deleteQuarantineEntry,
  getQuarantineEntry,
  saveQuarantineEntry,
} from '@core/db/quarantineStore';
import { clearEncryptionKey } from '@core/crypto/keyManager';

/**
 * Preserves a device's local data when a session ends involuntarily.
 *
 * When a refresh token dies at the idle limit, the user still has encrypted
 * transactions and a wrapped key on this device. Wiping them outright would
 * destroy unsynced money. Everything is copied aside untouched — still
 * encrypted, nothing decrypted here — keyed by wallet, so the same account
 * signing back in on the same device gets it all back.
 */

/** Key material that makes the quarantined records readable again. */
const KEY_MATERIAL_KEYS = ['wrappedDEK', 'kek_salt', 'pin_salt', 'pin_verifier', 'pin_verified_at'];

const PRESERVED_KEYS = [
  'walletId',
  'userId',
  'phoneNumber',
  'username',
  'email',
  'userRefId',
  'firstName',
  'middleName',
  'lastName',
  'mirrorBalance',
  'notifications',
  ...KEY_MATERIAL_KEYS,
];

const SESSION_KEYS = ['refreshToken', 'refreshTokenExpiresIn', 'tokenIssuedAt'];

export async function quarantineAndWipeSession() {
  const walletId = localStorage.getItem('walletId');

  if (!walletId) {
    console.log('[quarantine] No walletId — nothing to preserve.');
    return;
  }

  const rawRecords = await getAllRawRecords();

  const persistedData = {};
  for (const key of PRESERVED_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) persistedData[key] = value;
  }

  await saveQuarantineEntry({
    walletId,
    rawRecords,
    persistedData,
    quarantinedAt: new Date().toISOString(),
  });

  console.log(`[quarantine] Preserved ${rawRecords.length} record(s) for ${walletId}.`);

  // Only now that the copy is committed is it safe to wipe the live session.
  await clearAllTransactions();
  clearEncryptionKey();

  for (const key of [...PRESERVED_KEYS, ...SESSION_KEYS]) {
    localStorage.removeItem(key);
  }
  sessionStorage.clear();

  console.log('[quarantine] Live session wiped — ready for a fresh sign-in.');
}

/**
 * Restores preserved data after a successful sign-in on the same device.
 *
 * Returns true when a restore happened, so the caller knows to sync before
 * letting the user reach the dashboard.
 */
export async function restoreQuarantineIfPresent(walletId) {
  const entry = await getQuarantineEntry(walletId);
  if (!entry) return false;

  await restoreRawRecords(entry.rawRecords);

  // Only the key material is restored. Profile fields come from the fresh
  // sign-in response, which is authoritative and may have changed.
  for (const key of KEY_MATERIAL_KEYS) {
    if (entry.persistedData[key] !== undefined) {
      localStorage.setItem(key, entry.persistedData[key]);
    }
  }

  await deleteQuarantineEntry(walletId);

  console.log(`[quarantine] Restored ${entry.rawRecords.length} record(s) for ${walletId}.`);
  return true;
}