import { ErrorCode } from '@settle/shared';
import { AppError, ConflictError, InternalError, UnprocessableError } from './errors.js';

/**
 * Postgres SQLSTATE codes we care about.
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
} as const;

interface PgLikeError {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  column?: string;
}

function looksLikePgError(err: unknown): err is PgLikeError {
  return typeof err === 'object' && err !== null && 'code' in err;
}

/**
 * Translate a raw driver error into an `AppError` with a precise status code
 * and machine code. Anything unrecognised becomes a non-operational 500 so the
 * central handler logs it and hides the details.
 *
 * Call this in repositories: `catch (e) { throw mapDbError(e); }`
 */
export function mapDbError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (looksLikePgError(err)) {
    switch (err.code) {
      case PG.UNIQUE_VIOLATION:
        return new ConflictError(
          'A record with the same unique key already exists.',
          ErrorCode.DB_UNIQUE_VIOLATION,
          { constraint: err.constraint, detail: err.detail },
        );
      case PG.FOREIGN_KEY_VIOLATION:
        return new UnprocessableError(
          'Referenced record does not exist.',
          ErrorCode.DB_FOREIGN_KEY_VIOLATION,
          { constraint: err.constraint, detail: err.detail },
        );
      case PG.NOT_NULL_VIOLATION:
        return new UnprocessableError(
          `Missing required value${err.column ? ` for "${err.column}"` : ''}.`,
          ErrorCode.DB_NOT_NULL_VIOLATION,
          { column: err.column, table: err.table },
        );
      case PG.CHECK_VIOLATION:
        return new UnprocessableError(
          'A database constraint was violated.',
          ErrorCode.DB_CHECK_VIOLATION,
          { constraint: err.constraint },
        );
      default:
        break;
    }
  }

  return new InternalError('Unexpected database error', err);
}
