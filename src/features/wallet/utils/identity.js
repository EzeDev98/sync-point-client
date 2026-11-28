// Reads the signed-in user's identity fields.
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
