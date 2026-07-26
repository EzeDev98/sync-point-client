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

/**
 * Enrollment and use of the device's offline-transfer signing key.
 *
 * A transfer is only settleable if the server holds the sender's public key,
 * so "enrolled" means both halves are in place: a keypair on the device AND
 * its public key registered server-side. The login flow calls
 * {@link ensureSigningKeyEnrolled} proactively; the send flow calls it again
 * as a hard gate before signing, so a device that logged in offline (or whose
 * first login predated this feature) still registers the moment it tries to
 * pay online.
 */

/**
 * Ensures this device has a signing keypair and that its public key is
 * registered with the server. Idempotent and best-effort — it never throws,
 * so it is safe to fire on the sign-in path without risking the sign-in.
 *
 * @returns {Promise<boolean>} true only when the key is stored AND confirmed
 *   registered. The send path uses this to refuse a transfer the server would
 *   later be unable to verify.
 */
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
    // Almost always a transient network failure during registration. The
    // local key is kept, so a later attempt just re-registers it.
    console.warn('[signingKey] Enrollment could not complete (will retry):', err);
    return false;
  }
}

/**
 * Signs a transfer with the device key, ensuring enrollment first.
 *
 * Throws rather than returning an unusable result: a transfer that cannot be
 * signed, or that is signed by a key the server has never accepted, could
 * never be settled — so the send flow must stop here instead of queuing a
 * transfer that will be rejected forever.
 *
 * @param fields transactionRef, requestRef, senderWalletId, receiverWalletId,
 *               amount, currency, createdAt
 * @returns {Promise<string>} base64 signature
 */
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

/** Removes the device signing key. Called on full sign-out. */
export async function clearSigningKey() {
  await clearStoredSigningKey();
}