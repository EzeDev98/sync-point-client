// Preserves local data when a session ends involuntarily, and restores it on next sign-in.
import { clearAllTransactions } from '@core/db/transactionRepository';
import { getAllRawRecords, restoreRawRecords } from '@core/db/backupRepository';
import {
  deleteQuarantineEntry,
  getQuarantineEntry,
  saveQuarantineEntry,
} from '@core/db/quarantineStore';
import { clearEncryptionKey } from '@core/crypto/keyManager';

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

  await clearAllTransactions();
  clearEncryptionKey();

  for (const key of [...PRESERVED_KEYS, ...SESSION_KEYS]) {
    localStorage.removeItem(key);
  }
  sessionStorage.clear();

  console.log('[quarantine] Live session wiped — ready for a fresh sign-in.');
}

export async function restoreQuarantineIfPresent(walletId) {
  const entry = await getQuarantineEntry(walletId);
  if (!entry) return false;

  await restoreRawRecords(entry.rawRecords);

  if (entry.persistedData.wrappedDEK !== undefined) {
    localStorage.removeItem('kek_salt');
  }

  for (const key of KEY_MATERIAL_KEYS) {
    if (entry.persistedData[key] !== undefined) {
      localStorage.setItem(key, entry.persistedData[key]);
    }
  }

  await deleteQuarantineEntry(walletId);

  console.log(`[quarantine] Restored ${entry.rawRecords.length} record(s) for ${walletId}.`);
  return true;
}
