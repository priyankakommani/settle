import { describe, expect, it } from 'vitest';
import { canTransition, nextStatus } from '../../src/domain/state-machine/claim-state-machine.js';

/**
 * Legal and illegal claim-status transitions.
 */
describe('claim state machine', () => {
  it('allows submit from DRAFT', () => {
    expect(canTransition('DRAFT', 'submit')).toBe(true);
    expect(nextStatus('DRAFT', 'submit')).toBe('PENDING_APPROVAL');
  });

  it('rejects finance_pay before VERIFIED', () => {
    expect(canTransition('PENDING_APPROVAL', 'finance_pay')).toBe(false);
    expect(() => nextStatus('PENDING_APPROVAL', 'finance_pay')).toThrow();
  });
});
