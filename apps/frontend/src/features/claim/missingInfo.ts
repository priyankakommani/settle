/**
 * Turns a raw `policyMeta.missing` entry (a short label the policy engine
 * emits) into a full sentence explaining WHY it's needed — so the claimant
 * doesn't have to guess what "receipt" or "category" actually means here.
 * Keep this in sync with the `missing.push(...)` / `needsInfo(...)` calls in
 * apps/backend/src/domain/policy/policy-engine.ts.
 */
export function explainMissing(item: string): string {
  if (item === 'hotel tax invoice') {
    return "The booking voucher only confirms the reservation, not what was actually paid — attach the hotel's tax invoice/folio to reimburse the stay.";
  }
  if (item === 'receipt') {
    return 'This ride has no receipt attached — local conveyance is only reimbursed against an actual receipt (policy 3.4).';
  }
  if (item === 'itemised bill') {
    return "This meal is above the no-bill threshold — attach the restaurant's itemised bill to claim it (policy 3.3).";
  }
  if (item === 'attendee names') {
    return 'Business entertainment needs to name who was hosted — add the attendee names (policy 3.5).';
  }
  if (item === 'attendee organisation') {
    return "Add which company/organisation the attendees belong to — it's required alongside their names (policy 3.5).";
  }
  if (item === 'bill') {
    return 'No bill is attached for this entertainment expense — attach the itemised bill (policy 3.5).';
  }
  if (item.startsWith('Head of Department pre-approval')) {
    const threshold = item.match(/\(amount over (.+)\)/)?.[1];
    return threshold
      ? `This entertainment expense is over ${threshold} — it needs your Head of Department's pre-approval on record before it can be claimed (policy 3.5).`
      : 'This entertainment expense is over the pre-approval threshold — it needs Head of Department pre-approval on record (policy 3.5).';
  }
  if (item === 'supporting document') {
    return 'Every claim line needs a supporting document — attach the receipt or invoice for this expense (policy 5.2).';
  }
  if (item === 'category') {
    return "This expense wasn't automatically recognised as lodging, conveyance, a meal, or entertainment — pick the correct category so a policy rule can be applied.";
  }
  return item;
}
