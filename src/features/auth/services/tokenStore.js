import { refreshToken } from '@features/auth/api/authApi';
import { getIsOnline } from '@core/network/networkService';
import { quarantineAndWipeSession } from '@features/device/services/quarantineService';
import { persistValue, readPersisted } from '@features/auth/services/sessionManager';

/**
 * Access-token lifecycle: expiry checks, refresh, and session termination.
 *
 * Renamed from token.js and repointed at authApi. The old pair imported each
 * other — api.js pulled getValidToken from token.js while token.js pulled
 * refreshToken from api.js — which the HTTP client's injected token provider
 * now breaks.
 */

/** Refresh this long before actual expiry, so a request never races it. */
const REFRESH_BUFFER_MS = 60_000;

/** In-flight refresh, shared so concurrent callers issue only one request. */
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

  // A server that sends no refresh expiry is treated as unbounded.
  if (!refreshExpiresIn || refreshExpiresIn <= 0) return false;

  return Date.now() >= issuedAt + refreshExpiresIn * 1000;
}

async function endSession() {
  await quarantineAndWipeSession();
  window.dispatchEvent(new CustomEvent('session-expired'));
  throw new Error('SESSION_EXPIRED');
}

function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken()
    .then((data) => {
      const accessToken = data.access_token;
      if (!accessToken) throw new Error('No access token in refresh response');

      sessionStorage.setItem('sessionToken', accessToken);
      sessionStorage.setItem('accessTokenExpiresIn', data.expires_in);

      persistValue('refreshToken', data.refresh_token);
      persistValue('refreshTokenExpiresIn', data.refresh_expires_in);
      persistValue('tokenIssuedAt', Date.now().toString());

      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Returns a usable access token, refreshing it first when necessary.
 *
 * Offline, the stored token is returned as-is: it may be stale, but there is
 * no way to refresh it, and the offline paths do not call the server anyway.
 */
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
    // Only a definitively rejected refresh ends the session. A network blip
    // must not sign the user out and quarantine their pending transactions.
    if (err.message === 'REFRESH_INVALID' && getIsOnline()) {
      console.error('[tokenStore] Refresh token invalid:', err);
      await endSession();
    }

    console.warn('[tokenStore] Refresh failed transiently, will retry:', err.message);
    return sessionStorage.getItem('sessionToken');
  }
}

/**
 * Refreshes when the app resumes, before any protected route loads — but
 * only when the access token is actually close to expiring. This used to
 * refresh unconditionally on every app open; that was pointless extra
 * load and a needless race window (two tabs/opens both redeeming the same
 * refresh token) even now that the server can be configured
 * non-destructively (Part B) — so it's skipped whenever the current token
 * is still good.
 */
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