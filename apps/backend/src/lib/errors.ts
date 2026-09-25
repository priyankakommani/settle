import { ErrorCode, HttpStatus, type ErrorCodeValue, type HttpStatusCode } from '@settle/shared';

/**
 * The ONLY error type the application layer is allowed to throw on purpose.
 *
 * Controllers/services throw a subclass of `AppError`. The central error
 * handler (src/middleware/error-handler.ts) is the ONLY place that turns an
 * error into an HTTP response, so status codes and error bodies are defined
 * in exactly one place.
 *
 * `isOperational = true`  -> expected, safe to surface to the client verbatim.
 * `isOperational = false` -> a bug / unexpected; handler logs it and returns a
 *                            generic 500 without leaking internals.
 */
export class AppError extends Error {
  readonly statusCode: HttpStatusCode;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(params: {
    statusCode: HttpStatusCode;
    code: ErrorCodeValue;
    message: string;
    details?: unknown;
    isOperational?: boolean;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = new.target.name;
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.isOperational = params.isOperational ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

/* ------------------------------------------------------------------ *
 * 4xx — client errors. All operational.                              *
 * ------------------------------------------------------------------ */

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code: ErrorCodeValue = ErrorCode.BAD_REQUEST, details?: unknown) {
    super({ statusCode: HttpStatus.BAD_REQUEST, code, message, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: unknown) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.VALIDATION_ERROR,
      message,
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Not authenticated', code: ErrorCodeValue = ErrorCode.UNAUTHORIZED) {
    super({ statusCode: HttpStatus.UNAUTHORIZED, code, message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not permitted', code: ErrorCodeValue = ErrorCode.FORBIDDEN, details?: unknown) {
    super({ statusCode: HttpStatus.FORBIDDEN, code, message, details });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code: ErrorCodeValue = ErrorCode.NOT_FOUND, details?: unknown) {
    super({ statusCode: HttpStatus.NOT_FOUND, code, message, details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict with current resource state', code: ErrorCodeValue = ErrorCode.CONFLICT, details?: unknown) {
    super({ statusCode: HttpStatus.CONFLICT, code, message, details });
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string, code: ErrorCodeValue, details?: unknown) {
    super({ statusCode: HttpStatus.UNPROCESSABLE_ENTITY, code, message, details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large') {
    super({ statusCode: HttpStatus.PAYLOAD_TOO_LARGE, code: ErrorCode.PAYLOAD_TOO_LARGE, message });
  }
}

/* ------------------------------------------------------------------ *
 * 5xx — server errors.                                               *
 * ------------------------------------------------------------------ */

export class InternalError extends AppError {
  constructor(message = 'Something went wrong', cause?: unknown) {
    super({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message,
      isOperational: false,
      cause,
    });
  }
}

export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented yet') {
    super({ statusCode: HttpStatus.NOT_IMPLEMENTED, code: ErrorCode.NOT_IMPLEMENTED, message });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', cause?: unknown) {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message,
      isOperational: false,
      cause,
    });
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
