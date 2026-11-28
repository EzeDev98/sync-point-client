// The single HTTP client used for every server call.
import { ApiError } from './ApiError.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:2000/api/v1';

let getAuthToken = null;

let sessionRevokedHandler = null;

export function configureHttpClient({ tokenProvider, onSessionRevoked }) {
  getAuthToken = tokenProvider;
  sessionRevokedHandler = onSessionRevoked ?? null;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

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
