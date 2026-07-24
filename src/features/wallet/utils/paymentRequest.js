import { formatNaira } from '@shared/utils';

/**
 * Validation for a scanned PAYMENT_REQUEST QR payload.
 *
 * SendMoney ran seven sequential `if (...) { setErrorModal(...); return; }`
 * blocks inline in its scan handler. Pulling them out makes the rules
 * testable and keeps the ordering explicit: structural checks first, then
 * identity, then limits.
 */

export const PAYMENT_LIMITS = {
  MIN_AMOUNT: 100,
  MAX_AMOUNT: 20_000,
  MAX_OFFLINE_PENDING: 10,
};

/**
 * @returns {string} an error message, or '' when the request is acceptable
 */
export function validatePaymentRequest(payload, { senderWalletId, balance, pendingCount, isOnline }) {
  if (!payload || payload.type !== 'PAYMENT_REQUEST') {
    return 'Invalid QR code. Please scan a valid SyncPoint payment request.';
  }

  if (!payload.requestRef || !payload.receiverWalletId || !payload.amount) {
    return 'Invalid payment request — missing required fields.';
  }

  if (new Date() > new Date(payload.expiresAt)) {
    return 'This payment request has expired. Ask the receiver to generate a new one.';
  }

  if (payload.receiverWalletId === senderWalletId) {
    return 'You cannot send money to yourself.';
  }

  // Each unsynced transaction is a claim the server has not seen yet, so the
  // queue is capped until the device gets a chance to reconcile.
  if (!isOnline && pendingCount >= PAYMENT_LIMITS.MAX_OFFLINE_PENDING) {
    return `You have reached the maximum of ${PAYMENT_LIMITS.MAX_OFFLINE_PENDING} pending offline transactions. Connect to the internet to sync before sending more.`;
  }

  const amount = Number(payload.amount);

  if (amount > balance) {
    return `Insufficient balance. You have ${formatNaira(balance)} but need ${formatNaira(amount)}.`;
  }

  if (amount < PAYMENT_LIMITS.MIN_AMOUNT) {
    return `Minimum payment amount is ${formatNaira(PAYMENT_LIMITS.MIN_AMOUNT)}.`;
  }

  if (amount > PAYMENT_LIMITS.MAX_AMOUNT) {
    return `Maximum payment amount is ${formatNaira(PAYMENT_LIMITS.MAX_AMOUNT)}.`;
  }

  return '';
}

/** Builds the TRANSFER payload the receiver scans back. */
export function buildTransferPayload({ request, transactionRef, createdAt, sender }) {
  return {
    type: 'TRANSFER',
    transactionRef,
    requestRef: request.requestRef,
    status: 'SUCCESS',
    amount: Number(request.amount),
    currency: request.currency || 'NGN',
    description: request.description || null,
    senderWalletId: sender.walletId,
    senderPhone: sender.phone,
    senderName: sender.name,
    receiverWalletId: request.receiverWalletId,
    receiverPhone: request.receiverPhone,
    receiverName: request.receiverName,
    createdAt,
  };
}

export function generateTransactionRef() {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${Date.now()}-${random}`;
}

export function generateRequestRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `REQ-${date}-${random}`;
}

/** Builds the PAYMENT_REQUEST payload the sender scans. */
export function buildPaymentRequest({ requestRef, amount, description, receiver, createdAt, expiresAt }) {
  return {
    type: 'PAYMENT_REQUEST',
    requestRef,
    receiverWalletId: receiver.walletId,
    receiverPhone: receiver.phone,
    receiverName: receiver.name,
    amount: Number(amount),
    currency: 'NGN',
    description: description || null,
    status: 'PENDING',
    createdAt,
    expiresAt,
  };
}

/**
 * Validation for the TRANSFER QR the receiver scans back from the sender.
 *
 * ReceivePayment threw these one at a time from inside a try block; the
 * ordering is preserved — shape, then binding to this request, then amount,
 * then expiry, then settlement status.
 *
 * @returns {string} an error message, or '' when the transfer is acceptable
 */
export function validateTransferPayload(payload, { requestRef, receiverWalletId, expectedAmount, expiresAt }) {
  if (!payload || payload.type !== 'TRANSFER') {
    return "Invalid QR code. Please scan the sender's transaction receipt QR.";
  }

  if (payload.requestRef !== requestRef) {
    return 'Payment request mismatch. This QR does not match your current request.';
  }

  if (payload.receiverWalletId !== receiverWalletId) {
    return 'This payment is intended for a different wallet.';
  }

  if (Number(payload.amount) !== Number(expectedAmount)) {
    return `Amount mismatch. Expected ${formatNaira(expectedAmount)} but received ${formatNaira(payload.amount)}.`;
  }

  if (new Date() > new Date(expiresAt)) {
    return 'Payment request has expired. Please generate a new QR code.';
  }

  if (payload.status !== 'SUCCESS') {
    return 'Payment is not confirmed. Ask the sender to complete the payment.';
  }

  return '';
}

/** Validates the amount the receiver is requesting. */
export function validateRequestedAmount(value) {
  const amount = Number(value);

  if (!value || Number.isNaN(amount) || amount <= 0) {
    return 'Enter a valid amount';
  }
  if (amount < PAYMENT_LIMITS.MIN_AMOUNT) {
    return `Minimum amount is ${formatNaira(PAYMENT_LIMITS.MIN_AMOUNT)}`;
  }
  if (amount > PAYMENT_LIMITS.MAX_AMOUNT) {
    return `Maximum amount is ${formatNaira(PAYMENT_LIMITS.MAX_AMOUNT)}`;
  }

  return '';
}