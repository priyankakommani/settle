import type { ApiResponse } from '@settle/shared';

/**
 * The one fetch wrapper for the app.
 *  - prefixes /api
 *  - sends cookies (the session lives in an httpOnly cookie)
 *  - unwraps the { success, data } envelope
 *  - throws a typed `ApiError` (with .code, .status, .requestId) on failure
 *    so React Query surfaces a real error object
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** true when the backend endpoint exists but isn't built yet */
  get isNotImplemented(): boolean {
    return this.status === 501 || this.code === 'NOT_IMPLEMENTED';
  }

  /** true when the request failed because there is no valid session */
  get isAuthError(): boolean {
    return (
      this.status === 401 ||
      this.code === 'AUTH_REQUIRED' ||
      this.code === 'AUTH_TOKEN_EXPIRED' ||
      this.code === 'AUTH_TOKEN_INVALID'
    );
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** send as multipart instead of JSON */
  form?: FormData;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api${path}`, {
    method: opts.method ?? (body ? 'POST' : 'GET'),
    headers,
    body,
    credentials: 'include',
    signal: opts.signal,
  });

  const requestId = res.headers.get('x-request-id') ?? 'unknown';
  if (res.status === 204) return undefined as T;

  let parsed: ApiResponse<T>;
  try {
    parsed = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      `Unexpected non-JSON response (${res.status})`,
      'INTERNAL_ERROR',
      res.status,
      requestId,
    );
  }

  if (!res.ok || parsed.success === false) {
    const err = parsed.success === false ? parsed.error : undefined;
    throw new ApiError(
      err?.message ?? `Request failed (${res.status})`,
      err?.code ?? 'INTERNAL_ERROR',
      res.status,
      err?.requestId ?? requestId,
      err?.details,
    );
  }

  return parsed.data;
}
