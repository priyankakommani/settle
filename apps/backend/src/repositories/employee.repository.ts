import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { employees, type Employee } from '../db/schema/index.js';
import { mapDbError } from '../lib/db-error.js';

/**
 * Data access for `employees`. Repositories are the ONLY layer that touches
 * drizzle/SQL. They translate driver errors via `mapDbError` and return plain
 * rows — no HTTP concerns here.
 */
export const employeeRepository = {
  async findByCode(empCode: string): Promise<Employee | null> {
    try {
      const rows = await db.select().from(employees).where(eq(employees.empCode, empCode)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async findByEmail(email: string): Promise<Employee | null> {
    try {
      const rows = await db
        .select()
        .from(employees)
        .where(eq(employees.email, email.toLowerCase()))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async listAll(): Promise<Employee[]> {
    try {
      return await db.select().from(employees);
    } catch (err) {
      throw mapDbError(err);
    }
  },

  async setPasswordHash(empCode: string, passwordHash: string): Promise<Employee> {
    try {
      const [row] = await db
        .update(employees)
        .set({ passwordHash })
        .where(eq(employees.empCode, empCode))
        .returning();
      return row!;
    } catch (err) {
      throw mapDbError(err);
    }
  },
};

export type EmployeeRepository = typeof employeeRepository;
