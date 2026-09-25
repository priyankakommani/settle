import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { employeeRoleEnum, cityTierEnum } from './enums.js';

/**
 * Loaded from employee_master.csv. `reporting_manager_code` is a self
 * reference and drives the approval chain.
 */
export const employees = pgTable(
  'employees',
  {
    empCode: text('emp_code').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    designation: text('designation').notNull(),
    department: text('department').notNull(),
    costCentre: text('cost_centre').notNull(),
    city: text('city').notNull(),
    cityTier: cityTierEnum('city_tier'),
    reportingManagerCode: text('reporting_manager_code').references(
      (): AnyPgColumn => employees.empCode,
    ),
    role: employeeRoleEnum('role').notNull(),
    /**
     * scrypt password hash. Null = the employee exists but hasn't registered a
     * password yet (they can self-register via /auth/signup).
     */
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    managerIdx: index('employees_manager_idx').on(t.reportingManagerCode),
    roleIdx: index('employees_role_idx').on(t.role),
  }),
);

export const employeesRelations = relations(employees, ({ one }) => ({
  reportingManager: one(employees, {
    fields: [employees.reportingManagerCode],
    references: [employees.empCode],
    relationName: 'reporting_manager',
  }),
}));

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
