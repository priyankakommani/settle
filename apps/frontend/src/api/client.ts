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

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('settle.token') : null;
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
  } catch {
    /* ignore localStorage restriction */
  }
  return headers;
}

/**
 * Fetches a binary endpoint (e.g. an original uploaded file) with the same auth
 * as `request`, and returns it as an object URL + its declared filename. Plain
 * <a>/<img> tags can't carry the bearer-token header, so viewing/downloading a
 * stored file has to go through an authenticated fetch instead of a bare URL.
 * Caller is responsible for revoking the URL (`URL.revokeObjectURL`) when done.
 */
export async function requestFile(
  path: string,
): Promise<{ url: string; filename: string; mime: string }> {
  const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api${path}`, {
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(`Could not load file (${res.status})`, 'INTERNAL_ERROR', res.status, 'unknown');
  }
  const filename = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/
    .exec(res.headers.get('content-disposition') ?? '')?.[1];
  const blob = await res.blob();
  return {
    url: URL.createObjectURL(blob),
    filename: filename ? decodeURIComponent(filename) : 'download',
    mime: blob.type,
  };
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = authHeaders();

  const method = opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET');

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  } else if (method === 'DELETE') {
    // Render's edge proxy strips Authorization/Cookie from a body-less DELETE,
    // which makes the API see the request as unauthenticated. Sending an empty
    // JSON body keeps the credential headers intact. The DELETE endpoints
    // ignore the body (they validate params only).
    headers['content-type'] = 'application/json';
    body = '{}';
  }

  const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
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
