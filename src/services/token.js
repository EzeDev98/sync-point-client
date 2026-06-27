import { refreshToken } from "./api";
import { clearTokenSession } from "./sessionUtils";

const REFRESH_BUFFER_MS = 60_000; 

let refreshPromise = null;

function getTokenExpiry() {
  const issuedAt = Number(sessionStorage.getItem("tokenIssuedAt") || 0);
  const expiresIn = Number(sessionStorage.getItem("accessTokenExpiresIn") || 0);
  return issuedAt + expiresIn * 1000;
}

function isAccessTokenExpiredOrClose() {
  return Date.now() >= getTokenExpiry() - REFRESH_BUFFER_MS;
}

/**
 * Returns a valid access token, refreshing proactively if close to expiry.
 * All API calls should use this instead of reading sessionStorage directly.
 * On refresh failure, clears the session and throws so the caller can redirect.
 */
function isRefreshTokenExpired() {
  const issuedAt = Number(sessionStorage.getItem("tokenIssuedAt") || 0);
  const refreshExpiresIn = Number(sessionStorage.getItem("refreshTokenExpiresIn") || 0);
  return Date.now() >= issuedAt + refreshExpiresIn * 1000;
}

async function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken()
    .then((data) => {
      
      const accessToken = data.access_token;
      if (!accessToken) throw new Error("No access token in refresh response");

      sessionStorage.setItem("sessionToken", accessToken);
      sessionStorage.setItem("refreshToken", data.refresh_token);
      sessionStorage.setItem("accessTokenExpiresIn", data.expires_in);
      sessionStorage.setItem("refreshTokenExpiresIn", data.refresh_expires_in);
      sessionStorage.setItem("tokenIssuedAt", Date.now().toString());

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
