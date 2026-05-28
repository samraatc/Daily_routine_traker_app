/**
 * Typed application errors. Mapped to RFC 7807 problem-details by the
 * error-handler plugin.
 */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'https://errors.app/validation', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'https://errors.app/unauthorized');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'https://errors.app/forbidden');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'https://errors.app/not-found');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'https://errors.app/conflict', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', readonly retryAfterSeconds?: number) {
    super(message, 429, 'https://errors.app/rate-limited');
  }
}
