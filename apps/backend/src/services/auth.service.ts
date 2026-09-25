import { ErrorCode } from '@settle/shared';
import { BadRequestError, ConflictError, UnauthorizedError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { issueSessionToken } from '../lib/session-token.js';
import { employeeRepository } from '../repositories/employee.repository.js';
import type { Employee } from '../db/schema/index.js';

/**
 * Registration + login for the fixed set of Acme employees. There is no
 * self-service account creation for new people — an employee must already exist
 * in `employees` (loaded from employee_master.csv). Sign-up only sets the
 * password for an existing, not-yet-registered account.
 */

export interface AuthResult {
  token: string;
  expiresAt: Date;
  user: PublicUser;
}

export interface PublicUser {
  empCode: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  city: string;
  role: Employee['role'];
  reportingManagerCode: string | null;
}

export function toPublicUser(e: Employee): PublicUser {
  return {
    empCode: e.empCode,
    name: e.name,
    email: e.email,
    designation: e.designation,
    department: e.department,
    city: e.city,
    role: e.role,
    reportingManagerCode: e.reportingManagerCode,
  };
}

export const authService = {
  /** First-time password registration for an existing employee. */
  async signup(emailRaw: string, password: string): Promise<AuthResult> {
    const email = emailRaw.trim().toLowerCase();
    const employee = await employeeRepository.findByEmail(email);
    if (!employee) {
      throw new BadRequestError(
        'That email is not on the Acme employee roster.',
        ErrorCode.EMAIL_NOT_RECOGNISED,
      );
    }
    if (employee.passwordHash) {
      throw new ConflictError(
        'This account already has a password. Sign in instead.',
        ErrorCode.ACCOUNT_ALREADY_REGISTERED,
      );
    }

    const passwordHash = await hashPassword(password);
    const updated = await employeeRepository.setPasswordHash(employee.empCode, passwordHash);
    return this.issueFor(updated);
  },

  /** Email + password -> session. */
  async login(emailRaw: string, password: string): Promise<AuthResult> {
    const email = emailRaw.trim().toLowerCase();
    const employee = await employeeRepository.findByEmail(email);

    // Uniform "invalid credentials" for unknown email / wrong password so we
    // don't leak which emails exist — except the one actionable case: the
    // account exists but hasn't set a password yet.
    if (!employee) {
      throw new UnauthorizedError('Email or password is incorrect.', ErrorCode.INVALID_CREDENTIALS);
    }
    if (!employee.passwordHash) {
      throw new UnauthorizedError(
        'This account has no password yet. Create one to continue.',
        ErrorCode.ACCOUNT_NOT_REGISTERED,
      );
    }

    const ok = await verifyPassword(password, employee.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Email or password is incorrect.', ErrorCode.INVALID_CREDENTIALS);
    }

    return this.issueFor(employee);
  },

  async issueFor(employee: Employee): Promise<AuthResult> {
    const { token, expiresAt } = await issueSessionToken({
      empCode: employee.empCode,
      role: employee.role,
      name: employee.name,
    });
    return { token, expiresAt, user: toPublicUser(employee) };
  },
};

export type AuthService = typeof authService;
