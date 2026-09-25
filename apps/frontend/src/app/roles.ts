import { EmployeeRole, type EmployeeRoleValue } from '@settle/shared';

/**
 * Role model for navigation + route guards.
 *
 *  - Everyone receives a role-scoped analytics dashboard and can be a traveller.
 *  - Approver roles additionally get the "Approvals" queue.
 *  - Finance gets the "Finance" queue instead of Approvals.
 *
 * The home screen is analytics; the dashboard payload is scoped by role on the
 * server, so users only see the information they are entitled to see.
 */

export const APPROVER_ROLES: EmployeeRoleValue[] = [
  EmployeeRole.REPORTING_MANAGER,
  EmployeeRole.HEAD_OF_DEPARTMENT,
  EmployeeRole.HEAD_OF_DIVISION,
  EmployeeRole.MD,
];

export function isApprover(role: string): boolean {
  return APPROVER_ROLES.includes(role as EmployeeRoleValue);
}

export function isFinance(role: string): boolean {
  return role === EmployeeRole.FINANCE;
}

export function isOrganisationAdmin(role: string): boolean {
  return role === EmployeeRole.ADMIN || role === EmployeeRole.MD;
}

/** Where this role lands after sign-in / on hitting "/". */
export function homePathFor(role: string): string {
  void role;
  return '/analytics';
}

export type NavArea = 'analytics' | 'trips' | 'approvals' | 'finance' | 'admin';

export interface NavItem {
  area: NavArea;
  to: string;
  label: string;
}

/** Nav entries visible to a role, in display order. */
export function navItemsFor(role: string): NavItem[] {
  const items: NavItem[] = [
    { area: 'analytics', to: '/analytics', label: 'Overview' },
  ];
  if (role !== EmployeeRole.ADMIN) {
    items.push({ area: 'trips', to: '/trips', label: 'My Trips' });
  }
  if (isApprover(role)) items.push({ area: 'approvals', to: '/approvals', label: 'Approvals' });
  if (isFinance(role)) items.push({ area: 'finance', to: '/finance', label: 'Finance' });
  if (isOrganisationAdmin(role)) items.push({ area: 'admin', to: '/admin/claims', label: 'Administration' });
  return items;
}

/** Which nav areas a role may reach at all (used by the route guard). */
export function allowedAreasFor(role: string): NavArea[] {
  return navItemsFor(role).map((i) => i.area);
}
