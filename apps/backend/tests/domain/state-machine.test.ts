import { describe, expect, it } from 'vitest';
import { canTransition, nextStatus } from '../../src/domain/state-machine/claim-state-machine.js';

/**
 * Placeholder proving the test runner + path setup work. Real domain tests
 * (policy engine, settlement calculator, approval routing) land in the code
 * phase and use the pack's sample trip as the fixture.
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
