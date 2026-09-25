/**
 * Barrel for the whole schema. `drizzle.config.ts` points here and
 * `db/index.ts` passes this module as the drizzle `schema` so relational
 * queries work.
 */
export * from './enums.js';
export * from './employees.js';
export * from './policy-config.js';
export * from './trips.js';
export * from './raw-documents.js';
export * from './attachments.js';
export * from './claim-lines.js';
export * from './settlements.js';
export * from './approvals.js';
export * from './audit-log.js';
export * from './notifications.js';
