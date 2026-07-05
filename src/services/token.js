import { refreshToken } from "./api";
import { clearTokenSession, readPersisted, persistValue } from "./sessionUtils";
import { getIsOnline } from "./networkService";
import { quarantineAndWipeSession } from "./quarantineService";

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

  if (!refreshExpiresIn || refreshExpiresIn <= 0) {
    return false;
  }

  return Date.now() >= issuedAt + refreshExpiresIn * 1000;
}

async function doRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshToken()
    .then((data) => {
      const accessToken = data.access_token;
      if (!accessToken) throw new Error("No access token in refresh response");

      sessionStorage.setItem("sessionToken", accessToken);
      sessionStorage.setItem("accessTokenExpiresIn", data.expires_in);

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

    if (!getIsOnline()) {
      return sessionStorage.getItem("sessionToken");
    }

    if (isRefreshTokenExpired()) {
      await quarantineAndWipeSession();
      window.dispatchEvent(new CustomEvent("session-expired"));
      throw new Error("SESSION_EXPIRED");
    }

    try {
      return await doRefresh();
    } catch (err) {
      if (err.message === "REFRESH_INVALID" && getIsOnline()) {
        console.error("[token] Refresh token invalid:", err);
        await quarantineAndWipeSession();
        window.dispatchEvent(new CustomEvent("session-expired"));
        throw new Error("SESSION_EXPIRED");
      }

      console.warn("[token] Refresh failed transiently, will retry:", err.message);
      return sessionStorage.getItem("sessionToken");
    }
  }
  return sessionStorage.getItem("sessionToken");
}

export async function refreshOnStartup() {
  if (isRefreshTokenExpired()) {
    await quarantineAndWipeSession();
    throw new Error("REFRESH_EXPIRED");
  }
  return doRefresh();
}