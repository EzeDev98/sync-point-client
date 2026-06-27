
const TOKEN_KEYS = [
  "sessionToken",
  "refreshToken",
  "accessTokenExpiresIn",
  "refreshTokenExpiresIn",
  "tokenIssuedAt",
];

const AUTH_KEYS = [
  ...TOKEN_KEYS,
  "phoneNumber",
  "username",
  "email",
  "userRefId",
  "walletId",
  "userId",
  "firstName",
  "middleName",
  "lastName",
  "mirrorBalance",
];

export function clearTokenSession() {
  TOKEN_KEYS.forEach((k) => sessionStorage.removeItem(k));
}

export function clearAuthSession() {
  AUTH_KEYS.forEach((k) => sessionStorage.removeItem(k));
}