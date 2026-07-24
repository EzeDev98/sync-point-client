/**
 * Reads the signed-in user's identity fields.
 *
 * Every consumer wrote the same `sessionStorage.getItem(k) ?? localStorage
 * .getItem(k) ?? fallback` chain by hand — and FundWallet wrote it in the
 * opposite order, so the two could disagree after a session refresh.
 * Session storage wins here, matching what the rest of the app assumed.
 */
export function readIdentity(key, fallback = '') {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? fallback;
}

export function getWalletId() {
  return readIdentity('walletId', null);
}

export function getFullName() {
  return ['firstName', 'middleName', 'lastName']
    .map((key) => readIdentity(key))
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function getInitials() {
  const first = readIdentity('firstName', 'User').charAt(0).toUpperCase();
  const last = readIdentity('lastName').charAt(0).toUpperCase();
  return `${first}${last}`;
}