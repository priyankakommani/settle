import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { created, ok } from '../lib/response.js';
import { valid } from '../middleware/validate.js';
import { env, isProd } from '../config/env.js';
import { authService, toPublicUser, type AuthResult } from '../services/auth.service.js';
import { loginSchema, signupSchema } from '../validators/auth.validators.js';

/** Writes the session cookie. httpOnly so the token never touches JS. */
function setSessionCookie(c: Context, result: AuthResult) {
  setCookie(c, env.SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: isProd ? 'None' : 'Lax',
    secure: isProd,
    path: '/',
    maxAge: env.SESSION_TTL_SECONDS,
    expires: result.expiresAt,
  });
}

export const authController = {
  async signup(c: Context) {
    const { email, password } = valid(c, 'json', signupSchema);
    const result = await authService.signup(email, password);
    setSessionCookie(c, result);
    return created(c, { user: result.user, token: result.token });
  },

  async login(c: Context) {
    const { email, password } = valid(c, 'json', loginSchema);
    const result = await authService.login(email, password);
    setSessionCookie(c, result);
    return ok(c, { user: result.user, token: result.token });
  },

  logout(c: Context) {
    deleteCookie(c, env.SESSION_COOKIE, { path: '/' });
    return ok(c, { ok: true });
  },

  /** Current session identity. Behind the `currentUser` middleware. */
  me(c: Context) {
    return ok(c, toPublicUser(c.get('currentUser')));
  },
};
