// Access token expiry checks, refresh and session termination.
import { refreshToken } from '@features/auth/api/authApi';
import { getIsOnline } from '@core/network/networkService';
import { quarantineAndWipeSession } from '@features/device/services/quarantineService';
import {
  clearTokenSession,
  persistValue,
  readPersisted,
} from '@features/auth/services/sessionManager';

const REFRESH_BUFFER_MS = 60_000;

let refreshPromise = null;

function getTokenExpiry() {
  const issuedAt = Number(readPersisted('tokenIssuedAt') || 0);
  const expiresIn = Number(sessionStorage.getItem('accessTokenExpiresIn') || 0);
  return issuedAt + expiresIn * 1000;
}

function isAccessTokenExpiringSoon() {
  return Date.now() >= getTokenExpiry() - REFRESH_BUFFER_MS;
}

function isRefreshTokenExpired() {
  const issuedAt = Number(readPersisted('tokenIssuedAt') || 0);
  const refreshExpiresIn = Number(readPersisted('refreshTokenExpiresIn') || 0);

  if (!refreshExpiresIn || refreshExpiresIn <= 0) return false;

  return Date.now() >= issuedAt + refreshExpiresIn * 1000;
}

async function endSession() {
  await quarantineAndWipeSession();
  window.dispatchEvent(new CustomEvent('session-expired'));
  throw new Error('SESSION_EXPIRED');
}

let revokedPromise = null;

export function handleSessionRevoked() {
  if (!revokedPromise) {
    revokedPromise = quarantineAndWipeSession()
      .catch((err) => {
        console.error('[tokenStore] Quarantine after session revocation failed:', err);
        clearTokenSession();
      })
      .finally(() => {
        window.dispatchEvent(new CustomEvent('session-expired'));
      });
  }
  return revokedPromise;
}

function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken()
    .then((data) => {
      const accessToken = data.accessToken ?? data.access_token;
      const newRefreshToken = data.refreshToken ?? data.refresh_token;
      const expiresIn = data.expiresIn ?? data.expires_in;
      const refreshExpiresIn = data.refreshExpiresIn ?? data.refresh_expires_in;
      if (!accessToken) throw new Error('No access token in refresh response');

      sessionStorage.setItem('sessionToken', accessToken);
      sessionStorage.setItem('accessTokenExpiresIn', expiresIn);

      if (newRefreshToken) persistValue('refreshToken', newRefreshToken);
      if (refreshExpiresIn != null) persistValue('refreshTokenExpiresIn', refreshExpiresIn);
      persistValue('tokenIssuedAt', Date.now().toString());

      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function getValidToken() {
  if (!isAccessTokenExpiringSoon()) {
    return sessionStorage.getItem('sessionToken');
  }

  if (!getIsOnline()) {
    return sessionStorage.getItem('sessionToken');
  }

  if (isRefreshTokenExpired()) {
    await endSession();
  }

  try {
    return await doRefresh();
  } catch (err) {
    if (err.message === 'REFRESH_INVALID' && getIsOnline()) {
      console.error('[tokenStore] Refresh token invalid:', err);
      await endSession();
    }

    console.warn('[tokenStore] Refresh failed transiently, will retry:', err.message);
    return sessionStorage.getItem('sessionToken');
  }
}

export async function refreshOnStartup() {
  if (!isAccessTokenExpiringSoon()) {
    return sessionStorage.getItem('sessionToken');
  }

  if (isRefreshTokenExpired()) {
    await quarantineAndWipeSession();
    throw new Error('REFRESH_EXPIRED');
  }

  return doRefresh();
}
