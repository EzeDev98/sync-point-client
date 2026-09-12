import { http } from '@core/http/httpClient';
import { ApiError } from '@core/http/ApiError';
import { readPersisted } from '@features/auth/services/sessionManager';

/** Registration, sign-in, sign-out and password recovery. */

export function registerUser(formData) {
  return http.post(
    '/register-user',
    {
      firstName: formData.firstName,
      middleName: formData.middleName || null,
      lastName: formData.lastName,
      username: formData.username,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      gender: formData.gender,
      dateOfBirth: formData.dateOfBirth,
    },
    { fallback: 'Registration failed. Please try again.' }
  );
}

export function loginUser(phoneNumber, password) {
  return http.post(
    '/wallet/login',
    { phoneNumber, password },
    { fallback: 'Login failed. Please try again.' }
  );
}

/**
 * Whether this wallet already has a transaction PIN.
 *
 * A PIN endpoint by subject, but an auth endpoint by use: sign-in calls it
 * to decide between routing to PIN setup or PIN entry, and it is the only
 * caller. Keeping it here avoids features/auth reaching into features/pin.
 */
export function checkPinSet(walletId) {
  return http.get(`/wallet/has-pin?walletId=${encodeURIComponent(walletId)}`, {
    auth: true,
    fallback: 'Unable to verify PIN status. Please try again.',
  });
}

export function logoutUser() {
  return http.post('/logout/user', undefined, {
    auth: true,
    fallback: 'Logout failed. Please try again.',
  });
}

/**
 * Exchanges the stored refresh token for a new access token.
 *
 * Deliberately unauthenticated: the access token is expired by definition at
 * this point, and attaching it would recurse back into the refresh logic.
 *
 * The three sentinel messages are what tokenStore branches on — an invalid
 * refresh token ends the session, a transient failure is retried.
 */
export async function refreshToken() {
  const storedRefreshToken = localStorage.getItem('refreshToken');
  if (!storedRefreshToken) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  try {
    return await http.post('/auth/refresh-token', {
      refreshToken: storedRefreshToken,
      phoneNumber: readPersisted('phoneNumber'),
    });
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) {
      throw new Error('REFRESH_INVALID');
    }
    throw new Error('REFRESH_TRANSIENT');
  }
}

export function requestPasswordResetOtp(phoneNumber) {
  return http.post('/password-reset/request', { phoneNumber });
}

export function verifyPasswordResetOtp(phoneNumber, otp) {
  return http.post(
    '/password-reset/verify-otp',
    { phoneNumber, otp },
    { fallback: 'The verification code is invalid.' }
  );
}

export function completePasswordReset(resetToken, newPassword, confirmPassword) {
  return http.post('/password-reset/complete', { resetToken, newPassword, confirmPassword });
}

export function verifyAccountOtp(phoneNumber, otp) {
  return http.post(
    '/phone-number/verify',
    { phoneNumber, otp },
    { fallback: 'The verification code is invalid.' }
  );
}

export function resendAccountVerification(phoneNumber) {
  return http.post('/phone-number/resend-verification', { phoneNumber });
}