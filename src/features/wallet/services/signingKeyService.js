// Creates the device signing key and enrols its public key with the server.
import {
  generateTransferKeypair,
  exportPublicKeyBase64,
  signTransfer,
} from '@core/crypto/transferSignature';
import {
  loadSigningKeyRecord,
  saveSigningKeyRecord,
  markSigningKeyRegistered,
  clearSigningKey as clearStoredSigningKey,
} from '@core/crypto/signingKeyStore';
import { registerSigningKey } from '@features/wallet/api/signingKeyApi';

export async function ensureSigningKeyEnrolled() {
  try {
    let record = await loadSigningKeyRecord();

    if (!record || !record.privateKey) {
      const keyPair = await generateTransferKeypair();
      record = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        registered: false,
      };
      await saveSigningKeyRecord(record);
    }

    if (record.registered) return true;

    const publicKeyBase64 = await exportPublicKeyBase64(record.publicKey);
    await registerSigningKey(publicKeyBase64);
    await markSigningKeyRegistered();
    return true;
  } catch (err) {
    console.warn('[signingKey] Enrollment could not complete (will retry):', err);
    return false;
  }
}

export async function signTransferWithDeviceKey(fields) {
  const enrolled = await ensureSigningKeyEnrolled();
  const record = await loadSigningKeyRecord();

  if (!record || !record.privateKey) {
    throw new Error(
      'This device is not set up for offline payments yet. Connect to the internet and try again.'
    );
  }
  if (!enrolled) {
    throw new Error(
      'Your device could not be registered for offline payments. Connect to the internet and try again.'
    );
  }

  return signTransfer(record.privateKey, fields);
}

export async function clearSigningKey() {
  await clearStoredSigningKey();
}
