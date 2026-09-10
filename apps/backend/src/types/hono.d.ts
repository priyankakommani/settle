import type { Logger } from '../lib/logger.js';
import type { Employee } from '../db/schema/index.js';

/**
 * Everything stashed on the Hono context via `c.set(...)`.
 * Gives `c.get('currentUser')` etc. full types across the codebase.
 */
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    logger: Logger;
    /** set by the `currentUser` middleware (auth stub) */
    currentUser: Employee;
  }
}

export {};
