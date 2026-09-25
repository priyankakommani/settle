import type { Context } from 'hono';
import { ok } from '../lib/response.js';

/**
 * Identity of the acting user (auth stub). The frontend calls this right after
 * a user is picked so it can drive role-based navigation and route guards.
 */
export const meController = {
  get(c: Context) {
    const u = c.get('currentUser');
    return ok(c, {
      empCode: u.empCode,
      name: u.name,
      email: u.email,
      designation: u.designation,
      department: u.department,
      city: u.city,
      role: u.role,
      reportingManagerCode: u.reportingManagerCode,
    });
  },
};
