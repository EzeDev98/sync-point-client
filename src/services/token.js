import { refreshToken } from "./api";
import { clearTokenSession, readPersisted, persistValue } from "./sessionUtils";

const REFRESH_BUFFER_MS = 60_000;

let refreshPromise = null;

function getTokenExpiry() {
  const issuedAt = Number(readPersisted("tokenIssuedAt") || 0);
  const expiresIn = Number(sessionStorage.getItem("accessTokenExpiresIn") || 0);
  return issuedAt + expiresIn * 1000;
}

function isAccessTokenExpiredOrClose() {
  return Date.now() >= getTokenExpiry() - REFRESH_BUFFER_MS;
}

function isRefreshTokenExpired() {
  const issuedAt = Number(readPersisted("tokenIssuedAt") || 0);
  const refreshExpiresIn = Number(readPersisted("refreshTokenExpiresIn") || 0);
  return Date.now() >= issuedAt + refreshExpiresIn * 1000;
}

async function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken()
    .then((data) => {
      const accessToken = data.access_token;
      if (!accessToken) throw new Error("No access token in refresh response");

      // Access token — sessionStorage only (gone on tab close)
      sessionStorage.setItem("sessionToken", accessToken);
      sessionStorage.setItem("accessTokenExpiresIn", data.expires_in);

      // Refresh token — localStorage (survives app closure)
      persistValue("refreshToken", data.refresh_token);
      persistValue("refreshTokenExpiresIn", data.refresh_expires_in);
      persistValue("tokenIssuedAt", Date.now().toString());

      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function getValidToken() {
  if (isAccessTokenExpiredOrClose()) {
    if (isRefreshTokenExpired()) {
      clearTokenSession();
      window.dispatchEvent(new CustomEvent("session-expired"));
      throw new Error("SESSION_EXPIRED");
    }
    try {
      return await doRefresh();
    } catch (err) {
      console.error("[token] Refresh failed:", err);
      clearTokenSession();
      window.dispatchEvent(new CustomEvent("session-expired"));
      throw new Error("SESSION_EXPIRED", err);
    }
  }
  return sessionStorage.getItem("sessionToken");
}


/**
 * Called at app startup when no access token exists but a refresh token does.
 * Returns the new access token on success, throws on failure.
 */
export async function refreshOnStartup() {
  if (isRefreshTokenExpired()) {
    throw new Error("REFRESH_EXPIRED");
  }
  return doRefresh();
}