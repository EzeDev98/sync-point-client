// Signs offline transfers with the device's ECDSA P-256 key.
import { bytesToBase64, encodeUtf8 } from './encoding.js';

const CANONICAL_DOMAIN = 'SYNCPOINT-TRANSFER';
const CANONICAL_VERSION = 'v1';

const KEY_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM = { name: 'ECDSA', hash: 'SHA-256' };

function amountToKobo(amount) {
  const kobo = Math.round(Number(amount) * 100);
  if (!Number.isFinite(kobo)) {
    throw new Error('transferSignature: amount is not a finite number.');
  }
  return String(kobo);
}

function createdAtToEpochMillis(createdAt) {
  const millis = new Date(createdAt).getTime();
  if (Number.isNaN(millis)) {
    throw new Error('transferSignature: createdAt is not a valid date.');
  }
  return String(millis);
}

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

export function generateTransferKeypair() {
  return crypto.subtle.generateKey(KEY_ALGORITHM, false, ['sign', 'verify']);
}

export async function exportPublicKeyBase64(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  return bytesToBase64(new Uint8Array(spki));
}

export async function signTransfer(privateKey, fields) {
  const message = encodeUtf8(canonicalTransferString(fields));
  const signature = await crypto.subtle.sign(SIGN_ALGORITHM, privateKey, message);
  return bytesToBase64(new Uint8Array(signature));
}
