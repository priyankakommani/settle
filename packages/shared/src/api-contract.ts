import type { ErrorCodeValue } from './error-codes.js';

/**
 * Every backend response uses one of these two envelopes. No route ever
 * returns a bare object. The frontend can therefore have exactly one
 * response parser.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    /** stable machine code — switch on this */
    code: ErrorCodeValue;
    /** human-readable, safe to show in a toast */
    message: string;
    /** optional field-level detail, e.g. zod issues */
    details?: unknown;
    /** correlation id, also returned in the `x-request-id` header */
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;
