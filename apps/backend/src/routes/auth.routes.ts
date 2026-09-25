import { Hono } from 'hono';
import { currentUser } from '../middleware/current-user.js';
import { validate } from '../middleware/validate.js';
import { authController } from '../controllers/auth.controller.js';
import { loginSchema, signupSchema } from '../validators/auth.validators.js';

/**
 * /api/auth
 *  POST /signup  — set a password for an existing, unregistered employee
 *  POST /login   — email + password -> session cookie
 *  POST /logout  — clear the session cookie
 *  GET  /me      — current session identity (requires a valid session)
 */
export const authRoutes = new Hono()
  .post('/signup', validate('json', signupSchema), authController.signup)
  .post('/login', validate('json', loginSchema), authController.login)
  .post('/logout', authController.logout)
  .get('/me', currentUser, authController.me);
