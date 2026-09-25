import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import {
  ErrorCode,
  HttpStatus,
  type ApiErrorBody,
  type ErrorCodeValue,
  type HttpStatusCode,
} from '@settle/shared';
import { AppError, isAppError } from '../lib/errors.js';
import { mapDbError } from '../lib/db-error.js';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * THE single place an error becomes an HTTP response.
 *
 * Registered once in app.ts as `app.onError(onError)`. Any `throw` anywhere in
 * a route/controller/service/repository lands here. Nothing else in the code
 * builds an error body or picks an error status code.
 *
 * Precedence:
 *   1. AppError            -> use its statusCode + code + message
 *   2. HTTPException (hono) -> map its status
 *   3. ZodError            -> 422 VALIDATION_ERROR (last-resort; prefer validate())
 *   4. Postgres driver err  -> mapDbError() -> AppError
 *   5. anything else        -> 500 INTERNAL_ERROR, details hidden in prod
 */
export const onError: ErrorHandler = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  const log = c.get('logger') ?? logger;

  const normalized = normalize(err);

  const logPayload = {
    requestId,
    err: {
      name: normalized.name,
      code: normalized.code,
      statusCode: normalized.statusCode,
      stack: normalized.stack,
      cause: normalized.cause,
    },
    method: c.req.method,
    path: c.req.path,
  };

  if (normalized.statusCode >= 500 || !normalized.isOperational) {
    log.error(logPayload, 'request.failed');
  } else {
    log.warn(logPayload, 'request.rejected');
  }

  // error statuses are always >= 400, i.e. always contentful
  return c.json(toBody(normalized, requestId, c), normalized.statusCode as ContentfulStatusCode);
};

/** Registered as `app.notFound(onNotFound)` — unmatched routes get the same envelope. */
export const onNotFound: NotFoundHandler = (c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Route not found: ${c.req.method} ${c.req.path}`,
      requestId,
    },
  };
  return c.json(body, HttpStatus.NOT_FOUND);
};

/* ------------------------------------------------------------------ */

function normalize(err: unknown): AppError {
  if (isAppError(err)) return err;

  if (err instanceof HTTPException) {
    return new AppError({
      statusCode: err.status as HttpStatusCode,
      code: httpExceptionCode(err.status),
      message: err.message || 'Request failed',
      isOperational: true,
      cause: err.cause,
    });
  }

  if (err instanceof ZodError) {
    return new AppError({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: err.flatten(),
      isOperational: true,
    });
  }

  // Postgres / driver errors carry a string `code` (SQLSTATE).
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return mapDbError(err);
  }

  return new AppError({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: err instanceof Error ? err.message : 'Unknown error',
    isOperational: false,
    cause: err,
  });
}

function toBody(err: AppError, requestId: string, c: Context): ApiErrorBody {
  const exposeDetail = err.isOperational || !isProd;
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: err.code,
      message: exposeDetail ? err.message : 'Internal server error',
      requestId,
    },
  };
  if (exposeDetail && err.details !== undefined) {
    body.error.details = err.details;
  }
  if (!isProd && !err.isOperational && err.stack) {
    body.error.details = { ...(body.error.details as object), stack: err.stack.split('\n') };
  }
  void c;
  return body;
}

function httpExceptionCode(status: number): ErrorCodeValue {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 405:
      return ErrorCode.METHOD_NOT_ALLOWED;
    case 409:
      return ErrorCode.CONFLICT;
    case 413:
      return ErrorCode.PAYLOAD_TOO_LARGE;
    case 415:
      return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
    case 422:
      return ErrorCode.VALIDATION_ERROR;
    case 429:
      return ErrorCode.RATE_LIMITED;
    case 503:
      return ErrorCode.SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST;
  }
}
