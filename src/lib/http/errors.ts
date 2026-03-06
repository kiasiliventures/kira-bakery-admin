export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, "bad_request", message, details);
}

export function unauthorized(message = "Authentication required"): AppError {
  return new AppError(401, "unauthorized", message);
}

export function forbidden(message = "Insufficient permissions"): AppError {
  return new AppError(403, "forbidden", message);
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, "not_found", message);
}

export function conflict(message = "Conflict detected"): AppError {
  return new AppError(409, "conflict", message);
}

export function tooManyRequests(
  message = "Too many requests",
  retryAfterSeconds?: number,
): AppError {
  return new AppError(
    429,
    "rate_limited",
    message,
    retryAfterSeconds ? { retryAfterSeconds } : undefined,
  );
}

export function internalError(message = "Internal server error"): AppError {
  return new AppError(500, "internal_error", message);
}
