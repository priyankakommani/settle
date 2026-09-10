import { EmployeeRole, type EmployeeRoleValue } from '@settle/shared';

/**
 * The Nortex roster plus the local Administrator account. The sign-in screen
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
  { empCode: 'NX-ADMIN', name: 'Nortex Administrator', email: 'admin@nortexindustries.com', designation: 'System Administrator', role: EmployeeRole.ADMIN },
  { empCode: 'NX-4471', name: 'Chaitanya Reddy', email: 'chaitanya.reddy@nortexindustries.com', designation: 'Manager - Key Accounts', role: EmployeeRole.EMPLOYEE },
  { empCode: 'NX-5182', name: 'Deepa Nair', email: 'deepa.nair@nortexindustries.com', designation: 'Manager - Presales', role: EmployeeRole.EMPLOYEE },
  { empCode: 'NX-4490', name: 'Imran Qureshi', email: 'imran.qureshi@nortexindustries.com', designation: 'Executive - Sales', role: EmployeeRole.EMPLOYEE },
  { empCode: 'NX-2210', name: 'Suresh Iyer', email: 'suresh.iyer@nortexindustries.com', designation: 'Deputy General Manager', role: EmployeeRole.REPORTING_MANAGER },
  { empCode: 'NX-1108', name: 'Meera Krishnan', email: 'meera.krishnan@nortexindustries.com', designation: 'Head of Department - Sales', role: EmployeeRole.HEAD_OF_DEPARTMENT },
  { empCode: 'NX-1002', name: 'Arvind Rao', email: 'arvind.rao@nortexindustries.com', designation: 'Head of Division - Commercial', role: EmployeeRole.HEAD_OF_DIVISION },
  { empCode: 'NX-1000', name: 'Nandita Shah', email: 'nandita.shah@nortexindustries.com', designation: 'Managing Director', role: EmployeeRole.MD },
  { empCode: 'NX-3305', name: 'Ravi Menon', email: 'ravi.menon@nortexindustries.com', designation: 'Manager - Finance Shared Services', role: EmployeeRole.FINANCE },
  { empCode: 'NX-3300', name: 'Kavitha Balan', email: 'kavitha.balan@nortexindustries.com', designation: 'Controller', role: EmployeeRole.FINANCE },
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
export const DEMO_PASSWORD = 'Nortex@2026';
