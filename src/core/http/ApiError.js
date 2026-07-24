/**
 * Error thrown by the HTTP client for any non-2xx response.
 *
 * The old code built these ad hoc — some endpoints threw a plain Error with
 * only a message, others attached `.status`, and two also attached
 * `.remainingSeconds`. Callers therefore could not rely on any of it: the
 * OTP screens read `err.status === 429` even for endpoints that never set
 * status, and Register read `err.response.data.message`, an Axios shape this
 * codebase never produced.
 */
export class ApiError extends Error {
  constructor(message, { status, detail, remainingSeconds, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.remainingSeconds = remainingSeconds;
    this.body = body;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isConflict() {
    return this.status === 409;
  }
}