import { sign, verify } from 'hono/jwt';
import { JwtTokenExpired, JwtTokenInvalid } from 'hono/utils/jwt/types';
import { ErrorCode, type EmployeeRoleValue } from '@settle/shared';
import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

/**
 * Session JWTs. Signed with HS256 using `JWT_SECRET`. Carried in an httpOnly
 * cookie (see auth.controller) — the token itself is opaque to the frontend.
 */
export interface SessionClaims {
  sub: string; // empCode
  role: EmployeeRoleValue;
  name: string;
  exp: number; // unix seconds
  iat: number;
}

export async function issueSessionToken(input: {
  empCode: string;
  role: EmployeeRoleValue;
  name: string;
}): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.SESSION_TTL_SECONDS;
  const token = await sign(
    { sub: input.empCode, role: input.role, name: input.name, iat: now, exp },
    env.JWT_SECRET,
    'HS256',
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

export async function readSessionToken(token: string): Promise<SessionClaims> {
  try {
    return (await verify(token, env.JWT_SECRET, 'HS256')) as unknown as SessionClaims;
  } catch (err) {
    if (err instanceof JwtTokenExpired) {
      throw new UnauthorizedError('Session expired. Please sign in again.', ErrorCode.AUTH_TOKEN_EXPIRED);
    }
    if (err instanceof JwtTokenInvalid) {
      throw new UnauthorizedError('Invalid session.', ErrorCode.AUTH_TOKEN_INVALID);
    }
    throw new UnauthorizedError('Could not verify session.', ErrorCode.AUTH_TOKEN_INVALID);
  }
}
