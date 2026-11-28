// Error thrown by the HTTP client for any non-2xx response.
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
