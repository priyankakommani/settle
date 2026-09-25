import { ErrorCode } from '@settle/shared';
import {
  AppError,
  ConflictError,
  InternalError,
  ServiceUnavailableError,
  UnprocessableError,
} from './errors.js';

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

/**
 * Transient connectivity failures — the database is up but refusing/losing
 * connections (too many clients, shutting down, network drop). These are
 * infrastructure conditions, not bugs, so they map to a 503 the client can
 * retry rather than a 500. Covers SQLSTATE class 08 / 53 / 57P plus the
 * postgres-js driver's own string codes.
 */
const CONNECTION_CODES = new Set<string>([
  '53300', // too_many_connections
  '53400', // configuration_limit_exceeded
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '08P01', // protocol_violation
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]);

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
    if (err.code && CONNECTION_CODES.has(err.code)) {
      return new ServiceUnavailableError('Database temporarily unavailable — please retry.', err);
    }
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
