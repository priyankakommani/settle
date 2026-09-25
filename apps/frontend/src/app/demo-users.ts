import { EmployeeRole, type EmployeeRoleValue } from '@settle/shared';

/**
 * The Acme roster plus the local Administrator account. The sign-in screen
 * shows these as quick-fill chips so you don't have to type an email; auth
 * itself is real (email + password). Seeded password: SEED_DEFAULT_PASSWORD.
 */
export interface DemoUser {
  empCode: string;
  name: string;
  email: string;
  designation: string;
  role: EmployeeRoleValue;
}

export const DEMO_USERS: DemoUser[] = [
  { empCode: 'AC-ADMIN', name: 'Acme Administrator', email: 'admin@acmecorp.com', designation: 'System Administrator', role: EmployeeRole.ADMIN },
  { empCode: 'AC-4471', name: 'Chaitanya Reddy', email: 'chaitanya.reddy@acmecorp.com', designation: 'Manager - Key Accounts', role: EmployeeRole.EMPLOYEE },
  { empCode: 'AC-5182', name: 'Deepa Nair', email: 'deepa.nair@acmecorp.com', designation: 'Manager - Presales', role: EmployeeRole.EMPLOYEE },
  { empCode: 'AC-4490', name: 'Imran Qureshi', email: 'imran.qureshi@acmecorp.com', designation: 'Executive - Sales', role: EmployeeRole.EMPLOYEE },
  { empCode: 'AC-2210', name: 'Suresh Iyer', email: 'suresh.iyer@acmecorp.com', designation: 'Deputy General Manager', role: EmployeeRole.REPORTING_MANAGER },
  { empCode: 'AC-1108', name: 'Meera Krishnan', email: 'meera.krishnan@acmecorp.com', designation: 'Head of Department - Sales', role: EmployeeRole.HEAD_OF_DEPARTMENT },
  { empCode: 'AC-1002', name: 'Arvind Rao', email: 'arvind.rao@acmecorp.com', designation: 'Head of Division - Commercial', role: EmployeeRole.HEAD_OF_DIVISION },
  { empCode: 'AC-1000', name: 'Nandita Shah', email: 'nandita.shah@acmecorp.com', designation: 'Managing Director', role: EmployeeRole.MD },
  { empCode: 'AC-3305', name: 'Ravi Menon', email: 'ravi.menon@acmecorp.com', designation: 'Manager - Finance Shared Services', role: EmployeeRole.FINANCE },
  { empCode: 'AC-3300', name: 'Kavitha Balan', email: 'kavitha.balan@acmecorp.com', designation: 'Controller', role: EmployeeRole.FINANCE },
];

export const DEMO_GROUPS: { label: string; roles: EmployeeRoleValue[] }[] = [
  { label: 'Travellers', roles: [EmployeeRole.EMPLOYEE] },
  {
    label: 'Approvers',
    roles: [
      EmployeeRole.REPORTING_MANAGER,
      EmployeeRole.HEAD_OF_DEPARTMENT,
      EmployeeRole.HEAD_OF_DIVISION,
      EmployeeRole.MD,
    ],
  },
  { label: 'Finance', roles: [EmployeeRole.FINANCE] },
  { label: 'Administration', roles: [EmployeeRole.ADMIN] },
];

/** Seeded password for every roster account (matches SEED_DEFAULT_PASSWORD). */
export const DEMO_PASSWORD = 'Acme@2026';
