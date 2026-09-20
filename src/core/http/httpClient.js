import { ApiError } from './ApiError.js';

/**
 * The single place an HTTP request is made.
 *
 * Every one of the seventeen endpoints in the old api.js rebuilt the same
 * scaffolding by hand: base URL interpolation, JSON headers, the bearer
 * token, `await response.json()`, and a `data.detail || data.message ||
 * <fallback>` error line. They had drifted — some attached the status code
 * to the error, some did not, and one issued a GET with a request body,
 * which fetch rejects outright.
 *
 * Auth is injected rather than imported. core must not depend on a feature,
 * and importing the token module here would also reintroduce the circular
 * dependency the old code had, where api.js imported token.js and token.js
 * imported api.js straight back.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:2000/api/v1';
// const BASE_URL = 'http://localhost:2000/api/v1';



/** Set once at startup by the app entry point. */
let getAuthToken = null;

/** Called when the server reports the session was ended while the token was still valid. */
let sessionRevokedHandler = null;

export function configureHttpClient({ tokenProvider, onSessionRevoked }) {
  getAuthToken = tokenProvider;
  sessionRevokedHandler = onSessionRevoked ?? null;
}

async function parseBody(response) {
  // A 204, or an error page from a proxy, will not be JSON.
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * @param path       endpoint path, e.g. '/wallet/login'
 * @param method     HTTP method, default GET
 * @param body       serialised as JSON when present
 * @param auth       attach the bearer token
 * @param fallback   message used when the server sends none
 */
export async function request(path, { method = 'GET', body, auth = false, fallback } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    if (!getAuthToken) {
      throw new ApiError('HTTP client is not configured with a token provider.');
    }

    const token = await getAuthToken();
    if (!token) {
      throw new ApiError('No authentication token found. Please sign in again.', { status: 401 });
    }

    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // fetch only rejects on a transport failure, never on an HTTP status.
    throw new ApiError('Could not reach the server. Check your connection and try again.', {
      detail: err.message,
    });
  }

  const data = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && data?.code === 'SESSION_REVOKED' && sessionRevokedHandler) {
      await sessionRevokedHandler();
    }

    throw new ApiError(
      data?.detail || data?.message || fallback || 'Something went wrong. Please try again.',
      {
        status: response.status,
        detail: data?.detail,
        remainingSeconds: data?.remainingSeconds,
        body: data,
      }
    );
  }

  return data;
}

export const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};