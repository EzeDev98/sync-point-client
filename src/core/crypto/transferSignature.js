import { bytesToBase64, encodeUtf8 } from './encoding.js';

/**
 * Offline transfer signing — the sender's cryptographic authorization of a
 * single P2P transfer.
 *
 * This is the trust anchor for receiver-independent settlement. Because the
 * sync endpoint no longer proves "you own the sender phone", the server has
 * to prove something stronger instead: that the real sender actually
 * authorized *this exact* transfer. The sender signs a canonical description
 * of the transfer at PIN time; that signature rides inside the QR to the
 * receiver and is stored on both devices, so whoever comes online first —
 * sender or receiver — can present it and the server can verify it against
 * the sender's registered public key. Nobody can mint a credit into a wallet
 * without the corresponding sender's private key, which never leaves the
 * sender's device.
 *
 * Contract (must stay byte-for-byte identical to the server's
 * TransferSignatureVerifier):
 *
 *   algorithm   ECDSA, curve P-256, digest SHA-256
 *   signature   raw IEEE-P1363 (r||s), base64 — WebCrypto's native output,
 *               verified server-side with "SHA256withECDSAinP1363Format"
 *   public key  SPKI/X.509 DER, base64
 *   payload     SYNCPOINT-TRANSFER|v1|{transactionRef}|{requestRef}
 *               |{senderWalletId}|{receiverWalletId}|{amountInKobo}
 *               |{currency}|{createdAtEpochMillis}
 *
 * Amount is serialised as integer kobo and time as epoch-millis on purpose:
 * a decimal string ("7000" vs "7000.00") or an ISO timestamp with or without
 * trailing millis would differ across the two runtimes and every signature
 * would silently fail to verify. Integers cannot drift.
 *
 * This module is pure crypto — no storage, no network. Key persistence and
 * registration live in the enrollment layer that consumes these functions.
 */

const CANONICAL_DOMAIN = 'SYNCPOINT-TRANSFER';
const CANONICAL_VERSION = 'v1';

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };

/** Converts a naira amount to an integer-kobo string (7000 -> "700000"). */
function amountToKobo(amount) {
  const kobo = Math.round(Number(amount) * 100);
  if (!Number.isFinite(kobo)) {
    throw new Error('transferSignature: amount is not a finite number.');
  }
  return String(kobo);
}

/** Converts any date-ish value to a millisecond-epoch string. */
function createdAtToEpochMillis(createdAt) {
  const millis = new Date(createdAt).getTime();
  if (Number.isNaN(millis)) {
    throw new Error('transferSignature: createdAt is not a valid date.');
  }
  return String(millis);
}

/**
 * The exact string that gets signed and verified. Any caller that needs to
 * display or debug what was signed should go through here rather than
 * rebuilding the format, so there is only ever one definition of it.
 */
export function canonicalTransferString(fields) {
  const {
    transactionRef,
    requestRef,
    senderWalletId,
    receiverWalletId,
    amount,
    currency,
    createdAt,
  } = fields;

  if (!transactionRef || !requestRef || !senderWalletId || !receiverWalletId || !currency) {
    throw new Error('transferSignature: missing a required field for the canonical payload.');
  }

  return [
    CANONICAL_DOMAIN,
    CANONICAL_VERSION,
    transactionRef,
    requestRef,
    senderWalletId,
    receiverWalletId,
    amountToKobo(amount),
    currency,
    createdAtToEpochMillis(createdAt),
  ].join('|');
}

/**
 * Generates the device's transfer-signing keypair.
 *
 * The private key is non-extractable: it can sign but can never be read out
 * of the device, so a compromised backup or an XSS payload cannot exfiltrate
 * it. WebCrypto still lets a non-extractable CryptoKey be stored directly in
 * IndexedDB (structured clone), which is how the enrollment layer persists
 * it. The public key is always exportable regardless of the flag, so it can
 * still be sent to the server.
 */
export function generateTransferKeypair() {
  return crypto.subtle.generateKey(KEY_ALGORITHM, false, ['sign', 'verify']);
}

/** Exports a public key as base64 SPKI for registration with the server. */
export async function exportPublicKeyBase64(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

/**
 * Signs a transfer's canonical payload, returning a base64 P1363 signature.
 *
 * @param privateKey a non-extractable ECDSA P-256 CryptoKey with 'sign' usage
 * @param fields     transactionRef, requestRef, senderWalletId,
 *                   receiverWalletId, amount, currency, createdAt
 */
export async function signTransfer(privateKey, fields) {
  const message = encodeUtf8(canonicalTransferString(fields));
  const signature = await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, message);
  return bytesToBase64(new Uint8Array(signature));
}